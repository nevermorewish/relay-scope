$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$monitorUrl = 'http://127.0.0.1:3000'
$launcherMutex = [System.Threading.Mutex]::new($false, 'Local\RelayMonitorLauncher')
$hasLauncherLock = $false

function Test-MonitorReady {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $monitorUrl -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match 'RelayScope'
  } catch {
    return $false
  }
}

try {
  $hasLauncherLock = $launcherMutex.WaitOne(30000)
  if (-not $hasLauncherLock) { exit 1 }

  if (-not (Test-MonitorReady)) {
    $nextCommand = Join-Path $projectRoot 'node_modules\.bin\next.CMD'
    $buildIdPath = Join-Path $projectRoot '.next\BUILD_ID'
    if (-not (Test-Path -LiteralPath $nextCommand) -or -not (Test-Path -LiteralPath $buildIdPath)) {
      Add-Type -AssemblyName PresentationFramework
      [System.Windows.MessageBox]::Show(
        'First-time setup is incomplete. Run "Setup RelayScope.cmd" first.',
        'RelayScope',
        'OK',
        'Error'
      ) | Out-Null
      exit 1
    }

    Start-Process -FilePath $nextCommand -ArgumentList 'start', '-H', '127.0.0.1', '-p', '3000' -WorkingDirectory $projectRoot -WindowStyle Hidden

    $ready = $false
    for ($attempt = 0; $attempt -lt 45; $attempt += 1) {
      Start-Sleep -Seconds 1
      if (Test-MonitorReady) {
        $ready = $true
        break
      }
    }

    if (-not $ready) {
      Add-Type -AssemblyName PresentationFramework
      [System.Windows.MessageBox]::Show(
        'RelayScope took too long to start. Check whether port 3000 is already in use, then try again.',
        'RelayScope',
        'OK',
        'Error'
      ) | Out-Null
      exit 1
    }
  }

  Start-Process $monitorUrl
} finally {
  if ($hasLauncherLock) { $launcherMutex.ReleaseMutex() }
  $launcherMutex.Dispose()
}
