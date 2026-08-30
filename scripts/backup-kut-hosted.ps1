<#
.SYNOPSIS
  Take an encrypted logical backup of the hosted `kut` schema (DDL + data) from
  the shared VibeTrunk Supabase project, and verify it round-trips.

.DESCRIPTION
  Runs two `supabase db dump --linked` passes (schema DDL, then data-only COPY),
  concatenates them into one replayable .sql, encrypts it with
  scripts/protect-kut-backup.ps1 (AES-256-CBC + HMAC-SHA256, PBKDF2 600k), then
  decrypts the ciphertext back and checks the SHA-256 matches the source before
  shredding the plaintext. Appends a metadata line to
  .private-backups/BACKUP_LOG.md.

  This only READS the hosted database. It never runs `supabase db push` or
  otherwise mutates the shared project. Still, run it deliberately: it connects
  to production.

  Scope note: the dump covers the `kut` schema only. Account identities live in
  Supabase-managed `auth.users` (covered by the platform's own backups / the
  dashboard backup taken before schema changes). See docs/BACKUP.md.

.PARAMETER OutDir
  Directory for the encrypted .sql.enc file. Must be OUTSIDE this repo tree
  (docs/OPERATIONS.md: exports stay off the repo). Defaults to
  %USERPROFILE%\backups\kut.

.PARAMETER Passphrase
  SecureString passphrase for the encryption. Prompted (with confirmation) if
  omitted. Store it in your password manager -- a backup you cannot decrypt is
  not a backup.

.PARAMETER DbPassword
  SecureString for the hosted Postgres password (`supabase db dump -p`). If
  omitted, the Supabase CLI prompts for it, or reads $env:SUPABASE_DB_PASSWORD.

.PARAMETER SkipVerify
  Skip the decrypt-and-compare integrity check. Not recommended.

.EXAMPLE
  .\scripts\backup-kut-hosted.ps1

.EXAMPLE
  # Less interactive: supply both secrets up front.
  $pp = Read-Host -AsSecureString "passphrase"
  $db = Read-Host -AsSecureString "hosted db password"
  .\scripts\backup-kut-hosted.ps1 -Passphrase $pp -DbPassword $db
#>
[CmdletBinding()]
param(
  [string]$OutDir = (Join-Path $env:USERPROFILE 'backups\kut'),
  [System.Security.SecureString]$Passphrase,
  [System.Security.SecureString]$DbPassword,
  [switch]$SkipVerify
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ConvertFrom-SecureStringPlain {
  param([System.Security.SecureString]$Value)
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$scriptDir      = $PSScriptRoot
$repoRoot       = Split-Path -Parent $scriptDir
$protect        = Join-Path $scriptDir 'protect-kut-backup.ps1'
$logFile        = Join-Path $repoRoot '.private-backups\BACKUP_LOG.md'
$projectRefFile = Join-Path $repoRoot 'supabase\.temp\project-ref'

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'supabase\config.toml'))) {
  throw "Run this from the kut repo (supabase/config.toml not found)."
}
if (-not (Test-Path -LiteralPath $protect)) {
  throw "Missing $protect."
}
if (-not (Test-Path -LiteralPath $projectRefFile)) {
  throw "Supabase project is not linked (no supabase/.temp/project-ref). Run: npx supabase link"
}
$projectRef = (Get-Content -LiteralPath $projectRefFile -Raw).Trim()

# The encrypted export must not land inside the repo tree.
$fullOut  = [System.IO.Path]::GetFullPath($OutDir)
$fullRepo = [System.IO.Path]::GetFullPath($repoRoot)
if ($fullOut.StartsWith($fullRepo, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "OutDir must be OUTSIDE the repo (got '$fullOut' under '$fullRepo')."
}

if (-not $Passphrase) {
  $Passphrase  = Read-Host -AsSecureString "Backup encryption passphrase"
  $confirmSs   = Read-Host -AsSecureString "Confirm passphrase"
  $pA = ConvertFrom-SecureStringPlain $Passphrase
  $pB = ConvertFrom-SecureStringPlain $confirmSs
  $match = ($pA -eq $pB)
  $pA = $null; $pB = $null
  if (-not $match) { throw "Passphrases did not match." }
}

$ts      = Get-Date -Format 'yyyyMMdd-HHmmss'
$workDir = Join-Path ([System.IO.Path]::GetTempPath()) "kut-backup-$ts"
New-Item -ItemType Directory -Path $workDir -Force | Out-Null
if (-not (Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$schemaSql   = Join-Path $workDir 'kut_schema.sql'
$dataSql     = Join-Path $workDir 'kut_data.sql'
$combinedSql = Join-Path $workDir "kut-backup-$ts.sql"
$roundtrip   = Join-Path $workDir 'roundtrip.sql'
$encOut      = Join-Path $OutDir  "kut-backup-$ts.sql.enc"

$plainPw = $null

function Invoke-SupabaseDump {
  param([string[]]$DumpArgs)
  & npx --yes supabase @DumpArgs
  if ($LASTEXITCODE -ne 0) {
    throw ("supabase " + ($DumpArgs -join ' ') + " failed (exit $LASTEXITCODE).")
  }
}

try {
  $pwArgs = @()
  if ($DbPassword) {
    $plainPw = ConvertFrom-SecureStringPlain $DbPassword
    $pwArgs  = @('-p', $plainPw)
  }

  Write-Host "==> Dumping hosted 'kut' schema DDL ($projectRef) ..."
  Invoke-SupabaseDump (@('db', 'dump', '--linked', '-s', 'kut', '-f', $schemaSql) + $pwArgs)

  Write-Host "==> Dumping hosted 'kut' data ..."
  Invoke-SupabaseDump (@('db', 'dump', '--linked', '-s', 'kut', '--data-only', '--use-copy', '-f', $dataSql) + $pwArgs)

  $plainPw = $null

  if (-not (Test-Path -LiteralPath $schemaSql) -or (Get-Item -LiteralPath $schemaSql).Length -eq 0) {
    throw "Schema dump is empty -- check credentials / network and retry."
  }
  if (-not (Test-Path -LiteralPath $dataSql)) {
    throw "Data dump missing."
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  $header = @(
    "-- KUT hosted backup"
    "-- project ref : $projectRef (shared VibeTrunk Supabase project)"
    "-- schema      : kut"
    "-- taken       : $(Get-Date -Format o)"
    "-- contents    : schema DDL, then data-only COPY. Replay against an empty DB;"
    "--               see docs/BACKUP.md for the restore drill (kut-only dump ->"
    "--               replay with session_replication_role = replica)."
    "-- ============================================================ SCHEMA"
    ""
  ) -join "`n"
  $body = $header +
          ([System.IO.File]::ReadAllText($schemaSql)) +
          "`n-- ========================================================== DATA`n" +
          ([System.IO.File]::ReadAllText($dataSql))
  [System.IO.File]::WriteAllText($combinedSql, $body, $utf8NoBom)

  $plainHash = (Get-FileHash -LiteralPath $combinedSql -Algorithm SHA256).Hash
  $plainSize = (Get-Item -LiteralPath $combinedSql).Length

  Write-Host "==> Encrypting -> $encOut"
  & $protect -Mode Encrypt -InputPath $combinedSql -OutputPath $encOut -Passphrase $Passphrase
  if (-not (Test-Path -LiteralPath $encOut)) { throw "Encryption produced no output file." }
  $encSize = (Get-Item -LiteralPath $encOut).Length

  $verified = 'skipped'
  if (-not $SkipVerify) {
    Write-Host "==> Verifying round-trip (decrypt + SHA-256 compare) ..."
    & $protect -Mode Decrypt -InputPath $encOut -OutputPath $roundtrip -Passphrase $Passphrase
    if (-not (Test-Path -LiteralPath $roundtrip)) { throw "Verification decrypt produced no file." }
    $rtHash = (Get-FileHash -LiteralPath $roundtrip -Algorithm SHA256).Hash
    if ($rtHash -ne $plainHash) {
      Remove-Item -LiteralPath $encOut -Force
      throw "INTEGRITY CHECK FAILED: decrypted SHA-256 ($rtHash) != source ($plainHash). Encrypted file deleted."
    }
    $verified = 'passed'
  }

  if (-not (Test-Path -LiteralPath $logFile)) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $logFile) -Force | Out-Null
    [System.IO.File]::WriteAllText(
      $logFile,
      "# KUT hosted backup log`n`nLocal, gitignored record of encrypted backups of the hosted ``kut`` schema.`nNever commit this file's contents elsewhere; it stays local per docs/OPERATIONS.md.`n",
      $utf8NoBom)
  }
  $entry = @(
    ""
    "## $ts - hosted kut backup"
    ""
    "- Project ref: ``$projectRef`` (shared VibeTrunk project)"
    "- Scope: ``kut`` schema, schema DDL + data, ``supabase db dump --linked``"
    "- Encrypted file: ``$encOut``"
    "- Plaintext SHA-256: ``$plainHash``"
    "- Plaintext / ciphertext size: $plainSize / $encSize bytes"
    "- Round-trip integrity check: $verified"
    "- Cipher: AES-256-CBC + HMAC-SHA256, PBKDF2 600,000 (scripts/protect-kut-backup.ps1)"
    "- Passphrase: in the operator password manager, not recorded here"
    "- Restore drill (replay against Postgres): see docs/BACKUP.md"
  ) -join "`n"
  Add-Content -LiteralPath $logFile -Value $entry -Encoding UTF8

  Write-Host ""
  Write-Host "OK  backup written  : $encOut"
  Write-Host "    plaintext bytes : $plainSize"
  Write-Host "    plaintext sha256: $plainHash"
  Write-Host "    integrity check : $verified"
  Write-Host "    log             : $logFile"
  Write-Host ""
  Write-Host "Next: run the restore drill in docs/BACKUP.md at least once before inviting users."
}
finally {
  $plainPw = $null
  # Best-effort shred of plaintext working files, then drop the temp dir.
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    Get-ChildItem -LiteralPath $workDir -File -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        $len = $_.Length
        if ($len -gt 0) {
          $buf = New-Object byte[] $len
          $rng.GetBytes($buf)
          [System.IO.File]::WriteAllBytes($_.FullName, $buf)
        }
      } catch { }
    }
  }
  finally { $rng.Dispose() }
  Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue
}
