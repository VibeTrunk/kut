[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$SourcePath,
  [string]$DestinationPath,
  [string]$OldPassphraseLocator = 'backup-encryption-v1',
  [string]$NewPassphraseLocator = 'backup-encryption-v2',
  [string]$CredentialStoreRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) { throw 'Source backup was not found.' }
$source = (Resolve-Path -LiteralPath $SourcePath).Path
if (-not $DestinationPath) {
  $DestinationPath = "$source.rekey-$(Get-Date -Format 'yyyyMMdd-HHmmss').enc"
}
$destination = [IO.Path]::GetFullPath($DestinationPath)
$pending = "$destination.pending"
if ($source -eq $destination) { throw 'Rekeying must write a new file, never overwrite its source.' }
if ((Test-Path -LiteralPath $destination) -or (Test-Path -LiteralPath $pending)) {
  throw 'Refusing to overwrite an existing rekey destination or pending candidate.'
}
$workDir = Join-Path ([IO.Path]::GetTempPath()) "kut-rekey-orchestrator-$([guid]::NewGuid().ToString('N'))"
[IO.Directory]::CreateDirectory($workDir) | Out-Null
$producerEvidence = Join-Path $workDir 'producer.json'
$oldEvidence = Join-Path $workDir 'old-verification.json'
$newEvidence = Join-Path $workDir 'new-verification.json'
$producer = Join-Path $PSScriptRoot 'internal\new-kut-rekey-candidate.ps1'
$verifier = Join-Path $PSScriptRoot 'test-kut-backup-cold.ps1'
$powerShell = if (Get-Command pwsh -ErrorAction SilentlyContinue) {
  (Get-Command pwsh).Source
} else {
  (Get-Command powershell -ErrorAction Stop).Source
}

try {
  $producerArgs = @(
    '-NoProfile', '-File', $producer,
    '-SourcePath', $source,
    '-PendingPath', $pending,
    '-EvidencePath', $producerEvidence,
    '-OldPassphraseLocator', $OldPassphraseLocator,
    '-NewPassphraseLocator', $NewPassphraseLocator
  )
  if ($CredentialStoreRoot) { $producerArgs += @('-CredentialStoreRoot', $CredentialStoreRoot) }
  & $powerShell @producerArgs
  if ($LASTEXITCODE -ne 0) { throw "Rekey worker failed with exit code $LASTEXITCODE." }
  $record = Get-Content -LiteralPath $producerEvidence -Raw | ConvertFrom-Json

  $oldVerifyArgs = @(
    '-NoProfile', '-File', $verifier,
    '-EncryptedPath', $source,
    '-ExpectedPlaintextSha256', $record.plaintext_sha256,
    '-PassphraseLocator', $OldPassphraseLocator,
    '-EvidencePath', $oldEvidence
  )
  if ($CredentialStoreRoot) { $oldVerifyArgs += @('-CredentialStoreRoot', $CredentialStoreRoot) }
  & $powerShell @oldVerifyArgs
  if ($LASTEXITCODE -ne 0) { throw 'Independent source verification failed.' }
  $newVerifyArgs = @(
    '-NoProfile', '-File', $verifier,
    '-EncryptedPath', $pending,
    '-ExpectedPlaintextSha256', $record.plaintext_sha256,
    '-PassphraseLocator', $NewPassphraseLocator,
    '-EvidencePath', $newEvidence
  )
  if ($CredentialStoreRoot) { $newVerifyArgs += @('-CredentialStoreRoot', $CredentialStoreRoot) }
  & $powerShell @newVerifyArgs
  if ($LASTEXITCODE -ne 0) { throw 'Independent candidate verification failed.' }

  $old = Get-Content -LiteralPath $oldEvidence -Raw | ConvertFrom-Json
  $new = Get-Content -LiteralPath $newEvidence -Raw | ConvertFrom-Json
  if ($old.result -ne 'passed' -or $new.result -ne 'passed' -or
      $old.plaintext_sha256 -ne $new.plaintext_sha256) {
    throw 'Old/new separate-process plaintext evidence does not match.'
  }
  Move-Item -LiteralPath $pending -Destination $destination
  [pscustomobject]@{
    source_path = $source
    candidate_path = $destination
    plaintext_sha256 = $old.plaintext_sha256
    old_credential_locator = $OldPassphraseLocator
    new_credential_locator = $NewPassphraseLocator
    verified_at = $new.verified_at
  } | ConvertTo-Json
}
catch {
  if (Test-Path -LiteralPath $pending) { Remove-Item -LiteralPath $pending -Force }
  throw
}
finally {
  foreach ($file in @($producerEvidence, $oldEvidence, $newEvidence)) {
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
  }
  # See the same block in backup-kut-hosted.ps1: non-recursive removal throws on
  # a non-empty directory, and throwing from a finally would hide the real
  # failure.
  if (Test-Path -LiteralPath $workDir) {
    try { Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction Stop }
    catch { Write-Warning "Could not remove the rekey work directory $workDir. $($_.Exception.Message)" }
  }
}
