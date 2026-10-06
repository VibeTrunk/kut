<# Capture stdout as JSON and display safe progress without PowerShell 5.1's
   native-stderr/ErrorActionPreference interaction. No error preference changes. #>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$CandidateSha
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$start = New-Object System.Diagnostics.ProcessStartInfo
# Explicit Application lookup can return multiple PATH matches (notably on CI).
# Preserve normal command precedence rather than joining paths into one filename.
$start.FileName = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$runnerPath = Join-Path $PSScriptRoot 'run-production-e2e.mjs'
$start.Arguments = '"' + $runnerPath + '" --candidate ' + $CandidateSha
$start.WorkingDirectory = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
$start.RedirectStandardError = $true
$process = New-Object System.Diagnostics.Process
$process.StartInfo = $start
$unexpectedStderr = $false
try {
  if (-not $process.Start()) { throw 'Production E2E process could not start.' }
  # Drain stdout asynchronously while stderr is read live to avoid pipe deadlock.
  $stdout = $process.StandardOutput.ReadToEndAsync()
  while ($null -ne ($line = $process.StandardError.ReadLine())) {
    $build = '^\[production-e2e\] stage=production-build event=(started elapsed_ms=\d+|done elapsed_ms=\d+ stage_elapsed_ms=\d+)$'
    $project = '^\[production-e2e\] stage=authenticated-e2e project=authenticated-(pixel7|320|webkit) event=(started|done|stopped) elapsed_ms=\d+ project_elapsed_ms=\d+ passed=\d+ finished=\d+ total=\d+$'
    if ($line -cmatch $build -or $line -cmatch $project) { Write-Host $line }
    else { $unexpectedStderr = $true } # Never echo raw exceptions or browser output.
  }
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) {
    throw 'Production authenticated mobile E2E failed. Its unique private evidence directory is retained.'
  }
  if ($unexpectedStderr) { throw 'Production E2E emitted unexpected stderr; refusing its result.' }
  $stdout.GetAwaiter().GetResult()
}
finally { $process.Dispose() }
