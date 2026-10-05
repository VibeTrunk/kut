[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
  Import-Module (Join-Path $PSScriptRoot '..\lib\KutCredentialStore.psm1') -Force
  foreach ($locator in @('backup-encryption-v1', 'hosted-db-v1')) {
    $credential = Get-KutStoredCredential -Locator $locator
    if ($credential.Length -eq 0) { throw 'Empty credential.' }
    $credential.Dispose()
    Remove-Variable credential
  }
  Write-Output '{"result":"passed"}'
}
catch {
  # No exceptions, DPAPI records, plaintext or reversible encodings in output.
  Write-Output '{"result":"failed","reason":"credentials_unavailable"}'
  exit 1
}
