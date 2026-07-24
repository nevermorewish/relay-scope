param([switch]$Quiet)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $projectRoot '.relayscope.pid'
$launcherMutex = [System.Threading.Mutex]::new($false, 'Local\RelayScopeLauncher')
$hasLauncherLock = $false

function Show-RelayScopeMessage {
  param(
    [string]$Message,
    [string]$Icon = 'Information'
  )

  if ($Quiet) { return }
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    $Message,
    'RelayScope',
    'OK',
    $Icon
  ) | Out-Null
}

function Test-RelayScopeListener {
  param([int]$ProcessId)

  $connection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess -eq $ProcessId } |
    Select-Object -First 1
  if (-not $connection) { return $false }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
  return $process -and $process.CommandLine -and
    $process.CommandLine.IndexOf($projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $process.CommandLine -match 'next|node_modules'
}

function Find-RelayScopeListenerId {
  if (Test-Path -LiteralPath $pidPath) {
    $storedPid = 0
    if ([int]::TryParse(([System.IO.File]::ReadAllText($pidPath).Trim()), [ref]$storedPid) -and
        (Test-RelayScopeListener -ProcessId $storedPid)) {
      return $storedPid
    }
  }

  $connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    if (Test-RelayScopeListener -ProcessId $connection.OwningProcess) {
      return [int]$connection.OwningProcess
    }
  }
  return 0
}

try {
  $hasLauncherLock = $launcherMutex.WaitOne(30000)
  if (-not $hasLauncherLock) { exit 1 }

  $listenerId = Find-RelayScopeListenerId
  if (-not $listenerId) {
    if (Test-Path -LiteralPath $pidPath) { Remove-Item -LiteralPath $pidPath -Force }
    Show-RelayScopeMessage 'RelayScope is not running.'
    exit 0
  }

  $listener = Get-CimInstance Win32_Process -Filter "ProcessId=$listenerId" -ErrorAction SilentlyContinue
  $parent = if ($listener) {
    Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.ParentProcessId)" -ErrorAction SilentlyContinue
  } else {
    $null
  }

  Stop-Process -Id $listenerId -Force -ErrorAction Stop
  if ($parent -and $parent.CommandLine -and
      $parent.CommandLine.IndexOf($projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
      $parent.CommandLine -match 'next|node_modules') {
    Stop-Process -Id $parent.ProcessId -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path -LiteralPath $pidPath) { Remove-Item -LiteralPath $pidPath -Force }
  Show-RelayScopeMessage 'RelayScope has stopped. Automatic monitoring is now off.'
} catch {
  Show-RelayScopeMessage "RelayScope could not be stopped: $($_.Exception.Message)" 'Error'
  exit 1
} finally {
  if ($hasLauncherLock) { $launcherMutex.ReleaseMutex() }
  $launcherMutex.Dispose()
}
