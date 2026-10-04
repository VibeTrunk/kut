[CmdletBinding()]
param([Parameter(Mandatory)]$GitHubChecks, [Parameter(Mandatory)]$Backup, [Parameter(Mandatory)][string]$CandidateSha)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$now = (Get-Date).ToUniversalTime()
foreach ($name in @('fast', 'e2e', 'database', 'migrations', 'security', 'merge-gate', 'scan')) {
  $namedChecks = @($GitHubChecks | Where-Object { $_.name -eq $name })
  if ($namedChecks.Count -ne 1) { throw "Missing or duplicate '$name' evidence." }
  $check = $namedChecks[0]
  if ($check.head_sha -ne $CandidateSha -or $check.status -ne 'completed' -or $check.conclusion -ne 'success') {
    throw "Invalid '$name' evidence."
  }
  $age = $now - [datetime]::Parse($check.completed_at).ToUniversalTime()
  if ($age.TotalHours -gt 72 -or $age.TotalSeconds -lt 0) { throw "Stale or future '$name' evidence." }
}
$backupAge = $now - [datetime]::Parse($Backup.created_at).ToUniversalTime()
if ($backupAge.TotalHours -gt 24 -or $backupAge.TotalSeconds -lt 0 -or
    $Backup.original_cold_verification -ne 'passed' -or $Backup.gate_cold_verification.result -ne 'passed' -or
    $Backup.credential_locator -ne 'backup-encryption-v1' -or
    $Backup.gate_cold_verification.plaintext_sha256 -ne $Backup.plaintext_sha256 -or
    -not (Test-Path -LiteralPath $Backup.path -PathType Leaf)) {
  throw 'Backup evidence expired, is inconsistent, or names a missing file.'
}
