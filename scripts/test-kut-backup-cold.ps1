[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$EncryptedPath,
  [Parameter(Mandatory)][ValidatePattern('^[A-Fa-f0-9]{64}$')][string]$ExpectedPlaintextSha256,
  [string]$PassphraseLocator = 'backup-encryption-v1',
  [string]$CredentialStoreRoot,
  [string]$EvidencePath,
  [switch]$Interactive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$protect = Join-Path $PSScriptRoot 'protect-kut-backup.ps1'
Import-Module (Join-Path $PSScriptRoot 'lib\KutCredentialStore.psm1') -Force
$roundTrip = Join-Path ([IO.Path]::GetTempPath()) "kut-cold-$([guid]::NewGuid().ToString('N')).sql"
if (Test-Path -LiteralPath $roundTrip) { throw 'Cold-verification temp path unexpectedly exists.' }
$passphrase = if ($Interactive) {
  Read-Host -AsSecureString 'Re-enter backup passphrase for independent cold verification'
} else {
  Get-KutStoredCredential -Locator $PassphraseLocator -StoreRoot $CredentialStoreRoot
}

try {
  & $protect -Mode Decrypt -InputPath $EncryptedPath -OutputPath $roundTrip -Passphrase $passphrase
  $actual = (Get-FileHash -LiteralPath $roundTrip -Algorithm SHA256).Hash
  if ($actual -ne $ExpectedPlaintextSha256) {
    throw "Cold verification failed: $actual does not match $ExpectedPlaintextSha256."
  }
  $evidence = [pscustomobject]@{
    version = 1
    result = 'passed'
    plaintext_sha256 = $actual
    credential_locator = $PassphraseLocator
    verified_at = (Get-Date).ToUniversalTime().ToString('o')
  }
  if ($EvidencePath) {
    if (Test-Path -LiteralPath $EvidencePath) { throw 'Refusing to overwrite verification evidence.' }
    $evidence | ConvertTo-Json | Set-Content -LiteralPath $EvidencePath -Encoding UTF8
  } else {
    $evidence | ConvertTo-Json
  }
}
finally {
  $passphrase = $null
  if (Test-Path -LiteralPath $roundTrip) { Remove-Item -LiteralPath $roundTrip -Force }
}
