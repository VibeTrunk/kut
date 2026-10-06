<# Internal capture adapter. Existing gate/approval/assertion remain authoritative.
   Raw records never leave this process; only allowlisted progress and JSON do. #>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('gate','approval','assertion')][string]$Stage,
  [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$CandidateSha,
  [string]$GateManifest,
  [string]$ApprovedBy
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$result = $null
$unexpected = $false
try {
  $action = {
    switch ($Stage) {
      'gate' { & (Join-Path $PSScriptRoot 'request-production-gate.ps1') -CandidateSha $CandidateSha -PassThru }
      'approval' {
        # The parent supplies stdin only after re-verifying applicable authorization.
        # Suppress Read-Host's raw native prompt; preserve the existing exact-SHA
        # confirmation comparison inside approve-production-release.ps1.
        function Read-Host { param([string]$Prompt) [Console]::ReadLine() }
        & (Join-Path $PSScriptRoot 'approve-production-release.ps1') -GateManifest $GateManifest -CandidateSha $CandidateSha -ApprovedBy $ApprovedBy
      }
      'assertion' {
        & (Join-Path $PSScriptRoot 'assert-production-evidence.ps1') -GateManifest $GateManifest -ApprovalManifest "$GateManifest.approval.json" -CandidateSha $CandidateSha
      }
    }
  }
  & $action *>&1 | ForEach-Object {
    if ($_ -is [System.Management.Automation.ErrorRecord]) { $unexpected = $true }
    elseif ($_ -is [System.Management.Automation.InformationRecord]) {
      $line = [string]$_.MessageData
      $build = '^\[production-e2e\] stage=production-build event=(started elapsed_ms=\d+|done elapsed_ms=\d+ stage_elapsed_ms=\d+)$'
      $project = '^\[production-e2e\] stage=authenticated-e2e project=authenticated-(pixel7|320|webkit) event=(started|done|stopped) elapsed_ms=\d+ project_elapsed_ms=\d+ passed=\d+ finished=\d+ total=\d+$'
      if ($line -cmatch $build -or $line -cmatch $project) { [Console]::Error.WriteLine($line) }
      # Other informational host notices stay private, including evidence paths.
    }
    elseif ($Stage -eq 'gate' -and $_ -is [pscustomobject] -and $_.PSObject.Properties['gate_manifest']) { $result = $_ }
    elseif ($null -ne $_) { $unexpected = $true }
  }
  if ($unexpected) { throw 'Unexpected stage output.' }
  if ($Stage -eq 'gate') {
    if ($null -eq $result) { throw 'Gate result absent.' }
    $result | ConvertTo-Json -Compress
  } else {
    @{ result = 'passed'; candidate_sha = $CandidateSha } | ConvertTo-Json -Compress
  }
} catch {
  @{ result = 'failed'; candidate_sha = $CandidateSha; stage = $Stage } | ConvertTo-Json -Compress
  exit 1
}
