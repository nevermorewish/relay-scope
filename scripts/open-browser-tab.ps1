$ErrorActionPreference = 'Stop'

if (-not ('RelayScopeBrowserTab' -as [type])) {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $automationClientPath = [System.Windows.Automation.AutomationElement].Assembly.Location
  $automationTypesPath = [System.Windows.Automation.AutomationElementIdentifiers].Assembly.Location
  Add-Type -ReferencedAssemblies $automationClientPath, $automationTypesPath -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Automation;

public static class RelayScopeBrowserTab {
    private static readonly string[] BrowserProcessNames = {
        "msedge", "chrome", "brave", "vivaldi", "firefox", "opera"
    };

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool ShowWindowAsync(IntPtr hWnd, int command);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    private static bool IsSupportedBrowser(string processName) {
        foreach (string candidate in BrowserProcessNames) {
            if (string.Equals(processName, candidate, StringComparison.OrdinalIgnoreCase)) {
                return true;
            }
        }
        return false;
    }

    private static void ActivateWindow(IntPtr handle) {
        if (IsIconic(handle)) ShowWindowAsync(handle, 9);
        SetForegroundWindow(handle);
    }

    public static bool ActivateExisting(string titleFragment) {
        foreach (Process process in Process.GetProcesses()) {
            try {
                if (!IsSupportedBrowser(process.ProcessName)) continue;

                IntPtr handle = process.MainWindowHandle;
                if (handle == IntPtr.Zero) continue;

                string windowTitle = process.MainWindowTitle ?? string.Empty;
                if (windowTitle.IndexOf(titleFragment, StringComparison.OrdinalIgnoreCase) >= 0) {
                    ActivateWindow(handle);
                    return true;
                }

                AutomationElement root = AutomationElement.FromHandle(handle);
                Condition tabCondition = new PropertyCondition(
                    AutomationElement.ControlTypeProperty,
                    ControlType.TabItem
                );
                AutomationElementCollection tabs = root.FindAll(
                    TreeScope.Descendants,
                    tabCondition
                );

                foreach (AutomationElement tab in tabs) {
                    string tabName = tab.Current.Name ?? string.Empty;
                    if (tabName.IndexOf(titleFragment, StringComparison.OrdinalIgnoreCase) < 0) {
                        continue;
                    }

                    ActivateWindow(handle);
                    object selectionPattern;
                    if (tab.TryGetCurrentPattern(SelectionItemPattern.Pattern, out selectionPattern)) {
                        ((SelectionItemPattern)selectionPattern).Select();
                    }
                    tab.SetFocus();
                    SetForegroundWindow(handle);
                    return true;
                }
            } catch (Exception) {
            } finally {
                process.Dispose();
            }
        }
        return false;
    }
}
'@
}

function Open-RelayScopeBrowserTab {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  $openMutex = [System.Threading.Mutex]::new($false, 'Local\RelayScopeBrowserOpen')
  $hasOpenLock = $false
  try {
    try {
      $hasOpenLock = $openMutex.WaitOne(5000)
    } catch [System.Threading.AbandonedMutexException] {
      $hasOpenLock = $true
    }
    if (-not $hasOpenLock) { return $false }

    if ([RelayScopeBrowserTab]::ActivateExisting('RelayScope')) {
      return $true
    }

    Start-Process $Url
    $browserTimer = [System.Diagnostics.Stopwatch]::StartNew()
    while ($browserTimer.Elapsed.TotalSeconds -lt 3) {
      Start-Sleep -Milliseconds 100
      if ([RelayScopeBrowserTab]::ActivateExisting('RelayScope')) {
        return $true
      }
    }
    return $false
  } finally {
    if ($hasOpenLock) { $openMutex.ReleaseMutex() }
    $openMutex.Dispose()
  }
}
