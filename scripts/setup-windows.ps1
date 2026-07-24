$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$minimumNodeVersion = [version]'22.5.0'
$requiredPnpmVersion = '11.9.0'

function Stop-WithMessage {
  param([string]$Message)

  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    $Message,
    'RelayScope Setup',
    'OK',
    'Error'
  ) | Out-Null
  exit 1
}

function New-RandomSecret {
  param([int]$Bytes)

  $buffer = New-Object byte[] $Bytes
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($buffer)
  } finally {
    $generator.Dispose()
  }
  return [Convert]::ToBase64String($buffer)
}

try {
  Push-Location $projectRoot

  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $nodeCommand) {
    Stop-WithMessage 'Node.js was not found. Install Node.js 22.5 or newer, then run this file again.'
  }

  $nodeVersion = [version]((& $nodeCommand.Source --version).Trim().TrimStart('v'))
  if ($nodeVersion -lt $minimumNodeVersion) {
    Stop-WithMessage "Node.js $nodeVersion is installed. RelayScope requires Node.js 22.5 or newer."
  }

  $pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if (-not $pnpmCommand) {
    $corepackCommand = Get-Command corepack.cmd -ErrorAction SilentlyContinue
    if (-not $corepackCommand) {
      Stop-WithMessage 'pnpm and Corepack were not found. Install pnpm 11.9.0, then run this file again.'
    }
    & $corepackCommand.Source enable
    & $corepackCommand.Source prepare "pnpm@$requiredPnpmVersion" --activate
    $pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  }
  if (-not $pnpmCommand) {
    Stop-WithMessage 'pnpm setup failed. Check the network connection and try again.'
  }

  $environmentPath = Join-Path $projectRoot '.env.local'
  if (-not (Test-Path -LiteralPath $environmentPath)) {
    $template = [System.IO.File]::ReadAllText((Join-Path $projectRoot '.env.example'))
    $template = $template.Replace(
      'replace-with-32-byte-minimum-random-secret',
      (New-RandomSecret -Bytes 48)
    ).Replace(
      'replace-with-cron-secret',
      (New-RandomSecret -Bytes 32)
    ).Replace(
      'replace-with-a-local-admin-password',
      (New-RandomSecret -Bytes 24)
    )
    [System.IO.File]::WriteAllText(
      $environmentPath,
      $template,
      [System.Text.UTF8Encoding]::new($false)
    )
  }

  & $pnpmCommand.Source install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
  & $pnpmCommand.Source db:generate
  if ($LASTEXITCODE -ne 0) { throw 'Prisma Client generation failed' }
  & $pnpmCommand.Source db:init
  if ($LASTEXITCODE -ne 0) { throw 'SQLite initialization failed' }
  & $pnpmCommand.Source build
  if ($LASTEXITCODE -ne 0) { throw 'Production build failed' }

  & (Join-Path $PSScriptRoot 'create-windows-shortcuts.ps1')

  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show(
    'Setup completed. Start and Stop RelayScope shortcuts were added to the desktop.',
    'RelayScope Setup',
    'OK',
    'Information'
  ) | Out-Null

  & (Join-Path $PSScriptRoot 'start-monitor.ps1')
} catch {
  Stop-WithMessage "Setup did not complete: $($_.Exception.Message)"
} finally {
  Pop-Location
}
