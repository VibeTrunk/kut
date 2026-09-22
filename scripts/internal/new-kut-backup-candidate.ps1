[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$PendingPath,
  [Parameter(Mandatory)][string]$ManifestPath,
  [Parameter(Mandatory)][string]$WorkDir,
  [Parameter(Mandatory)][string]$ProjectRef,
  [Parameter(Mandatory)][string]$PassphraseLocator,
  [Parameter(Mandatory)][string]$DbPasswordLocator,
  [switch]$Interactive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$scriptsDir = Split-Path -Parent $PSScriptRoot
$protect = Join-Path $scriptsDir 'protect-kut-backup.ps1'
Import-Module (Join-Path $scriptsDir 'lib\KutCredentialStore.psm1') -Force

function Get-WorkerSecret {
  param([string]$Locator, [string]$Prompt)
  if ($Interactive) { return Read-Host -AsSecureString $Prompt }
  return Get-KutStoredCredential -Locator $Locator
}

function ConvertFrom-SecureStringPlain {
  param([System.Security.SecureString]$Value)
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

if ((Test-Path -LiteralPath $PendingPath) -or (Test-Path -LiteralPath $ManifestPath)) {
  throw 'Refusing to overwrite a pending backup or manifest.'
}
$schemaSql = Join-Path $WorkDir 'kut_schema.sql'
$dataSql = Join-Path $WorkDir 'kut_data.sql'
$combinedSql = Join-Path $WorkDir 'kut_backup.sql'
$passphrase = Get-WorkerSecret -Locator $PassphraseLocator -Prompt 'Backup encryption passphrase'
$dbPassword = Get-WorkerSecret -Locator $DbPasswordLocator -Prompt 'Hosted database password'
$plainDbPassword = $null

try {
  $plainDbPassword = ConvertFrom-SecureStringPlain -Value $dbPassword
  $env:SUPABASE_DB_PASSWORD = $plainDbPassword
  $plainDbPassword = $null
  Write-Host "Dumping hosted kut schema for project $ProjectRef."
  & npx --no-install supabase db dump --linked -s kut -f $schemaSql
  if ($LASTEXITCODE -ne 0) { throw "Schema dump failed with exit code $LASTEXITCODE." }
  & npx --no-install supabase db dump --linked -s kut --data-only --use-copy -f $dataSql
  if ($LASTEXITCODE -ne 0) { throw "Data dump failed with exit code $LASTEXITCODE." }
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue

  if ((Get-Item -LiteralPath $schemaSql).Length -eq 0) { throw 'Schema dump is empty.' }

  # Restore-safety signal. kut.user_cards and kut.trade_offers form a circular
  # foreign key (ADR-042), and a --data-only replay can only satisfy both sides
  # when no card is escrowed in an open offer. Counting it here, from the dump
  # this backup actually contains, turns a mid-recovery unknown into a fact
  # recorded at backup time -- see docs/BACKUP.md. -1 means "could not tell".
  $escrowedCards = -1
  $escrowIndex = -1
  $inUserCards = $false
  foreach ($line in [IO.File]::ReadLines($dataSql)) {
    if (-not $inUserCards) {
      # `supabase db dump` quotes every identifier -- COPY "kut"."user_cards"
      # ("id", ..., "held_by_offer_id") -- while a bare pg_dump does not. Accept
      # both, and strip the quotes before matching the column name.
      if ($line -match '^COPY "?kut"?\."?user_cards"? \((?<cols>[^)]*)\) FROM stdin;') {
        $columns = ($Matches['cols'] -split ',\s*') | ForEach-Object { $_.Trim('"') }
        $escrowIndex = [Array]::IndexOf($columns, 'held_by_offer_id')
        if ($escrowIndex -lt 0) { break }   # pre-ADR-042 dump: leave it unknown
        $escrowedCards = 0
        $inUserCards = $true
      }
      continue
    }
    if ($line -eq '\.') { break }
    $fields = $line -split "`t"
    if ($escrowIndex -lt $fields.Count -and $fields[$escrowIndex] -ne '\N') { $escrowedCards++ }
  }
  $header = @(
    '-- KUT hosted backup',
    "-- project ref : $ProjectRef (shared VibeTrunk Supabase project)",
    '-- schema      : kut',
    "-- taken       : $((Get-Date).ToUniversalTime().ToString('o'))",
    '-- contents    : schema DDL, then data-only COPY',
    '-- ============================================================ SCHEMA',
    ''
  ) -join "`n"
  $body = $header + [IO.File]::ReadAllText($schemaSql) +
    "`n-- ========================================================== DATA`n" +
    [IO.File]::ReadAllText($dataSql)
  [IO.File]::WriteAllText($combinedSql, $body, [Text.UTF8Encoding]::new($false))
  $hash = (Get-FileHash -LiteralPath $combinedSql -Algorithm SHA256).Hash
  $size = (Get-Item -LiteralPath $combinedSql).Length
  & $protect -Mode Encrypt -InputPath $combinedSql -OutputPath $PendingPath -Passphrase $passphrase
  if (-not (Test-Path -LiteralPath $PendingPath -PathType Leaf)) {
    throw 'Encryption did not produce a pending candidate.'
  }
  [pscustomobject]@{
    version = 1
    project_ref = $ProjectRef
    plaintext_sha256 = $hash
    plaintext_bytes = $size
    escrowed_cards = $escrowedCards
    pending_path = $PendingPath
    created_at = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json | Set-Content -LiteralPath $ManifestPath -Encoding UTF8
}
finally {
  $plainDbPassword = $null
  $dbPassword = $null
  $passphrase = $null
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  foreach ($file in @($schemaSql, $dataSql, $combinedSql)) {
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
  }
}
