[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Locator,
  [switch]$Replace
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\lib\KutCredentialStore.psm1') -Force

$plaintext = [Console]::In.ReadToEnd()
if (-not $plaintext) { throw 'No credential value was provided on standard input.' }
$secure = ConvertTo-SecureString -String $plaintext -AsPlainText -Force
$plaintext = $null
try {
  Set-KutStoredCredential -Locator $Locator -Secret $secure -Force:$Replace | Out-Null
  Write-Host "Stored credential locator '$Locator' in the current Windows user DPAPI store."
}
finally {
  $secure = $null
}
