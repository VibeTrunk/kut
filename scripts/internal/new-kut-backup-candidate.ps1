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
