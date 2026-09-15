[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$GateManifest,
  [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$CandidateSha,
  [Parameter(Mandatory)][string]$ApprovedBy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$gate = Get-Content -LiteralPath $GateManifest -Raw | ConvertFrom-Json
if ($gate.result -ne 'passed' -or $gate.candidate_sha -ne $CandidateSha.ToLowerInvariant() -or
    $gate.deployment_authorized -ne $false) {
  throw 'Gate manifest is not a passing, non-deploying record for this candidate.'
}
$gateAge = (Get-Date).ToUniversalTime() - [datetime]::Parse($gate.created_at).ToUniversalTime()
if ($gateAge.TotalHours -gt 8 -or $gateAge.TotalSeconds -lt 0) {
  throw 'Gate evidence is stale or future-dated; run a new production gate.'
}
$confirmation = Read-Host "Type the full candidate SHA to approve release (this still does not deploy)"
if ($confirmation.ToLowerInvariant() -ne $CandidateSha.ToLowerInvariant()) { throw 'Approval phrase did not match.' }
$approvalPath = "$GateManifest.approval.json"
if (Test-Path -LiteralPath $approvalPath) { throw 'Refusing to overwrite an existing approval.' }
$approvalPending = "$approvalPath.pending"
if (Test-Path -LiteralPath $approvalPending) { throw 'Refusing to overwrite pending approval evidence.' }
$approval = [ordered]@{
  version = 1
  candidate_sha = $CandidateSha.ToLowerInvariant()
  gate_manifest = (Resolve-Path -LiteralPath $GateManifest).Path
  approved_by = $ApprovedBy
  release_approved = $true
  deployment_authorized = $false
  approved_at = (Get-Date).ToUniversalTime().ToString('o')
}
try {
  $approval | ConvertTo-Json | Set-Content -LiteralPath $approvalPending -Encoding UTF8
  Move-Item -LiteralPath $approvalPending -Destination $approvalPath
}
finally {
  if (Test-Path -LiteralPath $approvalPending) { Remove-Item -LiteralPath $approvalPending -Force }
}
Write-Host "Release approved; deployment remains unauthorized. Evidence: $approvalPath"
