$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop -or -not (Test-Path -LiteralPath $desktop)) { exit 0 }

$shell = New-Object -ComObject WScript.Shell
$launcherScript = Join-Path $PSScriptRoot 'launch-relayscope.ps1'
if (-not (Test-Path -LiteralPath $launcherScript)) { exit 0 }

foreach ($legacyName in @('Start RelayScope.lnk', 'Stop RelayScope.lnk')) {
  $legacyPath = Join-Path $desktop $legacyName
  if (Test-Path -LiteralPath $legacyPath) {
    Remove-Item -LiteralPath $legacyPath -Force
  }
}

$shortcut = $shell.CreateShortcut((Join-Path $desktop 'RelayScope.lnk'))
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherScript`""
$shortcut.WorkingDirectory = $projectRoot
$shortcut.WindowStyle = 7
$shortcut.Description = '启动 RelayScope，并通过系统托盘打开或退出'
$shortcut.IconLocation = Join-Path $projectRoot 'assets\windows\relayscope-desktop.ico'
$shortcut.Save()
