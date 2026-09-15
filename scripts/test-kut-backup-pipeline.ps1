[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  throw 'Backup pipeline DPAPI tests require Windows.'
}
$root = Join-Path ([IO.Path]::GetTempPath()) "kut-backup-test-$([guid]::NewGuid().ToString('N'))"
[IO.Directory]::CreateDirectory($root) | Out-Null
$store = Join-Path $root 'credentials'
$plain = Join-Path $root 'fictional.sql'
$oldEncrypted = Join-Path $root 'old.sql.enc'
$newEncrypted = Join-Path $root 'new.sql.enc'
$evidence = Join-Path $root 'cold.json'
$protect = Join-Path $PSScriptRoot 'protect-kut-backup.ps1'
$cold = Join-Path $PSScriptRoot 'test-kut-backup-cold.ps1'
$rekey = Join-Path $PSScriptRoot 'rekey-kut-backup.ps1'
$powerShell = if (Get-Command pwsh -ErrorAction SilentlyContinue) {
  (Get-Command pwsh).Source
} else {
  (Get-Command powershell -ErrorAction Stop).Source
}
Import-Module (Join-Path $PSScriptRoot 'lib\KutCredentialStore.psm1') -Force

$script:checks = 0
function Assert-True {
  param([Parameter(Mandatory)][bool]$Condition, [Parameter(Mandatory)][string]$Because)
  if (-not $Condition) { throw "Assertion failed: $Because" }
  $script:checks++
}

# Windows PowerShell 5.1 turns a native command's stderr into a NativeCommandError,
# which $ErrorActionPreference='Stop' then makes terminating. These tests
# deliberately drive scripts into failing, so their diagnostics must not become
# this script's exceptions: only the child's exit code is the contract.
function Invoke-ChildScript {
  param([Parameter(Mandatory)][string[]]$Arguments)
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $powerShell @Arguments 2>$null | Out-Null
    return $LASTEXITCODE
  }
  finally { $ErrorActionPreference = $previous }
}

# Runs the cold verifier in its own process and returns its exit code, which is
# the contract the orchestrator and the release gate both rely on.
function Invoke-ColdVerifier {
  param(
    [Parameter(Mandatory)][string]$EncryptedPath,
    [Parameter(Mandatory)][string]$ExpectedHash,
    [Parameter(Mandatory)][string]$Locator,
    [string]$EvidencePath
  )
  $arguments = @(
    '-NoProfile', '-File', $cold,
    '-EncryptedPath', $EncryptedPath,
    '-ExpectedPlaintextSha256', $ExpectedHash,
    '-PassphraseLocator', $Locator,
    '-CredentialStoreRoot', $store
  )
  if ($EvidencePath) { $arguments += @('-EvidencePath', $EvidencePath) }
  return Invoke-ChildScript -Arguments $arguments
}

# Same wrapper for the rekey orchestrator, which is itself a .ps1.
function Invoke-Rekey {
  param([Parameter(Mandatory)][string[]]$Arguments)
  return Invoke-ChildScript -Arguments (@('-NoProfile', '-File', $rekey) + $Arguments)
}

function Get-ColdScratchFiles {
  # ForEach-Object, not .Name: under StrictMode a property access on an empty
  # array throws, and "no leftover scratch files" is the expected case.
  @(Get-ChildItem -LiteralPath ([IO.Path]::GetTempPath()) -Filter 'kut-cold-*.sql' -File -ErrorAction SilentlyContinue |
    ForEach-Object { $_.Name })
}

try {
  $oldSecret = ConvertTo-SecureString 'fictional-old-passphrase' -AsPlainText -Force
  $newSecret = ConvertTo-SecureString 'fictional-new-passphrase' -AsPlainText -Force
  Set-KutStoredCredential -Locator 'backup-encryption-v1' -Secret $oldSecret -StoreRoot $store | Out-Null
  Set-KutStoredCredential -Locator 'backup-encryption-v2' -Secret $newSecret -StoreRoot $store | Out-Null
  Set-Content -LiteralPath $plain -Value 'select ''fictional backup'';' -Encoding UTF8
  $hash = (Get-FileHash -LiteralPath $plain -Algorithm SHA256).Hash
  $wrongHash = ('a' * 64)
  & $protect -Mode Encrypt -InputPath $plain -OutputPath $oldEncrypted -Passphrase $oldSecret

  # --- happy path -----------------------------------------------------------
  $scratchBefore = Get-ColdScratchFiles
  Assert-True ((Invoke-ColdVerifier -EncryptedPath $oldEncrypted -ExpectedHash $hash -Locator 'backup-encryption-v1' -EvidencePath $evidence) -eq 0) `
    'a correct ciphertext, credential and hash cold-verify in a separate process'
  Assert-True (Test-Path -LiteralPath $evidence) 'a passing cold verification writes its evidence file'
  $record = Get-Content -LiteralPath $evidence -Raw | ConvertFrom-Json
  Assert-True ($record.result -eq 'passed' -and $record.plaintext_sha256 -eq $hash) `
    'the evidence names the verified plaintext hash'
  Assert-True ($record.PSObject.Properties.Name -notcontains 'passphrase') `
    'the evidence carries a locator, never a secret'
  Remove-Item -LiteralPath $evidence -Force

  # --- failure paths --------------------------------------------------------
  # Wrong credential: the HMAC tag will not validate.
  Assert-True ((Invoke-ColdVerifier -EncryptedPath $oldEncrypted -ExpectedHash $hash -Locator 'backup-encryption-v2' -EvidencePath $evidence) -ne 0) `
    'cold verification fails when the credential is wrong'
  Assert-True (-not (Test-Path -LiteralPath $evidence)) `
    'a failed cold verification writes no evidence file'

  # Missing credential locator: fail closed, never silently prompt or skip.
  Assert-True ((Invoke-ColdVerifier -EncryptedPath $oldEncrypted -ExpectedHash $hash -Locator 'backup-encryption-absent') -ne 0) `
    'cold verification fails closed when the locator is not in the store'

  # Tampered ciphertext: flip one byte inside the authenticated region.
  $tampered = Join-Path $root 'tampered.sql.enc'
  $bytes = [IO.File]::ReadAllBytes($oldEncrypted)
  $bytes[[int]($bytes.Length / 2)] = $bytes[[int]($bytes.Length / 2)] -bxor 0xFF
  [IO.File]::WriteAllBytes($tampered, $bytes)
  Assert-True ((Invoke-ColdVerifier -EncryptedPath $tampered -ExpectedHash $hash -Locator 'backup-encryption-v1') -ne 0) `
    'cold verification rejects a tampered ciphertext'

  # Truncated file: too short to carry magic + salt + IV + tag.
  $truncated = Join-Path $root 'truncated.sql.enc'
  [IO.File]::WriteAllBytes($truncated, $bytes[0..31])
  Assert-True ((Invoke-ColdVerifier -EncryptedPath $truncated -ExpectedHash $hash -Locator 'backup-encryption-v1') -ne 0) `
    'cold verification rejects a truncated ciphertext'

  # Correct ciphertext and credential, but the wrong expected plaintext hash.
  # This is the case that catches a manifest pointing at the wrong dump.
  Assert-True ((Invoke-ColdVerifier -EncryptedPath $oldEncrypted -ExpectedHash $wrongHash -Locator 'backup-encryption-v1' -EvidencePath $evidence) -ne 0) `
    'cold verification fails when the recovered plaintext hash does not match'
  Assert-True (-not (Test-Path -LiteralPath $evidence)) `
    'a hash mismatch writes no evidence file'

  # Every failure above decrypted into a temp file. None may survive.
  $leaked = @(Get-ColdScratchFiles | Where-Object { $_ -notin $scratchBefore })
  Assert-True ($leaked.Count -eq 0) `
    "cold verification removes its decrypted plaintext on every path (leaked: $($leaked -join ', '))"

  # The encryptor refuses to overwrite, so a candidate can never be clobbered.
  $overwrote = $true
  try { & $protect -Mode Encrypt -InputPath $plain -OutputPath $oldEncrypted -Passphrase $oldSecret }
  catch { $overwrote = $false }
  Assert-True (-not $overwrote) 'encryption refuses to overwrite an existing output file'

  # --- rekey ----------------------------------------------------------------
  $rekeyExit = Invoke-Rekey -Arguments @(
    '-SourcePath', $oldEncrypted, '-DestinationPath', $newEncrypted, '-CredentialStoreRoot', $store)
  Assert-True ($rekeyExit -eq 0) 'a valid rekey succeeds'
  Assert-True (Test-Path -LiteralPath $newEncrypted -PathType Leaf) 'rekey publishes its candidate'
  Assert-True (Test-Path -LiteralPath $oldEncrypted -PathType Leaf) 'rekey leaves its source backup in place'
  Assert-True ((Invoke-ColdVerifier -EncryptedPath $newEncrypted -ExpectedHash $hash -Locator 'backup-encryption-v2') -eq 0) `
    'the rekeyed candidate opens with the new credential'
  Assert-True ((Invoke-ColdVerifier -EncryptedPath $newEncrypted -ExpectedHash $hash -Locator 'backup-encryption-v1') -ne 0) `
    'the rekeyed candidate does not open with the old credential'

  # A rekey whose old locator is wrong must fail and leave nothing behind.
  $failedCandidate = Join-Path $root 'failed.sql.enc'
  $sourceBytesBefore = [IO.File]::ReadAllBytes($oldEncrypted)
  $failedExit = Invoke-Rekey -Arguments @(
    '-SourcePath', $oldEncrypted, '-DestinationPath', $failedCandidate,
    '-OldPassphraseLocator', 'backup-encryption-v2', '-NewPassphraseLocator', 'backup-encryption-v1',
    '-CredentialStoreRoot', $store)
  Assert-True ($failedExit -ne 0) 'a rekey with the wrong source credential fails'
  Assert-True (-not (Test-Path -LiteralPath $failedCandidate)) 'a failed rekey publishes no candidate'
  Assert-True (-not (Test-Path -LiteralPath "$failedCandidate.pending")) 'a failed rekey leaves no pending file'
  Assert-True ([Linq.Enumerable]::SequenceEqual($sourceBytesBefore, [IO.File]::ReadAllBytes($oldEncrypted))) `
    'a failed rekey leaves its source backup byte-identical'

  # Rekeying onto itself would destroy the only copy.
  $selfExit = Invoke-Rekey -Arguments @(
    '-SourcePath', $oldEncrypted, '-DestinationPath', $oldEncrypted, '-CredentialStoreRoot', $store)
  Assert-True ($selfExit -ne 0) 'rekey refuses to write over its own source'

  Write-Host "Backup cold-verification and staged-rekey tests passed ($script:checks assertions)."
}
finally {
  if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
