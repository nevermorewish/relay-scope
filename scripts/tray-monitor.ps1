param(
  [switch]$BrowserPending,
  [switch]$BrowserHandled
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$monitorUrl = 'http://127.0.0.1:3000'
$startScript = Join-Path $PSScriptRoot 'start-monitor.ps1'
$stopScript = Join-Path $PSScriptRoot 'stop-monitor.ps1'
$browserScript = Join-Path $PSScriptRoot 'open-browser-tab.ps1'
$iconPath = Join-Path $projectRoot 'assets\windows\relayscope-tray.ico'
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

. $browserScript

Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class RelayScopeWindow {
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    private static extern bool ShowWindowAsync(IntPtr hWnd, int command);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool PostMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();

    public static void EnableDpiAwareness() {
        try { SetProcessDPIAware(); } catch { }
    }

    public static bool ActivateHandle(IntPtr handle) {
        if (handle == IntPtr.Zero) return false;
        if (IsIconic(handle)) ShowWindowAsync(handle, 9);
        return SetForegroundWindow(handle);
    }

    public static bool IsMinimized(IntPtr handle) {
        return handle != IntPtr.Zero && IsIconic(handle);
    }

    public static void CloseActiveTab(IntPtr handle) {
        if (handle != IntPtr.Zero) {
            PostMessage(handle, 0x0111, new IntPtr(34015), IntPtr.Zero);
        }
    }

    public static bool Activate() {
        IntPtr match = IntPtr.Zero;
        EnumWindows(delegate (IntPtr hWnd, IntPtr lParam) {
            if (!IsWindowVisible(hWnd)) return true;
            StringBuilder title = new StringBuilder(512);
            GetWindowText(hWnd, title, title.Capacity);
            if (title.ToString().IndexOf("RelayScope", StringComparison.OrdinalIgnoreCase) >= 0) {
                match = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);

        if (match == IntPtr.Zero) return false;
        return ActivateHandle(match);
    }
}
'@

[RelayScopeWindow]::EnableDpiAwareness()
Add-Type -AssemblyName System.Windows.Forms

function Open-MonitorWindow {
  Open-RelayScopeBrowserTab -Url $monitorUrl | Out-Null
}

function Close-VisibleMonitorTabs {
  for ($attempt = 0; $attempt -lt 10; $attempt += 1) {
    $browser = Get-Process -Name msedge, chrome, brave, vivaldi -ErrorAction SilentlyContinue |
      Where-Object {
        $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like 'RelayScope*'
      } |
      Select-Object -First 1
    if (-not $browser) { return }
    if ([RelayScopeWindow]::IsMinimized($browser.MainWindowHandle)) {
      [RelayScopeWindow]::CloseActiveTab($browser.MainWindowHandle)
      Start-Sleep -Milliseconds 150
      continue
    }
    if (-not [RelayScopeWindow]::ActivateHandle($browser.MainWindowHandle)) { return }

    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait('^w')
    Start-Sleep -Milliseconds 150
  }
}

$createdNew = $false
$trayMutex = [System.Threading.Mutex]::new($true, 'Local\RelayScopeTray', [ref]$createdNew)
$hasTrayLock = $createdNew
$createdStoppingEvent = $false
$stoppingEvent = [System.Threading.EventWaitHandle]::new(
  $false,
  [System.Threading.EventResetMode]::ManualReset,
  'Local\RelayScopeStopping',
  [ref]$createdStoppingEvent
)

if (-not $createdNew) {
  if ($stoppingEvent.WaitOne(0)) {
    try {
      $hasTrayLock = $trayMutex.WaitOne(30000)
    } catch [System.Threading.AbandonedMutexException] {
      $hasTrayLock = $true
    }
    if (-not $hasTrayLock) {
      $stoppingEvent.Dispose()
      $trayMutex.Dispose()
      exit 1
    }
    $stoppingEvent.Reset()
  } else {
    if (-not $BrowserPending -and -not $BrowserHandled) {
      Open-MonitorWindow
    }
    $stoppingEvent.Dispose()
    $trayMutex.Dispose()
    exit 0
  }
}

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies 'System.Drawing.dll', 'System.Windows.Forms.dll' -TypeDefinition @'
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

public sealed class RelayScopeMenuForm : Form {
}

public static class RelayScopeMenuShape {
    public static void Apply(Control control, int radius) {
        Rectangle bounds = new Rectangle(0, 0, control.Width, control.Height);
        int diameter = radius * 2;
        using (GraphicsPath path = new GraphicsPath()) {
            path.AddArc(bounds.Left, bounds.Top, diameter, diameter, 180, 90);
            path.AddArc(bounds.Right - diameter, bounds.Top, diameter, diameter, 270, 90);
            path.AddArc(bounds.Right - diameter, bounds.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(bounds.Left, bounds.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            Region previous = control.Region;
            control.Region = new Region(path);
            if (previous != null) previous.Dispose();
        }
    }
}
'@

function Test-MonitorReady {
  $response = $null
  try {
    $request = [System.Net.HttpWebRequest]::Create($monitorUrl)
    $request.Proxy = $null
    $request.Timeout = 1500
    $response = $request.GetResponse()
    return [int]$response.StatusCode -eq 200
  } catch {
    return $false
  } finally {
    if ($response) { $response.Dispose() }
  }
}

function Invoke-ControlScript {
  param(
    [string]$Path,
    [string[]]$Arguments = @()
  )

  $process = Start-ControlScript -Path $Path -Arguments $Arguments
  $process.WaitForExit()
  $exitCode = $process.ExitCode
  $process.Dispose()
  return $exitCode
}

function Start-ControlScript {
  param(
    [string]$Path,
    [string[]]$Arguments = @()
  )

  return Start-Process `
    -FilePath $powershellPath `
    -ArgumentList (@('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$Path`"") + $Arguments) `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -PassThru
}

function Start-RelayScopeService {
  try {
    if ((Invoke-ControlScript -Path $startScript -Arguments @('-NoBrowser')) -ne 0) {
      throw '启动脚本执行失败'
    }
    return $true
  } catch {
    [System.Windows.Forms.MessageBox]::Show(
      "RelayScope 无法启动：$($_.Exception.Message)",
      'RelayScope',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    return $false
  }
}

$notifyIcon = [System.Windows.Forms.NotifyIcon]::new()
$notifyIcon.Icon = [System.Drawing.Icon]::new($iconPath)
$notifyIcon.Text = 'RelayScope'
$notifyIcon.Visible = $true

$menuWidth = 250
$menuItemHeight = 56
$menuPadding = 8
$menuRadius = 16
$menuHeight = ($menuPadding * 2) + ($menuItemHeight * 2) + 1
$menuBackColor = [System.Drawing.Color]::FromArgb(30, 30, 30)
$menuHoverColor = [System.Drawing.Color]::FromArgb(58, 58, 58)
$menuTextColor = [System.Drawing.Color]::FromArgb(245, 245, 245)
$menuFont = [System.Drawing.Font]::new(
  'Microsoft YaHei UI',
  22,
  [System.Drawing.FontStyle]::Regular,
  [System.Drawing.GraphicsUnit]::Pixel
)

$menuForm = [RelayScopeMenuForm]::new()
$menuForm.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
$menuForm.BackColor = $menuBackColor
$menuForm.ClientSize = [System.Drawing.Size]::new($menuWidth, $menuHeight)
$menuForm.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$menuForm.ShowInTaskbar = $false
$menuForm.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$menuForm.TopMost = $true

function New-TrayMenuItem {
  param(
    [string]$Text,
    [int]$Top
  )

  $item = [System.Windows.Forms.Label]::new()
  $item.AutoSize = $false
  $item.BackColor = $script:menuBackColor
  $item.Cursor = [System.Windows.Forms.Cursors]::Arrow
  $item.Font = $script:menuFont
  $item.ForeColor = $script:menuTextColor
  $item.Location = [System.Drawing.Point]::new(0, $Top)
  $item.Padding = [System.Windows.Forms.Padding]::new(40, 0, 12, 0)
  $item.Size = [System.Drawing.Size]::new($script:menuWidth, $script:menuItemHeight)
  $item.Text = $Text
  $item.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
  $item.add_MouseEnter({
    param($sender, $eventArgs)
    $sender.BackColor = $script:menuHoverColor
  })
  $item.add_MouseLeave({
    param($sender, $eventArgs)
    $sender.BackColor = $script:menuBackColor
  })
  return $item
}

$openItem = New-TrayMenuItem -Text '打开监测台' -Top $menuPadding
$separator = [System.Windows.Forms.Panel]::new()
$separator.BackColor = [System.Drawing.Color]::FromArgb(78, 78, 78)
$separator.Location = [System.Drawing.Point]::new(0, $menuPadding + $menuItemHeight)
$separator.Size = [System.Drawing.Size]::new($menuWidth, 1)
$exitItem = New-TrayMenuItem `
  -Text '退出' `
  -Top ($menuPadding + $menuItemHeight + 1)
$menuForm.Controls.Add($openItem)
$menuForm.Controls.Add($separator)
$menuForm.Controls.Add($exitItem)
$menuForm.add_Deactivate({ $script:menuForm.Hide() })

$openAction = {
  $script:menuForm.Hide()
  if (Test-MonitorReady) {
    Open-MonitorWindow
  } elseif (Start-RelayScopeService) {
    Open-MonitorWindow
  }
}

$openItem.add_Click($openAction)
$notifyIcon.add_DoubleClick($openAction)
$notifyIcon.add_MouseUp({
  param($sender, $eventArgs)
  if ($eventArgs.Button -ne [System.Windows.Forms.MouseButtons]::Right) { return }

  $cursor = [System.Windows.Forms.Cursor]::Position
  $workingArea = [System.Windows.Forms.Screen]::FromPoint($cursor).WorkingArea
  $menuX = [Math]::Min($cursor.X, $workingArea.Right - $script:menuForm.Width)
  $menuX = [Math]::Max($workingArea.Left, $menuX)
  $menuY = [Math]::Max($workingArea.Top, $cursor.Y - $script:menuForm.Height)
  $script:menuForm.Location = [System.Drawing.Point]::new($menuX, $menuY)
  [RelayScopeMenuShape]::Apply($script:menuForm, $script:menuRadius)
  $script:menuForm.Show()
  $script:menuForm.Activate()
})

$applicationContext = [System.Windows.Forms.ApplicationContext]::new()
$exitItem.add_Click({
  $script:exitItem.Enabled = $false
  $script:stoppingEvent.Set() | Out-Null
  $script:notifyIcon.Visible = $false
  $script:menuForm.Hide()
  [System.Windows.Forms.Application]::DoEvents()
  try {
    Close-VisibleMonitorTabs
    Invoke-ControlScript -Path $stopScript -Arguments @('-Quiet') | Out-Null
  } finally {
    $script:applicationContext.ExitThread()
  }
})

try {
  if (-not (Test-MonitorReady)) {
    if (-not (Start-RelayScopeService)) {
      throw 'RelayScope 服务启动失败'
    }
  }
  if (-not $BrowserPending -and -not $BrowserHandled) {
    Open-MonitorWindow
  }
  [System.Windows.Forms.Application]::Run($applicationContext)
} catch {
  [System.Windows.Forms.MessageBox]::Show(
    $_.Exception.Message,
    'RelayScope',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error
  ) | Out-Null
} finally {
  $notifyIcon.Visible = $false
  $notifyIcon.Dispose()
  $menuForm.Dispose()
  $menuFont.Dispose()
  $applicationContext.Dispose()
  if ($hasTrayLock) { $trayMutex.ReleaseMutex() }
  $stoppingEvent.Dispose()
  $trayMutex.Dispose()
}
