[CmdletBinding()]
param(
  [ValidateSet('gpt-6-astra', 'gpt-5.6-sol')][string]$Model = 'gpt-6-astra',
  [string]$Prompt
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$evidenceDir = Join-Path $repoRoot '.release-evidence\sessions'
[IO.Directory]::CreateDirectory($evidenceDir) | Out-Null
$receiptPath = Join-Path $evidenceDir "codex-$([guid]::NewGuid().ToString('N')).json"
$sha = (& git -C $repoRoot rev-parse HEAD).Trim()
[pscustomobject]@{
  version = 1
  provider = 'codex'
  requested_model = $Model
  reasoning_effort = 'high'
  candidate_sha_at_start = $sha
  launcher = 'scripts/start-production-codex.ps1'
  started_at = (Get-Date).ToUniversalTime().ToString('o')
  nonce = [guid]::NewGuid().ToString('N')
} | ConvertTo-Json | Set-Content -LiteralPath $receiptPath -Encoding UTF8

$previousFlag = $env:KUT_PRODUCTION_SESSION
$previousReceipt = $env:KUT_PRODUCTION_SESSION_RECEIPT
try {
  $env:KUT_PRODUCTION_SESSION = '1'
  $env:KUT_PRODUCTION_SESSION_RECEIPT = $receiptPath
  $arguments = @('-C', $repoRoot, '--model', $Model, '--config', 'model_reasoning_effort="high"')
  if ($Prompt) { $arguments += $Prompt }
  & codex @arguments
  exit $LASTEXITCODE
}
finally {
  $env:KUT_PRODUCTION_SESSION = $previousFlag
  $env:KUT_PRODUCTION_SESSION_RECEIPT = $previousReceipt
}
