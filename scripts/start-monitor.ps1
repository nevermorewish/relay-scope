param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$monitorUrl = 'http://127.0.0.1:3000'
$pidPath = Join-Path $projectRoot '.relayscope.pid'
$launcherMutex = [System.Threading.Mutex]::new($false, 'Local\RelayScopeLauncher')
$hasLauncherLock = $false

function Test-MonitorReady {
  $response = $null
  $reader = $null
  try {
    $request = [System.Net.HttpWebRequest]::Create($monitorUrl)
    $request.Proxy = $null
    $request.Timeout = 750
    $response = $request.GetResponse()
    $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
    $content = $reader.ReadToEnd()
    return [int]$response.StatusCode -eq 200 -and $content -match 'RelayScope'
  } catch {
    return $false
  } finally {
    if ($reader) { $reader.Dispose() }
    if ($response) { $response.Dispose() }
  }
}

function Get-RelayScopeListener {
  $netstatPath = Join-Path $env:SystemRoot 'System32\netstat.exe'
  $listenerIds = & $netstatPath -ano -p tcp 2>$null | ForEach-Object {
    if ($_ -match '^\s*TCP\s+\S+:3000\s+\S+\s+LISTENING\s+(\d+)\s*$') {
      [int]$Matches[1]
    }
  }
  foreach ($listenerId in $listenerIds) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$listenerId" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -and
        $process.CommandLine.IndexOf($projectRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        $process.CommandLine -match 'next|node_modules') {
      return $process
    }
  }
  return $null
}

function Save-RelayScopePid {
  $listener = Get-RelayScopeListener
  if ($listener) {
    [System.IO.File]::WriteAllText(
      $pidPath,
      [string]$listener.ProcessId,
      [System.Text.Encoding]::ASCII
    )
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
    $startupTimer = [System.Diagnostics.Stopwatch]::StartNew()
    while ($startupTimer.Elapsed.TotalSeconds -lt 45) {
      if (Test-MonitorReady) {
        $ready = $true
        break
      }
      Start-Sleep -Milliseconds 200
    }
    $startupTimer.Stop()

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

  Save-RelayScopePid
  if (-not $NoBrowser) {
    Start-Process $monitorUrl
  }
} finally {
  if ($hasLauncherLock) { $launcherMutex.ReleaseMutex() }
  $launcherMutex.Dispose()
}
