[CmdletBinding()]
param([string]$Prompt)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$evidenceDir = Join-Path $repoRoot '.release-evidence\sessions'
[IO.Directory]::CreateDirectory($evidenceDir) | Out-Null
$receiptPath = Join-Path $evidenceDir "claude-$([guid]::NewGuid().ToString('N')).json"
$sha = (& git -C $repoRoot rev-parse HEAD).Trim()
[pscustomobject]@{
  version = 1
  provider = 'claude'
  requested_model = 'opus'
  reasoning_effort = 'vendor-managed'
  candidate_sha_at_start = $sha
  launcher = 'scripts/start-production-claude.ps1'
  started_at = (Get-Date).ToUniversalTime().ToString('o')
  nonce = [guid]::NewGuid().ToString('N')
} | ConvertTo-Json | Set-Content -LiteralPath $receiptPath -Encoding UTF8

$previousFlag = $env:KUT_PRODUCTION_SESSION
$previousReceipt = $env:KUT_PRODUCTION_SESSION_RECEIPT
try {
  $env:KUT_PRODUCTION_SESSION = '1'
  $env:KUT_PRODUCTION_SESSION_RECEIPT = $receiptPath
  $arguments = @('--model', 'opus')
  if ($Prompt) { $arguments += $Prompt }
  Push-Location $repoRoot
  try { & claude @arguments; exit $LASTEXITCODE }
  finally { Pop-Location }
}
finally {
  $env:KUT_PRODUCTION_SESSION = $previousFlag
  $env:KUT_PRODUCTION_SESSION_RECEIPT = $previousReceipt
}
