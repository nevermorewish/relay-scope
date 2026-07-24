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
    Icon = "$env:SystemRoot\System32\shell32.dll,220"
  },
  @{
    Name = 'Stop RelayScope.lnk'
    Target = 'Stop RelayScope.cmd'
    Description = 'Stop RelayScope and automatic monitoring'
    Icon = "$env:SystemRoot\System32\shell32.dll,131"
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
