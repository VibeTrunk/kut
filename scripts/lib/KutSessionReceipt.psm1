Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Validation of a production agent-session receipt, kept out of
# request-production-gate.ps1 so it can be tested directly. The gate refuses a
# dirty checkout before it ever reads a receipt, which otherwise makes this
# logic unreachable from a test.

function Get-KutReceiptField {
  <#
    .SYNOPSIS
      Reads an optional receipt property without tripping Set-StrictMode.
    .DESCRIPTION
      Set-StrictMode -Version Latest turns a missing property into a
      terminating error. Receipts legitimately differ between providers and
      launcher versions, so optional fields are read through this.
  #>
  param([Parameter(Mandatory)]$Record, [Parameter(Mandatory)][string]$Name)
  $property = $Record.PSObject.Properties[$Name]
  if ($property) { return $property.Value }
  return $null
}

function Assert-KutSessionReceipt {
  <#
    .SYNOPSIS
      Refuses an agent-session receipt that cannot support a production release.
    .OUTPUTS
      'hook-attested' when the runtime proved the model, 'launcher-enforced'
      when it could not and the launcher is the only guarantee.
  #>
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]$Receipt,
    [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{40}$')][string]$CandidateSha,
    [int]$MaxAgeHours = 8
  )

  $provider = Get-KutReceiptField -Record $Receipt -Name 'provider'
  $verifiedAt = Get-KutReceiptField -Record $Receipt -Name 'hook_verified_at'
  $startSha = Get-KutReceiptField -Record $Receipt -Name 'candidate_sha_at_start'
  if ($provider -notin @('codex', 'claude') -or $startSha -ne $CandidateSha -or -not $verifiedAt) {
    throw 'Agent-session evidence is missing, unverified, or belongs to another candidate.'
  }

  $age = (Get-Date).ToUniversalTime() - [datetime]::Parse($verifiedAt).ToUniversalTime()
  if ($age.TotalHours -gt $MaxAgeHours -or $age.TotalSeconds -lt 0) {
    throw 'Agent-session evidence is stale or future-dated.'
  }

  $requested = Get-KutReceiptField -Record $Receipt -Name 'requested_model'
  $observed = Get-KutReceiptField -Record $Receipt -Name 'observed_model'
  $attestation = Get-KutReceiptField -Record $Receipt -Name 'model_attestation'

  if ($provider -eq 'codex') {
    # Codex's hook payload carries the model slug, so the launcher's request and
    # the hook's observation must agree and name an approved model.
    if ($observed -ne $requested -or
        (Get-KutReceiptField -Record $Receipt -Name 'reasoning_effort') -ne 'high' -or
        $observed -notin @('gpt-6-astra', 'gpt-5.6-sol')) {
      throw 'Codex session does not meet the production model/reasoning policy.'
    }
    return 'hook-attested'
  }

  # Claude Code sends `model` to a SessionStart hook only sometimes and cannot
  # abort a session there, so the receipt records which case occurred rather
  # than implying a check that never ran.
  switch ($attestation) {
    'hook' {
      if ($observed -notmatch 'opus') { throw 'Claude session observed a non-Opus model.' }
      return 'hook-attested'
    }
    'unavailable' {
      if ($requested -notmatch 'opus') { throw 'Claude launcher did not request an Opus model.' }
      return 'launcher-enforced'
    }
    default { throw 'Claude session model attestation is missing or rejected.' }
  }
}

Export-ModuleMember -Function Get-KutReceiptField, Assert-KutSessionReceipt
