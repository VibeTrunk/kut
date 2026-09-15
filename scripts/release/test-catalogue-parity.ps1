[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$CentralRepository,
  [switch]$PassThru
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sourceDir = Join-Path $repoRoot 'supabase\migrations'
$centralRoot = [IO.Path]::GetFullPath($CentralRepository)
$candidates = @(
  (Join-Path $centralRoot 'supabase\migrations'),
  (Join-Path $centralRoot 'migrations')
)
$centralDir = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Container } | Select-Object -First 1
if (-not $centralDir) { throw 'Central catalogue has no supabase/migrations or migrations directory.' }

$records = @()
foreach ($source in Get-ChildItem -LiteralPath $sourceDir -Filter '*.sql' -File | Sort-Object Name) {
  $central = Join-Path $centralDir $source.Name
  if (-not (Test-Path -LiteralPath $central -PathType Leaf)) {
    throw "Central catalogue is missing $($source.Name)."
  }
  $sourceHash = (Get-FileHash -LiteralPath $source.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $centralHash = (Get-FileHash -LiteralPath $central -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($sourceHash -ne $centralHash) { throw "Catalogue hash mismatch for $($source.Name)." }
  $records += "$($source.Name):$sourceHash"
}
$bytes = [Text.Encoding]::UTF8.GetBytes(($records -join "`n"))
$hasher = [Security.Cryptography.SHA256]::Create()
try { $sha = $hasher.ComputeHash($bytes) }
finally { $hasher.Dispose() }
$aggregate = (($sha | ForEach-Object { $_.ToString('x2') }) -join '')
$result = [pscustomobject]@{
  result = 'passed'
  migration_count = $records.Count
  aggregate_sha256 = $aggregate
  central_repository = $centralRoot
  verified_at = (Get-Date).ToUniversalTime().ToString('o')
}
if ($PassThru) { return $result }
$result | ConvertTo-Json
