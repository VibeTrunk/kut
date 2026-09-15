[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$GateManifest,
  [Parameter(Mandatory)][string]$ApprovalManifest,
  [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$CandidateSha
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$sha = $CandidateSha.ToLowerInvariant()
$gate = Get-Content -LiteralPath $GateManifest -Raw | ConvertFrom-Json
$approval = Get-Content -LiteralPath $ApprovalManifest -Raw | ConvertFrom-Json
if ($gate.result -ne 'passed' -or $gate.candidate_sha -ne $sha) { throw 'Gate evidence mismatch.' }
if ($approval.release_approved -ne $true -or $approval.candidate_sha -ne $sha) {
  throw 'Release approval mismatch.'
}
$resolvedGate = (Resolve-Path -LiteralPath $GateManifest).Path
if ($approval.gate_manifest -ne $resolvedGate) { throw 'Approval belongs to a different gate manifest.' }
if ($gate.deployment_authorized -ne $false -or $approval.deployment_authorized -ne $false) {
  throw 'Evidence format is invalid: these records may never authorize deployment.'
}
$now = (Get-Date).ToUniversalTime()
$gateTime = [datetime]::Parse($gate.created_at).ToUniversalTime()
$approvalTime = [datetime]::Parse($approval.approved_at).ToUniversalTime()
if (($now - $gateTime).TotalHours -gt 8 -or ($now - $gateTime).TotalSeconds -lt 0 -or
    $approvalTime -lt $gateTime -or ($now - $approvalTime).TotalHours -gt 8 -or
    ($now - $approvalTime).TotalSeconds -lt 0) {
  throw 'Gate or approval evidence is stale, future-dated, or out of order.'
}
$head = (& git -C $repoRoot rev-parse HEAD).Trim().ToLowerInvariant()
if ($LASTEXITCODE -ne 0 -or $head -ne $sha) { throw 'Checked-out HEAD does not match the evidence SHA.' }
$dirty = & git -C $repoRoot status --porcelain --untracked-files=all
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Evidence assertion requires a clean candidate checkout.' }
Write-Host "Evidence is valid for $sha. A separate explicit deployment instruction is still required."
