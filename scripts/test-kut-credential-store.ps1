[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  throw 'DPAPI credential-store tests require Windows.'
}
Import-Module (Join-Path $PSScriptRoot 'lib\KutCredentialStore.psm1') -Force

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) "kut-credential-test-$([guid]::NewGuid().ToString('N'))"
try {
  $value = ConvertTo-SecureString -String 'fictional-test-secret' -AsPlainText -Force
  Set-KutStoredCredential -Locator 'test-locator-v1' -Secret $value -StoreRoot $testRoot | Out-Null
  $roundTrip = Get-KutStoredCredential -Locator 'test-locator-v1' -StoreRoot $testRoot
  $credential = [pscredential]::new('test', $roundTrip)
  if ($credential.GetNetworkCredential().Password -ne 'fictional-test-secret') {
    throw 'DPAPI credential-store round trip did not match.'
  }
  try {
    Set-KutStoredCredential -Locator 'test-locator-v1' -Secret $value -StoreRoot $testRoot | Out-Null
    throw 'Credential overwrite was not refused.'
  }
  catch {
    if ($_.Exception.Message -eq 'Credential overwrite was not refused.') { throw }
  }
  Write-Host 'DPAPI credential-store tests passed.'
}
finally {
  if (Test-Path -LiteralPath $testRoot) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
