$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$monitorUrl = 'http://127.0.0.1:3000'
$launcherMutex = [System.Threading.Mutex]::new($false, 'Local\RelayMonitorLauncher')
$hasLauncherLock = $false

function Test-MonitorReady {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $monitorUrl -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

try {
  $hasLauncherLock = $launcherMutex.WaitOne(30000)
  if (-not $hasLauncherLock) { exit 1 }

  if (-not (Test-MonitorReady)) {
    $nextCommand = Join-Path $projectRoot 'node_modules\.bin\next.CMD'
    if (-not (Test-Path -LiteralPath $nextCommand)) {
      Add-Type -AssemblyName PresentationFramework
      [System.Windows.MessageBox]::Show(
        'Project dependencies are missing. The monitor cannot start.',
        'Relay Monitor',
        'OK',
        'Error'
      ) | Out-Null
      exit 1
    }

    Start-Process -FilePath $nextCommand -ArgumentList 'dev', '-H', '127.0.0.1' -WorkingDirectory $projectRoot -WindowStyle Hidden

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
      Start-Sleep -Seconds 1
      if (Test-MonitorReady) {
        $ready = $true
        break
      }
    }

    if (-not $ready) {
      Add-Type -AssemblyName PresentationFramework
      [System.Windows.MessageBox]::Show(
        'The monitor took too long to start. Please try again.',
        'Relay Monitor',
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
