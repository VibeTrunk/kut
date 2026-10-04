[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$ManifestPath,
  [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$CandidateSha,
  [switch]$PassThru
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$sha = $CandidateSha.ToLowerInvariant()
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$evidence = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if ($evidence.version -ne 1 -or $evidence.result -ne 'passed' -or $evidence.candidate_sha -ne $sha -or
    $evidence.config -ne 'playwright.release.config.ts' -or $evidence.retries -ne 0 -or
    $evidence.trace -ne 'retain-on-failure' -or $evidence.production_server.reuse_existing_server -ne $false -or
    $evidence.production_server.command -ne 'node node_modules/next/dist/bin/next start --port 3101 --hostname 127.0.0.1' -or
    -not $evidence.build_id) { throw 'Production E2E provenance is invalid.' }
if ((Get-FileHash -LiteralPath (Join-Path $repoRoot $evidence.config) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $evidence.config_sha256) {
  throw 'Production E2E configuration changed.'
}
$started = [datetime]::Parse($evidence.started_at).ToUniversalTime()
$buildStarted = [datetime]::Parse($evidence.build_started_at).ToUniversalTime()
$buildCompleted = [datetime]::Parse($evidence.build_completed_at).ToUniversalTime()
$completed = [datetime]::Parse($evidence.completed_at).ToUniversalTime()
$now = (Get-Date).ToUniversalTime()
if ($buildStarted -lt $started -or $buildCompleted -lt $buildStarted -or $completed -lt $buildCompleted -or
    ($now - $completed).TotalSeconds -lt 0 -or ($now - $started).TotalHours -gt 8) {
  throw 'Production E2E evidence is stale, future-dated, or out of order.'
}
$names = @('authenticated-pixel7', 'authenticated-320', 'authenticated-webkit')
if (@($evidence.projects.PSObject.Properties).Count -ne 3) { throw 'Production E2E project evidence is incomplete.' }
foreach ($name in $names) {
  if ($evidence.projects.$name.passed -lt 1) { throw "Production E2E lacks '$name' coverage." }
}
$directory = Split-Path -Parent (Resolve-Path -LiteralPath $ManifestPath).Path
foreach ($artifact in @('report', 'inventory')) {
  $file = Join-Path $directory "$artifact.json"
  $expected = $evidence."${artifact}_sha256"
  if ($expected -notmatch '^[a-f0-9]{64}$' -or
      (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
    throw "Production E2E $artifact evidence changed or is missing."
  }
}
if ($PassThru) { return $evidence }
Write-Host "Production E2E evidence is valid for $sha."
