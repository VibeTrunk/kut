<#
.SYNOPSIS
  Builds fail-closed production-readiness evidence for one exact commit.

.DESCRIPTION
  This command is read-only with respect to GitHub, Supabase hosted, and
  Vercel. It does not deploy and does not grant release approval.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$CandidateSha
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$CandidateSha = $CandidateSha.ToLowerInvariant()
$head = (& git -C $repoRoot rev-parse HEAD).Trim().ToLowerInvariant()
if ($LASTEXITCODE -ne 0 -or $head -ne $CandidateSha) {
  throw "Candidate SHA must equal the checked-out HEAD ($head)."
}
$dirty = & git -C $repoRoot status --porcelain --untracked-files=all
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Production gate requires a completely clean candidate checkout.' }

$checksJson = & gh api "repos/VibeTrunk/kut/commits/$CandidateSha/check-runs?per_page=100"
if ($LASTEXITCODE -ne 0) { throw 'Could not read GitHub check evidence.' }
$checks = ($checksJson | ConvertFrom-Json).check_runs
$requiredChecks = @('fast', 'e2e', 'database', 'migrations', 'security', 'merge-gate', 'scan')
$checkEvidence = @()
foreach ($name in $requiredChecks) {
  # Not $matches: that is a PowerShell automatic variable clobbered by any
  # -match operator, which would silently corrupt this loop if one were added.
  $namedChecks = @($checks | Where-Object { $_.name -eq $name -and $_.head_sha -eq $CandidateSha })
  if ($namedChecks.Count -ne 1) { throw "Expected exactly one GitHub check named '$name' for this SHA." }
  $check = $namedChecks[0]
  if ($check.status -ne 'completed' -or $check.conclusion -ne 'success') {
    throw "GitHub check '$name' is not a completed success."
  }
  $completedAge = (Get-Date).ToUniversalTime() - [datetime]::Parse($check.completed_at).ToUniversalTime()
  if ($completedAge.TotalHours -gt 72 -or $completedAge.TotalSeconds -lt 0) {
    throw "GitHub check '$name' is stale or future-dated."
  }
  $checkEvidence += [pscustomobject]@{
    name = $name
    id = $check.id
    status = $check.status
    conclusion = $check.conclusion
    head_sha = $check.head_sha
    started_at = $check.started_at
    completed_at = $check.completed_at
    url = $check.html_url
  }
}

$centralRepository = $env:KUT_CENTRAL_SUPABASE_REPO
if (-not $centralRepository) { throw 'KUT_CENTRAL_SUPABASE_REPO must name a local central-catalogue checkout.' }
$catalogue = & (Join-Path $PSScriptRoot 'test-catalogue-parity.ps1') `
  -CentralRepository $centralRepository -PassThru

$backupEvidencePath = Join-Path $repoRoot '.private-backups\latest-backup-evidence.json'
if (-not (Test-Path -LiteralPath $backupEvidencePath -PathType Leaf)) {
  throw 'No cold-verified backup evidence exists. Run scripts/backup-kut-hosted.ps1.'
}
$backup = Get-Content -LiteralPath $backupEvidencePath -Raw | ConvertFrom-Json
if ($backup.cold_verification -ne 'passed' -or $backup.credential_locator -ne 'backup-encryption-v1' -or
    -not (Test-Path -LiteralPath $backup.backup_path -PathType Leaf)) {
  throw 'Latest backup evidence is incomplete, uses the wrong locator, or names a missing file.'
}
$backupAge = (Get-Date).ToUniversalTime() - [datetime]::Parse($backup.created_at).ToUniversalTime()
if ($backupAge.TotalHours -gt 24 -or $backupAge.TotalSeconds -lt 0) {
  throw 'Latest cold-verified backup is older than 24 hours or future-dated.'
}

# Treat the latest evidence as a pointer, not proof that the ciphertext is still
# valid. Re-run decryption and hashing in a new PowerShell process at gate time.
$powerShell = if (Get-Command pwsh -ErrorAction SilentlyContinue) {
  (Get-Command pwsh).Source
} else {
  (Get-Command powershell -ErrorAction Stop).Source
}
$gateBackupEvidencePath = Join-Path ([IO.Path]::GetTempPath()) "kut-gate-backup-$([guid]::NewGuid().ToString('N')).json"
try {
  & $powerShell -NoProfile -File (Join-Path $repoRoot 'scripts\test-kut-backup-cold.ps1') `
    -EncryptedPath $backup.backup_path `
    -ExpectedPlaintextSha256 $backup.plaintext_sha256 `
    -PassphraseLocator $backup.credential_locator `
    -EvidencePath $gateBackupEvidencePath
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $gateBackupEvidencePath -PathType Leaf)) {
    throw 'Fresh gate-time cold verification failed.'
  }
  $gateBackupVerification = Get-Content -LiteralPath $gateBackupEvidencePath -Raw | ConvertFrom-Json
  if ($gateBackupVerification.result -ne 'passed' -or
      $gateBackupVerification.plaintext_sha256 -ne $backup.plaintext_sha256) {
    throw 'Fresh gate-time cold-verification evidence is inconsistent.'
  }
}
finally {
  if (Test-Path -LiteralPath $gateBackupEvidencePath) {
    Remove-Item -LiteralPath $gateBackupEvidencePath -Force
  }
}

if (-not $env:API_URL -or -not $env:ANON_KEY -or -not $env:SERVICE_ROLE_KEY -or -not $env:DB_URL) {
  throw 'Authenticated mobile E2E requires API_URL, ANON_KEY, SERVICE_ROLE_KEY and DB_URL from the local Supabase stack.'
}
Push-Location $repoRoot
try {
  $e2eJson = & node scripts/release/run-production-e2e.mjs --candidate $CandidateSha
  if ($LASTEXITCODE -ne 0) { throw 'Production authenticated mobile E2E failed. Its unique private evidence directory is retained.' }
  $e2eResult = $e2eJson | ConvertFrom-Json
  if ($e2eResult.result -ne 'passed' -or $e2eResult.candidate_sha -ne $CandidateSha) {
    throw 'Production E2E returned mismatched evidence.'
  }
  $e2eEvidence = & (Join-Path $PSScriptRoot 'assert-production-e2e.ps1') `
    -ManifestPath $e2eResult.manifest_path -CandidateSha $CandidateSha -PassThru
}
finally { Pop-Location }
# A successful suite cannot certify a checkout changed while it was running.
$head = (& git -C $repoRoot rev-parse HEAD).Trim().ToLowerInvariant()
$dirty = & git -C $repoRoot status --porcelain --untracked-files=all
if ($LASTEXITCODE -ne 0 -or $head -ne $CandidateSha -or $dirty) {
  throw 'Candidate checkout changed during the production gate.'
}

$gateDir = Join-Path $repoRoot ".release-evidence\gates\$CandidateSha"
[IO.Directory]::CreateDirectory($gateDir) | Out-Null
$manifestPath = Join-Path $gateDir "gate-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
if (Test-Path -LiteralPath $manifestPath) { throw 'Refusing to overwrite gate evidence.' }
$manifest = [ordered]@{
  version = 2
  candidate_sha = $CandidateSha
  result = 'passed'
  release_approval = 'not_granted'
  deployment_authorized = $false
  created_at = (Get-Date).ToUniversalTime().ToString('o')
  github_checks = $checkEvidence
  migration_catalogue = $catalogue
  backup = [ordered]@{
    path = $backup.backup_path
    plaintext_sha256 = $backup.plaintext_sha256
    credential_locator = $backup.credential_locator
    created_at = $backup.created_at
    original_cold_verification = $backup.cold_verification
    gate_cold_verification = $gateBackupVerification
  }
  authenticated_mobile_e2e = [ordered]@{
    result = 'passed'
    candidate_sha = $CandidateSha
    started_at = $e2eEvidence.started_at
    completed_at = $e2eEvidence.completed_at
    config = $e2eEvidence.config
    build_id = $e2eEvidence.build_id
    manifest_path = $e2eResult.manifest_path
    manifest_sha256 = (Get-FileHash -LiteralPath $e2eResult.manifest_path -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  finalizer_readiness = [ordered]@{
    # Since the ADR-071 addendum this is a real end-to-end finalization: a due
    # session is seeded, finalized, and its results, snapshots, notices, clean
    # job row and non-repetition are asserted.
    result = 'passed-end-to-end-in-database-job'
    test = 'tests/integration/finalizer-readiness.test.ts'
    github_check_id = ($checkEvidence | Where-Object { $_.name -eq 'database' } | Select-Object -First 1).id
  }
}
$null = & (Join-Path $PSScriptRoot 'assert-production-prerequisites.ps1') `
  -GitHubChecks $manifest.github_checks -Backup $manifest.backup -CandidateSha $CandidateSha
$manifestPending = "$manifestPath.pending"
if (Test-Path -LiteralPath $manifestPending) { throw 'Refusing to overwrite pending gate evidence.' }
try {
  $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPending -Encoding UTF8
  Move-Item -LiteralPath $manifestPending -Destination $manifestPath
}
finally {
  if (Test-Path -LiteralPath $manifestPending) { Remove-Item -LiteralPath $manifestPending -Force }
}
Write-Host "Production gate passed for $CandidateSha."
Write-Host "Evidence: $manifestPath"
Write-Host 'No release approval was granted and no deployment was performed.'
