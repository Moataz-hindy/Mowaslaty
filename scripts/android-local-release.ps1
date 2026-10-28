[CmdletBinding()]
param(
  [switch]$PrepareOnly,
  [switch]$Release,
  [switch]$RepairMetadata,
  [string]$Version = '1.0.0',
  [int]$VersionCode = 1,
  [string]$SigningDirectory = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
if ($PrepareOnly -and $Release) { throw 'Choose either -PrepareOnly or -Release.' }
if ($RepairMetadata -and (-not $PrepareOnly -or $Release)) { throw 'Use -RepairMetadata together with -PrepareOnly so the recovered key can be validated and prepared.' }
if (-not $PrepareOnly -and -not $Release) { throw 'Choose -PrepareOnly to initialize/prepare, or -Release after native adapter review.' }
if (-not $IsWindows -and $PSVersionTable.PSVersion.Major -ge 6) { throw 'This helper requires Windows CurrentUser DPAPI.' }

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($SigningDirectory) { $signingRoot = [System.IO.Path]::GetFullPath($SigningDirectory) }
else { $signingRoot = Join-Path $env:LOCALAPPDATA 'Mowaslaty/Signing' }
$keyPath = Join-Path $signingRoot 'mowaslaty-release.jks'
$storeSecretPath = Join-Path $signingRoot 'keystore-password.dpapi'
$keySecretPath = Join-Path $signingRoot 'key-password.dpapi'
$metadataPath = Join-Path $signingRoot 'public-metadata.json'
$alias = 'mowaslaty-release'
$envNames = @('ANDROID_KEYSTORE_PATH','ANDROID_KEYSTORE_PASSWORD','ANDROID_KEY_ALIAS','ANDROID_KEY_PASSWORD','ANDROID_VERSION','ANDROID_VERSION_CODE','ANDROID_SDK_ROOT','ANDROID_HOME','JAVA_HOME')
$oldEnv = @{}
foreach ($name in $envNames) { $oldEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

function Set-PrivateDirectory([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { $null = New-Item -ItemType Directory -Path $Path }
  elseif ((Get-Item -LiteralPath $Path -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Signing directory must not be a symbolic link or reparse point.' }
  $acl = [System.IO.Directory]::GetAccessControl($Path)
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($rule in @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))) { $null = $acl.RemoveAccessRuleSpecific($rule) }
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
  [System.IO.Directory]::SetAccessControl($Path, $acl)
}

function New-RandomPassword {
  $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+'
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $chars = [System.Collections.Generic.List[char]]::new()
  try {
    while ($chars.Count -lt 40) {
      $bytes = [byte[]]::new(64)
      $rng.GetBytes($bytes)
      foreach ($byte in $bytes) {
        $limit = [math]::Floor(256 / $alphabet.Length) * $alphabet.Length
        if ($byte -lt $limit) { $chars.Add($alphabet[$byte % $alphabet.Length]) }
        if ($chars.Count -eq 40) { break }
      }
    }
    return -join $chars
  } finally { $rng.Dispose() }
}

function Save-DpapiSecret([string]$Secret, [string]$Path) {
  $plainBytes = [System.Text.Encoding]::UTF8.GetBytes($Secret)
  $protectedBytes = $null
  try {
    $protectedBytes = [System.Security.Cryptography.ProtectedData]::Protect($plainBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [System.IO.File]::WriteAllText($Path, [Convert]::ToBase64String($protectedBytes), [System.Text.Encoding]::ASCII)
  } finally {
    [Array]::Clear($plainBytes, 0, $plainBytes.Length)
    if ($protectedBytes) { [Array]::Clear($protectedBytes, 0, $protectedBytes.Length) }
  }
}

function Read-DpapiSecret([string]$Path) {
  $ciphertext = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::ASCII)
  $protectedBytes = $null
  $plainBytes = $null
  try {
    $protectedBytes = [Convert]::FromBase64String($ciphertext)
    $plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect($protectedBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    return [System.Text.Encoding]::UTF8.GetString($plainBytes)
  } catch { throw 'Unable to decrypt local signing credentials for this Windows user.' }
  finally {
    if ($protectedBytes) { [Array]::Clear($protectedBytes, 0, $protectedBytes.Length) }
    if ($plainBytes) { [Array]::Clear($plainBytes, 0, $plainBytes.Length) }
  }
}

function Protect-LogText([string]$Text) {
  foreach ($secret in $script:SensitiveValues) {
    if ($secret -and $secret.Length -ge 8) { $Text = $Text.Replace($secret, '[REDACTED]') }
  }
  return $Text
}

function Invoke-Checked([string]$Exe, [string[]]$Arguments, [string]$Failure, [string]$LogName) {
  $lines = [System.Collections.Generic.List[string]]::new()
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $Exe @Arguments 2>&1 | ForEach-Object { $lines.Add($_.ToString()) } }
  finally { $ErrorActionPreference = $previousPreference }
  $status = $LASTEXITCODE
  $safeLines = @($lines | ForEach-Object { Protect-LogText $_ })
  $logDir = Join-Path $repo '.superpowers/sdd/apk-release/logs'
  $null = New-Item -ItemType Directory -Path $logDir -Force
  $logPath = Join-Path $logDir "$LogName.log"
  [System.IO.File]::WriteAllLines($logPath, $safeLines, [System.Text.Encoding]::UTF8)
  $tail = @($safeLines | Select-Object -Last 30)
  if ($tail.Count) { $tail | ForEach-Object { [Console]::WriteLine((Protect-LogText $_)) } }
  if ($status -ne 0) { throw "$Failure See sanitized log: $logPath" }
}

function Get-KeytoolDetails([string]$KeytoolPath) {
  $start = [System.Diagnostics.ProcessStartInfo]::new()
  $start.FileName = $KeytoolPath
  $start.Arguments = "-list -v -keystore `"$keyPath`" -storepass:env ANDROID_KEYSTORE_PASSWORD -alias $alias"
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $start
  try {
    $null = $process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return @{ ExitCode = $process.ExitCode; Text = "$stdout`n$stderr" }
  } finally { $process.Dispose() }
}

$failed = $false
try {
  if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is unavailable.' }
  if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Users\moata\.jdks\jbr-21.0.11' }
  $javaExe = Join-Path $env:JAVA_HOME 'bin/java.exe'
  if (-not (Test-Path -LiteralPath $javaExe)) { throw 'Configured JDK 21 was not found.' }
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $javaVersion = & $javaExe '-version' 2>&1 | Out-String }
  finally { $ErrorActionPreference = $previousPreference }
  $majorMatch = [regex]::Match($javaVersion, '\b(\d+)\b')
  if ($majorMatch.Success) { Write-Output "Detected Java major version $($majorMatch.Groups[1].Value)." }
  else { Write-Output 'Could not parse the Java version output.' }
  if (-not $majorMatch.Success -or [int]$majorMatch.Groups[1].Value -ne 21) { throw 'The configured Java runtime must be JDK 21.' }
  $expectedFiles = @('mowaslaty-release.jks','keystore-password.dpapi','key-password.dpapi','public-metadata.json')
  $hasSigningState = Test-Path -LiteralPath $signingRoot
  if ($hasSigningState) {
    if ((Get-Item -LiteralPath $signingRoot -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Signing directory must not be a symbolic link or reparse point.' }
    $present = @(Get-ChildItem -LiteralPath $signingRoot -Force | ForEach-Object Name | Sort-Object)
    $expected = @($expectedFiles | Sort-Object)
    if ($present.Count -eq 0) {
      if ($RepairMetadata) { throw 'No partial release key state exists to repair.' }
      if (-not $PrepareOnly) { throw 'Signing directory is empty. Run -PrepareOnly to initialize a new key.' }
      Set-PrivateDirectory $signingRoot
      $hasSigningState = $false
    } else {
      $expectedWithoutMetadata = @($expectedFiles | Where-Object { $_ -ne 'public-metadata.json' } | Sort-Object)
      $partialMetadataState = -not (Compare-Object $expectedWithoutMetadata $present) -and -not (Test-Path -LiteralPath $metadataPath)
      if ($partialMetadataState) {
        if (-not $RepairMetadata) { throw 'Release key exists without public metadata. Run -RepairMetadata -PrepareOnly to recover metadata without changing the key.' }
        $env:ANDROID_KEYSTORE_PASSWORD = Read-DpapiSecret $storeSecretPath
        $script:SensitiveValues = @($env:ANDROID_KEYSTORE_PASSWORD)
        $keytool = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
        $details = Get-KeytoolDetails $keytool
        if ($details.ExitCode -ne 0) { throw "Unable to inspect the existing release certificate (keytool exit $($details.ExitCode))." }
        $recoveredFingerprint = [regex]::Match($details.Text, '(?im)^\s*SHA256:\s*([A-F0-9:]{64,})\s*$').Groups[1].Value -replace ':',''
        if ($recoveredFingerprint.Length -ne 64) { throw 'The existing key certificate did not yield a SHA-256 fingerprint; key and credentials were preserved.' }
        $recovered = [ordered]@{ alias = $alias; keyStore = $keyPath; certificateSha256 = $recoveredFingerprint }
        [System.IO.File]::WriteAllText($metadataPath, ($recovered | ConvertTo-Json), [System.Text.Encoding]::UTF8)
        $present = @($present + 'public-metadata.json' | Sort-Object)
      }
      if (Compare-Object $expected $present) { throw "Signing directory is incomplete or contains unexpected entries ($($present -join ', ')); refusing to overwrite or regenerate credentials." }
      foreach ($file in $expectedFiles) { if (-not (Test-Path -LiteralPath (Join-Path $signingRoot $file) -PathType Leaf)) { throw 'Signing state is incomplete; refusing to overwrite or regenerate credentials.' } }
      $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
      if ($metadata.alias -ne $alias -or $metadata.keyStore -ne $keyPath -or -not $metadata.certificateSha256) { throw 'Signing metadata is incomplete; refusing to use this key state.' }
      $env:ANDROID_KEYSTORE_PASSWORD = Read-DpapiSecret $storeSecretPath
      $keytool = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
      $details = Get-KeytoolDetails $keytool
      if ($details.ExitCode -ne 0) { throw "Unable to inspect the existing release certificate (keytool exit $($details.ExitCode))." }
      $fingerprint = [regex]::Match($details.Text, '(?im)^\s*SHA256:\s*([A-F0-9:]{64,})\s*$').Groups[1].Value -replace ':',''
      if ($fingerprint -ne $metadata.certificateSha256) { throw 'Stored certificate fingerprint does not match the protected release key.' }
    }
  }
  if (-not $hasSigningState) {
    if (-not $PrepareOnly) { throw 'No local release key exists. Run -PrepareOnly first.' }
    if (-not (Test-Path -LiteralPath $signingRoot)) { Set-PrivateDirectory $signingRoot }
    $password = New-RandomPassword
    try {
      Save-DpapiSecret $password $storeSecretPath
      Save-DpapiSecret $password $keySecretPath
      $env:ANDROID_KEYSTORE_PASSWORD = $password
      $env:ANDROID_KEY_PASSWORD = $password
      $script:SensitiveValues = @($password)
      $env:ANDROID_KEYSTORE_PATH = $keyPath
      $env:ANDROID_KEY_ALIAS = $alias
      $keytool = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
      if (-not (Test-Path -LiteralPath $keytool)) { throw 'JDK 21 keytool.exe was not found.' }
      Invoke-Checked $keytool @('-genkeypair','-v','-keystore',$keyPath,'-storetype','JKS','-storepass:env','ANDROID_KEYSTORE_PASSWORD','-keypass:env','ANDROID_KEY_PASSWORD','-alias',$alias,'-keyalg','RSA','-keysize','4096','-validity','10000','-dname','CN=Mowaslaty Android Release, OU=Mobile, O=Mowaslaty, C=EG') 'Release key generation failed.' 'keygen'
      $details = Get-KeytoolDetails $keytool
      if ($details.ExitCode -ne 0) { throw "Unable to inspect the newly created release certificate (keytool exit $($details.ExitCode))." }
      $fingerprint = [regex]::Match($details.Text, '(?im)^\s*SHA256:\s*([A-F0-9:]{64,})\s*$').Groups[1].Value -replace ':',''
      if ($fingerprint.Length -ne 64) { throw 'Certificate fingerprint was not available; key state is preserved for manual recovery.' }
      $metadata = [ordered]@{ alias = $alias; keyStore = $keyPath; certificateSha256 = $fingerprint }
      [System.IO.File]::WriteAllText($metadataPath, ($metadata | ConvertTo-Json), [System.Text.Encoding]::UTF8)
    } finally { $password = $null }
  }

  if (-not $env:ANDROID_SDK_ROOT -and $env:ANDROID_HOME) { $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME }
  if (-not $env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
  $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
  if ($Version -notmatch '^[0-9]+(?:\.[0-9A-Za-z-]+)*$' -or $VersionCode -lt 1) { throw 'Version must be valid and version code must be a positive integer.' }
  $env:ANDROID_VERSION = $Version
  $env:ANDROID_VERSION_CODE = [string]$VersionCode
  $env:ANDROID_KEYSTORE_PATH = $keyPath
  $env:ANDROID_KEY_ALIAS = $alias
  $env:ANDROID_KEYSTORE_PASSWORD = Read-DpapiSecret $storeSecretPath
  $env:ANDROID_KEY_PASSWORD = Read-DpapiSecret $keySecretPath
  $script:SensitiveValues = @($env:ANDROID_KEYSTORE_PASSWORD, $env:ANDROID_KEY_PASSWORD)

  if ($PrepareOnly) {
    Push-Location (Join-Path $repo 'android')
    try { Invoke-Checked '.\gradlew.bat' @('--no-daemon','compileReleaseJavaWithJavac') 'Android Java bootstrap failed. Review SDK license prompts; this helper never accepts licenses.' 'prepare-gradle' }
    finally { Pop-Location }
    Write-Output 'Android signing state and native Java build prerequisites are ready. No APK was assembled or published.'
  } else {
    Push-Location $repo
    try { Invoke-Checked 'npm.cmd' @('run','android:release') 'Signed APK release failed; existing public manifest was not intentionally changed by this helper.' 'release' }
    finally { Pop-Location }
    Write-Output 'Signed APK release build and local publication completed.'
  }
} catch {
  [Console]::Error.WriteLine("Android local release helper failed: $($_.Exception.Message)")
  $failed = $true
} finally {
  foreach ($name in $envNames) { [Environment]::SetEnvironmentVariable($name, $oldEnv[$name], 'Process') }
}
if ($failed) { exit 1 }
