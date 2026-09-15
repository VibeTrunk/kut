<#
.SYNOPSIS
  Creates a cold-verified encrypted logical backup of the hosted `kut` schema.

.DESCRIPTION
  This orchestrator never receives a credential. A short-lived worker retrieves
  the DPAPI credentials, performs the read-only dump and encryption, then exits.
  A different worker retrieves the encryption credential independently,
  decrypts the pending candidate, and compares its plaintext SHA-256. Only then
  is the pending file atomically renamed to its final name.

  This script never deploys or changes the hosted database.

.PARAMETER Interactive
  Prompt inside each worker instead of using DPAPI. Explicit emergency/manual
  mode; the passphrase is requested once for encryption and again for the cold
  verification.
#>
[CmdletBinding()]
param(
  [string]$OutDir = (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'backups\kut'),
  [string]$PassphraseLocator = 'backup-encryption-v1',
  [string]$DbPasswordLocator = 'hosted-db-v1',
  [switch]$Interactive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$projectRefFile = Join-Path $repoRoot 'supabase\.temp\project-ref'
$producer = Join-Path $PSScriptRoot 'internal\new-kut-backup-candidate.ps1'
$verifier = Join-Path $PSScriptRoot 'test-kut-backup-cold.ps1'
$logFile = Join-Path $repoRoot '.private-backups\BACKUP_LOG.md'
$powerShell = if (Get-Command pwsh -ErrorAction SilentlyContinue) {
  (Get-Command pwsh).Source
} else {
  (Get-Command powershell -ErrorAction Stop).Source
}

if (-not (Test-Path -LiteralPath $projectRefFile -PathType Leaf)) {
  throw 'Supabase project is not linked (supabase/.temp/project-ref is missing).'
}
$projectRef = (Get-Content -LiteralPath $projectRefFile -Raw).Trim()
$fullOut = [System.IO.Path]::GetFullPath($OutDir)
$fullRepo = [System.IO.Path]::GetFullPath($repoRoot)
if ($fullOut.StartsWith($fullRepo, [StringComparison]::OrdinalIgnoreCase)) {
  throw "OutDir must be outside the repository: $fullOut"
}
[System.IO.Directory]::CreateDirectory($fullOut) | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$finalPath = Join-Path $fullOut "kut-backup-$timestamp.sql.enc"
$pendingPath = "$finalPath.pending"
if ((Test-Path -LiteralPath $finalPath) -or (Test-Path -LiteralPath $pendingPath)) {
  throw 'The backup candidate path already exists; refusing to overwrite it.'
}
$workDir = Join-Path ([System.IO.Path]::GetTempPath()) "kut-backup-$timestamp-$([guid]::NewGuid().ToString('N'))"
[System.IO.Directory]::CreateDirectory($workDir) | Out-Null
$manifestPath = Join-Path $workDir 'candidate.json'
$verificationPath = Join-Path $workDir 'verification.json'

try {
  $common = @(
    '-NoProfile', '-File', $producer,
    '-PendingPath', $pendingPath,
    '-ManifestPath', $manifestPath,
    '-WorkDir', $workDir,
    '-ProjectRef', $projectRef,
    '-PassphraseLocator', $PassphraseLocator,
    '-DbPasswordLocator', $DbPasswordLocator
  )
  if ($Interactive) { $common += '-Interactive' }
  & $powerShell @common
  if ($LASTEXITCODE -ne 0) { throw "Backup worker failed with exit code $LASTEXITCODE." }
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw 'Backup worker did not produce its nonsecret manifest.'
  }
  $candidate = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

  $verifyArgs = @(
    '-NoProfile', '-File', $verifier,
    '-EncryptedPath', $pendingPath,
    '-ExpectedPlaintextSha256', $candidate.plaintext_sha256,
    '-PassphraseLocator', $PassphraseLocator,
    '-EvidencePath', $verificationPath
  )
  if ($Interactive) { $verifyArgs += '-Interactive' }
  & $powerShell @verifyArgs
  if ($LASTEXITCODE -ne 0) { throw "Cold verifier failed with exit code $LASTEXITCODE." }
  $verification = Get-Content -LiteralPath $verificationPath -Raw | ConvertFrom-Json
  if ($verification.result -ne 'passed' -or $verification.plaintext_sha256 -ne $candidate.plaintext_sha256) {
    throw 'Cold-verification evidence is missing or inconsistent.'
  }

  Move-Item -LiteralPath $pendingPath -Destination $finalPath
  $utf8NoBom = [Text.UTF8Encoding]::new($false)
  if (-not (Test-Path -LiteralPath $logFile)) {
    [System.IO.Directory]::CreateDirectory((Split-Path -Parent $logFile)) | Out-Null
    [System.IO.File]::WriteAllText(
      $logFile,
      "# KUT hosted backup log`n`nLocal and gitignored. Contains nonsecret evidence only.`n",
      $utf8NoBom
    )
  }
  $entry = @(
    '', "## $timestamp - hosted kut backup", '',
    "- Candidate: ``$finalPath``",
    "- Project ref: ``$projectRef``",
    "- Plaintext SHA-256: ``$($candidate.plaintext_sha256)``",
    "- Plaintext / ciphertext size: $($candidate.plaintext_bytes) / $((Get-Item -LiteralPath $finalPath).Length) bytes",
    "- Cold verification: passed in separate process at $($verification.verified_at)",
    "- Encryption credential locator: ``$PassphraseLocator``",
    "- Database credential locator: ``$DbPasswordLocator``",
    '- Cipher: AES-256-CBC + HMAC-SHA256, PBKDF2 600,000'
  ) -join "`n"
  Add-Content -LiteralPath $logFile -Value $entry -Encoding UTF8

  $backupEvidence = [pscustomobject]@{
    version = 1
    backup_path = $finalPath
    plaintext_sha256 = $candidate.plaintext_sha256
    cold_verification = 'passed'
    credential_locator = $PassphraseLocator
    created_at = (Get-Date).ToUniversalTime().ToString('o')
  }
  $latestEvidence = Join-Path (Split-Path -Parent $logFile) 'latest-backup-evidence.json'
  $latestPending = "$latestEvidence.pending"
  $backupEvidence | ConvertTo-Json | Set-Content -LiteralPath $latestPending -Encoding UTF8
  Move-Item -LiteralPath $latestPending -Destination $latestEvidence -Force
  $backupEvidence | ConvertTo-Json
}
catch {
  if (Test-Path -LiteralPath $pendingPath) { Remove-Item -LiteralPath $pendingPath -Force }
  throw
}
finally {
  foreach ($file in @($manifestPath, $verificationPath)) {
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
  }
  # -Recurse matters here. The worker deletes its own plaintext dumps, but if it
  # died before its finally block ran they are still in this directory, and a
  # non-recursive Remove-Item throws on a non-empty directory. Thrown from a
  # finally that exception would replace the real failure *and* leave the
  # plaintext behind. Report a cleanup failure without masking the first error.
  if (Test-Path -LiteralPath $workDir) {
    try { Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction Stop }
    catch { Write-Warning "Could not remove the backup work directory $workDir. It may still contain plaintext; delete it by hand. $($_.Exception.Message)" }
  }
}
