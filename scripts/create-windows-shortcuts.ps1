$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop -or -not (Test-Path -LiteralPath $desktop)) { exit 0 }

$shell = New-Object -ComObject WScript.Shell
$shortcuts = @(
  @{
    Name = 'Start RelayScope.lnk'
    Target = 'Start RelayScope.cmd'
    Description = 'Start RelayScope and open the dashboard'
    Icon = (Join-Path $projectRoot 'assets\windows\relayscope-start-desktop-full.ico')
  },
  @{
    Name = 'Stop RelayScope.lnk'
    Target = 'Stop RelayScope.cmd'
    Description = 'Stop RelayScope and automatic monitoring'
    Icon = (Join-Path $projectRoot 'assets\windows\relayscope-stop-desktop-full.ico')
  }
)

foreach ($definition in $shortcuts) {
  $targetPath = Join-Path $projectRoot $definition.Target
  if (-not (Test-Path -LiteralPath $targetPath)) { continue }

  $shortcut = $shell.CreateShortcut((Join-Path $desktop $definition.Name))
  $shortcut.TargetPath = $targetPath
  $shortcut.WorkingDirectory = $projectRoot
  $shortcut.Description = $definition.Description
  $shortcut.IconLocation = $definition.Icon
  $shortcut.Save()
}
