[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'lib\KutSessionReceipt.psm1') -Force

$sha = 'a' * 40
$script:checks = 0

function New-Receipt {
  param([hashtable]$Overrides = @{})
  $base = @{
    version = 1
    provider = 'codex'
    requested_model = 'gpt-6-astra'
    observed_model = 'gpt-6-astra'
    model_attestation = 'hook'
    reasoning_effort = 'high'
    candidate_sha_at_start = $sha
    hook_verified_at = (Get-Date).ToUniversalTime().ToString('o')
  }
  foreach ($key in $Overrides.Keys) {
    if ($null -eq $Overrides[$key]) { $base.Remove($key) } else { $base[$key] = $Overrides[$key] }
  }
  return [pscustomobject]$base
}

# PowerShell's hashtable `+` operator throws on a duplicate key, so the Claude
# cases merge rather than add.
function Merge-Hash {
  param([hashtable]$Base, [hashtable]$Extra)
  $merged = @{}
  foreach ($key in $Base.Keys) { $merged[$key] = $Base[$key] }
  foreach ($key in $Extra.Keys) { $merged[$key] = $Extra[$key] }
  return $merged
}

function Assert-Accepted {
  param([Parameter(Mandatory)]$Receipt, [Parameter(Mandatory)][string]$Expected, [Parameter(Mandatory)][string]$Because)
  $actual = Assert-KutSessionReceipt -Receipt $Receipt -CandidateSha $sha
  if ($actual -ne $Expected) { throw "Expected '$Expected' but got '$actual': $Because" }
  $script:checks++
}

function Assert-Refused {
  param([Parameter(Mandatory)]$Receipt, [Parameter(Mandatory)][string]$Because)
  try {
    Assert-KutSessionReceipt -Receipt $Receipt -CandidateSha $sha | Out-Null
    throw "Expected a refusal: $Because"
  }
  catch {
    if ($_.Exception.Message -like 'Expected a refusal*') { throw }
    $script:checks++
  }
}

# --- Codex: the payload carries the slug, so this is a real attestation ------
Assert-Accepted -Receipt (New-Receipt) -Expected 'hook-attested' -Because 'a complete Codex receipt is accepted'
Assert-Accepted -Receipt (New-Receipt @{ requested_model = 'gpt-5.6-sol'; observed_model = 'gpt-5.6-sol' }) `
  -Expected 'hook-attested' -Because 'the approved Codex fallback is accepted'
Assert-Refused -Receipt (New-Receipt @{ observed_model = 'gpt-5.5' }) -Because 'the observed model must match what the launcher requested'
Assert-Refused -Receipt (New-Receipt @{ requested_model = 'gpt-5.5'; observed_model = 'gpt-5.5' }) -Because 'an unapproved model is refused even when both agree'
Assert-Refused -Receipt (New-Receipt @{ reasoning_effort = 'medium' }) -Because 'reasoning effort below high is refused'
Assert-Refused -Receipt (New-Receipt @{ reasoning_effort = $null }) -Because 'a missing reasoning effort is refused, not defaulted'
# A Codex receipt written before model_attestation existed must still validate
# on its own terms rather than blowing up on the missing property.
Assert-Accepted -Receipt (New-Receipt @{ model_attestation = $null }) -Expected 'hook-attested' `
  -Because 'a Codex receipt without the attestation field is judged on its model fields'

# --- Claude: SessionStart may or may not report a model ----------------------
$claude = @{ provider = 'claude'; requested_model = 'opus'; reasoning_effort = 'vendor-managed' }
Assert-Accepted -Receipt (New-Receipt (Merge-Hash $claude @{ observed_model = 'claude-opus-5'; model_attestation = 'hook' })) `
  -Expected 'hook-attested' -Because 'an observed Opus model is a real attestation'
Assert-Accepted -Receipt (New-Receipt (Merge-Hash $claude @{ observed_model = $null; model_attestation = 'unavailable' })) `
  -Expected 'launcher-enforced' -Because 'an unreported model falls back to launcher enforcement, labelled as such'
Assert-Refused -Receipt (New-Receipt (Merge-Hash $claude @{ observed_model = 'claude-haiku-4-5'; model_attestation = 'rejected' })) `
  -Because 'a model the hook saw and rejected fails closed'
Assert-Refused -Receipt (New-Receipt (Merge-Hash $claude @{ observed_model = 'claude-haiku-4-5'; model_attestation = 'hook' })) `
  -Because 'a non-Opus model cannot claim a hook attestation'
Assert-Refused -Receipt (New-Receipt (Merge-Hash $claude @{ observed_model = $null; model_attestation = $null })) `
  -Because 'a missing attestation fails closed rather than being treated as unavailable'
Assert-Refused -Receipt (New-Receipt (Merge-Hash $claude @{ model_attestation = 'something-else' })) `
  -Because 'an unrecognised attestation value fails closed'
Assert-Refused -Receipt (New-Receipt (Merge-Hash $claude @{ requested_model = 'sonnet'; observed_model = $null; model_attestation = 'unavailable' })) `
  -Because 'launcher enforcement is worthless if the launcher did not request Opus'

# --- Candidate binding and freshness, both providers -------------------------
Assert-Refused -Receipt (New-Receipt @{ candidate_sha_at_start = 'b' * 40 }) -Because 'a receipt for another candidate is refused'
Assert-Refused -Receipt (New-Receipt @{ candidate_sha_at_start = $null }) -Because 'a receipt naming no candidate is refused'
Assert-Refused -Receipt (New-Receipt @{ provider = 'some-other-agent' }) -Because 'an unknown provider is refused'
Assert-Refused -Receipt (New-Receipt @{ provider = $null }) -Because 'a receipt with no provider is refused'
Assert-Refused -Receipt (New-Receipt @{ hook_verified_at = $null }) -Because 'a receipt the hook never verified is refused'
Assert-Refused -Receipt (New-Receipt @{ hook_verified_at = (Get-Date).ToUniversalTime().AddHours(-9).ToString('o') }) `
  -Because 'evidence older than the freshness window is refused'
Assert-Refused -Receipt (New-Receipt @{ hook_verified_at = (Get-Date).ToUniversalTime().AddHours(2).ToString('o') }) `
  -Because 'future-dated evidence is refused'

Write-Host "Session-receipt validation tests passed ($script:checks assertions)."
