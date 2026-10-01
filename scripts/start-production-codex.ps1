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
$receipt = [pscustomobject]@{
  version = 1
  provider = 'codex'
  requested_model = $Model
  reasoning_effort = 'high'
  candidate_sha_at_start = $sha
  launcher = 'scripts/start-production-codex.ps1'
  started_at = (Get-Date).ToUniversalTime().ToString('o')
  nonce = [guid]::NewGuid().ToString('N')
}
# Windows PowerShell 5.1 writes a byte-order mark with -Encoding UTF8, which the
# SessionStart hook's JSON.parse cannot read. Write UTF-8 without one.
[IO.File]::WriteAllText($receiptPath, ($receipt | ConvertTo-Json), (New-Object System.Text.UTF8Encoding $false))

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
