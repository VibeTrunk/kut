[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet("Encrypt", "Decrypt")]
  [string]$Mode,

  [Parameter(Mandatory)]
  [string]$InputPath,

  [Parameter(Mandatory)]
  [string]$OutputPath,

  [Parameter(Mandatory)]
  [System.Security.SecureString]$Passphrase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$magic = [System.Text.Encoding]::ASCII.GetBytes("KUTBKP01")
$saltLength = 32
$ivLength = 16
$tagLength = 32
$iterations = 600000

function Get-PlaintextPassphrase {
  param([System.Security.SecureString]$SecureValue)

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Test-FixedTimeEqual {
  param([byte[]]$Left, [byte[]]$Right)

  if ($Left.Length -ne $Right.Length) {
    return $false
  }

  $difference = 0
  for ($index = 0; $index -lt $Left.Length; $index++) {
    $difference = $difference -bor ($Left[$index] -bxor $Right[$index])
  }
  return $difference -eq 0
}

if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
  throw "Input file was not found."
}
if (Test-Path -LiteralPath $OutputPath) {
  throw "Refusing to overwrite an existing output file."
}

$plainPassphrase = Get-PlaintextPassphrase -SecureValue $Passphrase
try {
  $inputBytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $InputPath))

  if ($Mode -eq "Encrypt") {
    $salt = New-Object byte[] $saltLength
    $iv = New-Object byte[] $ivLength
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $random.GetBytes($salt)
      $random.GetBytes($iv)
    }
    finally {
      $random.Dispose()
    }

    $derivation = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($plainPassphrase, $salt, $iterations)
    try {
      $keyMaterial = $derivation.GetBytes(64)
    }
    finally {
      $derivation.Dispose()
    }

    $encryptionKey = New-Object byte[] 32
    $authenticationKey = New-Object byte[] 32
    [System.Buffer]::BlockCopy($keyMaterial, 0, $encryptionKey, 0, 32)
    [System.Buffer]::BlockCopy($keyMaterial, 32, $authenticationKey, 0, 32)

    $aes = [System.Security.Cryptography.Aes]::Create()
    try {
      $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
      $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
      $aes.Key = $encryptionKey
      $aes.IV = $iv
      $ciphertext = $aes.CreateEncryptor().TransformFinalBlock($inputBytes, 0, $inputBytes.Length)
    }
    finally {
      $aes.Dispose()
    }

    $header = New-Object byte[] ($magic.Length + $salt.Length + $iv.Length)
    [System.Buffer]::BlockCopy($magic, 0, $header, 0, $magic.Length)
    [System.Buffer]::BlockCopy($salt, 0, $header, $magic.Length, $salt.Length)
    [System.Buffer]::BlockCopy($iv, 0, $header, $magic.Length + $salt.Length, $iv.Length)

    $authenticatedBytes = New-Object byte[] ($header.Length + $ciphertext.Length)
    [System.Buffer]::BlockCopy($header, 0, $authenticatedBytes, 0, $header.Length)
    [System.Buffer]::BlockCopy($ciphertext, 0, $authenticatedBytes, $header.Length, $ciphertext.Length)
    $hmac = [System.Security.Cryptography.HMACSHA256]::new($authenticationKey)
    try {
      $tag = $hmac.ComputeHash($authenticatedBytes)
    }
    finally {
      $hmac.Dispose()
    }

    $outputBytes = New-Object byte[] ($authenticatedBytes.Length + $tag.Length)
    [System.Buffer]::BlockCopy($authenticatedBytes, 0, $outputBytes, 0, $authenticatedBytes.Length)
    [System.Buffer]::BlockCopy($tag, 0, $outputBytes, $authenticatedBytes.Length, $tag.Length)
    [System.IO.File]::WriteAllBytes($OutputPath, $outputBytes)
  }
  else {
    $minimumLength = $magic.Length + $saltLength + $ivLength + $tagLength + 1
    if ($inputBytes.Length -lt $minimumLength) {
      throw "Backup file is too short."
    }
    for ($index = 0; $index -lt $magic.Length; $index++) {
      if ($inputBytes[$index] -ne $magic[$index]) {
        throw "Backup file has an unknown format."
      }
    }

    $salt = New-Object byte[] $saltLength
    $iv = New-Object byte[] $ivLength
    [System.Buffer]::BlockCopy($inputBytes, $magic.Length, $salt, 0, $saltLength)
    [System.Buffer]::BlockCopy($inputBytes, $magic.Length + $saltLength, $iv, 0, $ivLength)
    $authenticatedLength = $inputBytes.Length - $tagLength
    $authenticatedBytes = New-Object byte[] $authenticatedLength
    $storedTag = New-Object byte[] $tagLength
    [System.Buffer]::BlockCopy($inputBytes, 0, $authenticatedBytes, 0, $authenticatedLength)
    [System.Buffer]::BlockCopy($inputBytes, $authenticatedLength, $storedTag, 0, $tagLength)

    $derivation = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($plainPassphrase, $salt, $iterations)
    try {
      $keyMaterial = $derivation.GetBytes(64)
    }
    finally {
      $derivation.Dispose()
    }
    $encryptionKey = New-Object byte[] 32
    $authenticationKey = New-Object byte[] 32
    [System.Buffer]::BlockCopy($keyMaterial, 0, $encryptionKey, 0, 32)
    [System.Buffer]::BlockCopy($keyMaterial, 32, $authenticationKey, 0, 32)
    $hmac = [System.Security.Cryptography.HMACSHA256]::new($authenticationKey)
    try {
      $computedTag = $hmac.ComputeHash($authenticatedBytes)
    }
    finally {
      $hmac.Dispose()
    }
    if (-not (Test-FixedTimeEqual -Left $storedTag -Right $computedTag)) {
      throw "Backup authentication failed. The passphrase or file is incorrect."
    }

    $ciphertextLength = $authenticatedLength - $magic.Length - $saltLength - $ivLength
    $ciphertext = New-Object byte[] $ciphertextLength
    [System.Buffer]::BlockCopy($authenticatedBytes, $magic.Length + $saltLength + $ivLength, $ciphertext, 0, $ciphertextLength)
    $aes = [System.Security.Cryptography.Aes]::Create()
    try {
      $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
      $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
      $aes.Key = $encryptionKey
      $aes.IV = $iv
      $outputBytes = $aes.CreateDecryptor().TransformFinalBlock($ciphertext, 0, $ciphertext.Length)
    }
    finally {
      $aes.Dispose()
    }
    [System.IO.File]::WriteAllBytes($OutputPath, $outputBytes)
  }
}
finally {
  $plainPassphrase = $null
}
