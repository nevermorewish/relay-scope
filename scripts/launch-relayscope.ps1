$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$launchPage = Join-Path $projectRoot 'assets\windows\relayscope-launching.html'
$restartPage = Join-Path $projectRoot 'assets\windows\relayscope-restarting.html'
$trayScript = Join-Path $PSScriptRoot 'tray-monitor.ps1'
$startScript = Join-Path $PSScriptRoot 'start-monitor.ps1'
$browserScript = Join-Path $PSScriptRoot 'open-browser-tab.ps1'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$monitorUrl = 'http://127.0.0.1:3000'

. $browserScript

function Test-MonitorReady {
  $response = $null
  try {
    $request = [System.Net.HttpWebRequest]::Create("$monitorUrl/api/auth/health")
    $request.Proxy = $null
    $request.Timeout = 300
    $response = $request.GetResponse()
    return [int]$response.StatusCode -eq 200
  } catch {
    return $false
  } finally {
    if ($response) { $response.Dispose() }
  }
}

$waitForRestart = $false
try {
  $stoppingEvent = [System.Threading.EventWaitHandle]::OpenExisting('Local\RelayScopeStopping')
  try {
    $waitForRestart = $stoppingEvent.WaitOne(0)
  } finally {
    $stoppingEvent.Dispose()
  }
} catch [System.Threading.WaitHandleCannotBeOpenedException] {
  $waitForRestart = $false
}

$browserArgument = '-BrowserPending'
if (-not $waitForRestart -and (Test-MonitorReady)) {
  Open-RelayScopeBrowserTab -Url $monitorUrl | Out-Null
  $browserArgument = '-BrowserHandled'
} else {
  $launchTarget = if ($waitForRestart) { $restartPage } else { $launchPage }
  Start-Process `
    -FilePath $powershellPath `
    -ArgumentList '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', "`"$startScript`"", '-NoBrowser' `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden
  Open-RelayScopeBrowserTab -Url $launchTarget | Out-Null
}
Start-Process `
  -FilePath $powershellPath `
  -ArgumentList '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', "`"$trayScript`"", $browserArgument `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden
