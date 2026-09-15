Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-KutCredentialLocator {
  param([Parameter(Mandatory)][string]$Locator)
  if ($Locator -notmatch '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$') {
    throw "Invalid credential locator '$Locator'. Use 3-64 lowercase letters, digits, and hyphens."
  }
}

function Get-KutCredentialStoreRoot {
  param([string]$StoreRoot)
  if ($StoreRoot) { return [System.IO.Path]::GetFullPath($StoreRoot) }
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'The KUT credential store requires Windows DPAPI.'
  }
  if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is unavailable.' }
  return Join-Path $env:LOCALAPPDATA 'VibeTrunk\kut\credentials'
}

function Set-KutStoredCredential {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$Locator,
    [Parameter(Mandatory)][System.Security.SecureString]$Secret,
    [string]$StoreRoot,
    [switch]$Force
  )
  Assert-KutCredentialLocator -Locator $Locator
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'The KUT credential store requires Windows DPAPI.'
  }
  $root = Get-KutCredentialStoreRoot -StoreRoot $StoreRoot
  [System.IO.Directory]::CreateDirectory($root) | Out-Null
  $target = Join-Path $root "$Locator.clixml"
  if ((Test-Path -LiteralPath $target) -and -not $Force) {
    throw "Credential '$Locator' already exists. Re-run with an explicit replacement operation."
  }
  $pending = Join-Path $root ".$Locator.$([guid]::NewGuid().ToString('N')).pending"
  try {
    [pscustomobject]@{
      version = 1
      locator = $Locator
      created_at = (Get-Date).ToUniversalTime().ToString('o')
      secret = $Secret
    } | Export-Clixml -LiteralPath $pending -Depth 3
    Move-Item -LiteralPath $pending -Destination $target -Force:$Force
  }
  finally {
    if (Test-Path -LiteralPath $pending) { Remove-Item -LiteralPath $pending -Force }
  }
  return $target
}

function Get-KutStoredCredential {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$Locator,
    [string]$StoreRoot
  )
  Assert-KutCredentialLocator -Locator $Locator
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'The KUT credential store requires Windows DPAPI.'
  }
  $target = Join-Path (Get-KutCredentialStoreRoot -StoreRoot $StoreRoot) "$Locator.clixml"
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "Credential '$Locator' is not stored. Run scripts/bootstrap-kut-credentials.mjs explicitly."
  }
  $record = Import-Clixml -LiteralPath $target
  if ($record.version -ne 1 -or $record.locator -ne $Locator -or $record.secret -isnot [System.Security.SecureString]) {
    throw "Credential '$Locator' has an invalid store record."
  }
  return $record.secret
}

Export-ModuleMember -Function Get-KutCredentialStoreRoot, Set-KutStoredCredential, Get-KutStoredCredential
