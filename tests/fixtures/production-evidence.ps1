# Fictional evidence exercises the validators only. No gate/approval/deploy runs.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$directory = $env:KUT_TEST_EVIDENCE_DIR
$repoRoot = $env:KUT_TEST_REPO
$sha = 'a' * 40
$validator = Join-Path $repoRoot 'scripts/release/assert-production-e2e.ps1'
$prerequisites = Join-Path $repoRoot 'scripts/release/assert-production-prerequisites.ps1'
$manifestPath = Join-Path $directory 'fictional-manifest.json'
$report = Join-Path $directory 'report.json'
$inventory = Join-Path $directory 'inventory.json'
$backupFile = Join-Path $directory 'fictional-backup'
'fictional test report' | Set-Content -LiteralPath $report
'fictional test inventory' | Set-Content -LiteralPath $inventory
'fictional test ciphertext' | Set-Content -LiteralPath $backupFile
$now = (Get-Date).ToUniversalTime()
$evidence = [ordered]@{
  version = 1; result = 'passed'; candidate_sha = $sha
  config = 'playwright.release.config.ts'
  config_sha256 = (Get-FileHash -LiteralPath (Join-Path $repoRoot 'playwright.release.config.ts')).Hash.ToLowerInvariant()
  retries = 0; trace = 'retain-on-failure'; build_id = 'fictional-build'
  production_server = @{ reuse_existing_server = $false; command = 'node node_modules/next/dist/bin/next start --port 3101 --hostname 127.0.0.1' }
  started_at = $now.AddMinutes(-4).ToString('o'); build_started_at = $now.AddMinutes(-3).ToString('o')
  build_completed_at = $now.AddMinutes(-2).ToString('o'); completed_at = $now.AddMinutes(-1).ToString('o')
  projects = @{ 'authenticated-pixel7' = @{ passed = 1 }; 'authenticated-320' = @{ passed = 1 }; 'authenticated-webkit' = @{ passed = 1 } }
  report_sha256 = (Get-FileHash -LiteralPath $report).Hash.ToLowerInvariant()
  inventory_sha256 = (Get-FileHash -LiteralPath $inventory).Hash.ToLowerInvariant()
}
function Save-Evidence { $evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath }
function Expect-Rejected([scriptblock]$Action) {
  $rejected = $false
  try { & $Action | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw 'Validator accepted intentionally invalid fictional evidence.' }
}
Save-Evidence
& $validator -ManifestPath $manifestPath -CandidateSha $sha -PassThru | Out-Null
Expect-Rejected { & $validator -ManifestPath $manifestPath -CandidateSha ('b' * 40) }
$evidence.retries = 1; Save-Evidence
Expect-Rejected { & $validator -ManifestPath $manifestPath -CandidateSha $sha }
$evidence.retries = 0; $evidence.production_server.reuse_existing_server = $true; Save-Evidence
Expect-Rejected { & $validator -ManifestPath $manifestPath -CandidateSha $sha }
$evidence.production_server.reuse_existing_server = $false
$evidence.completed_at = $now.AddHours(1).ToString('o'); Save-Evidence
Expect-Rejected { & $validator -ManifestPath $manifestPath -CandidateSha $sha }
$evidence.completed_at = $now.AddMinutes(-1).ToString('o'); Save-Evidence
'altered fictional report' | Set-Content -LiteralPath $report
Expect-Rejected { & $validator -ManifestPath $manifestPath -CandidateSha $sha }
$checks = @('fast','e2e','database','migrations','security','merge-gate','scan') | ForEach-Object {
  [pscustomobject]@{ name=$_; head_sha=$sha; status='completed'; conclusion='success'; completed_at=$now.AddHours(-1).ToString('o') }
}
$backup = @{ path=$backupFile; created_at=$now.AddHours(-1).ToString('o'); original_cold_verification='passed'
  credential_locator='backup-encryption-v1'; plaintext_sha256='fictional-hash'
  gate_cold_verification=@{ result='passed'; plaintext_sha256='fictional-hash' } }
& $prerequisites -GitHubChecks $checks -Backup $backup -CandidateSha $sha
$backup.created_at = $now.AddHours(-25).ToString('o')
Expect-Rejected { & $prerequisites -GitHubChecks $checks -Backup $backup -CandidateSha $sha }
$backup.created_at = $now.AddHours(-1).ToString('o')
$checks[0].completed_at = $now.AddHours(-73).ToString('o')
Expect-Rejected { & $prerequisites -GitHubChecks $checks -Backup $backup -CandidateSha $sha }
$checks[0].completed_at = $now.AddHours(-1).ToString('o'); $checks[0].head_sha = 'b' * 40
Expect-Rejected { & $prerequisites -GitHubChecks $checks -Backup $backup -CandidateSha $sha }
$checks[0].head_sha = $sha
Expect-Rejected { & $prerequisites -GitHubChecks @($checks + $checks[0]) -Backup $backup -CandidateSha $sha }
'Fictional evidence validators: 11 scenarios passed.'
