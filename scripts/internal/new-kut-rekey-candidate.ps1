[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$SourcePath,
  [Parameter(Mandatory)][string]$PendingPath,
  [Parameter(Mandatory)][string]$EvidencePath,
  [string]$OldPassphraseLocator = 'backup-encryption-v1',
  [string]$NewPassphraseLocator = 'backup-encryption-v2',
  [string]$CredentialStoreRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$scriptsDir = Split-Path -Parent $PSScriptRoot
$protect = Join-Path $scriptsDir 'protect-kut-backup.ps1'
Import-Module (Join-Path $scriptsDir 'lib\KutCredentialStore.psm1') -Force
if ((Test-Path -LiteralPath $PendingPath) -or (Test-Path -LiteralPath $EvidencePath)) {
  throw 'Refusing to overwrite a rekey candidate or evidence file.'
}
$plaintext = Join-Path ([IO.Path]::GetTempPath()) "kut-rekey-$([guid]::NewGuid().ToString('N')).sql"
$oldSecret = Get-KutStoredCredential -Locator $OldPassphraseLocator -StoreRoot $CredentialStoreRoot
$newSecret = Get-KutStoredCredential -Locator $NewPassphraseLocator -StoreRoot $CredentialStoreRoot
try {
  & $protect -Mode Decrypt -InputPath $SourcePath -OutputPath $plaintext -Passphrase $oldSecret
  $hash = (Get-FileHash -LiteralPath $plaintext -Algorithm SHA256).Hash
  & $protect -Mode Encrypt -InputPath $plaintext -OutputPath $PendingPath -Passphrase $newSecret
  [pscustomobject]@{
    version = 1
    plaintext_sha256 = $hash
    old_credential_locator = $OldPassphraseLocator
    new_credential_locator = $NewPassphraseLocator
    created_at = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json | Set-Content -LiteralPath $EvidencePath -Encoding UTF8
}
finally {
  $oldSecret = $null
  $newSecret = $null
  if (Test-Path -LiteralPath $plaintext) { Remove-Item -LiteralPath $plaintext -Force }
}
