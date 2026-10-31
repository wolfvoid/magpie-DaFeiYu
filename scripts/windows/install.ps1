#Requires -Version 5.1
param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$ProductName = 'magpie-DaFeiYu'
# Keep this script ASCII so both Windows PowerShell 5.1 and PowerShell 7 read it identically.
$AppName = -join [char[]]@(0x84dd, 0x8272, 0x5927, 0x80a5, 0x9c7c)
if (-not $env:LOCALAPPDATA -or -not $env:APPDATA) { throw 'User application directories are unavailable.' }
$ProgramsDir = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs'))
$InstallDir = Join-Path $ProgramsDir $ProductName
$ExePath = Join-Path $InstallDir 'BlueDaFeiYu.exe'
$Marker = '.dafeiyu-install'
$StartMenuDir = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))
$ShortcutPath = Join-Path $StartMenuDir "$AppName.lnk"

# WScript.Shell saves shortcut filenames through the system code page.
# Use the Unicode Shell Link interface for Chinese names on any Windows locale.
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

namespace DaFeiYu {
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    internal class ShellLink {}

    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IShellLinkW {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count, IntPtr data, uint flags);
        void GetIDList(out IntPtr list);
        void SetIDList(IntPtr list);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int count);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string text);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string path);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int count);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string text);
        void GetHotkey(out short hotkey);
        void SetHotkey(short hotkey);
        void GetShowCmd(out int command);
        void SetShowCmd(int command);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count, out int index);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int index);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
        void Resolve(IntPtr window, uint flags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
    }

    public static class Shortcut {
        public static string Target(string path) {
            object instance = new ShellLink();
            try {
                ((IPersistFile)instance).Load(path, 0);
                var target = new StringBuilder(32768);
                ((IShellLinkW)instance).GetPath(target, target.Capacity, IntPtr.Zero, 0);
                return target.ToString();
            } finally { Marshal.FinalReleaseComObject(instance); }
        }

        public static void Save(string path, string target) {
            object instance = new ShellLink();
            try {
                var link = (IShellLinkW)instance;
                link.SetPath(target);
                link.SetWorkingDirectory(Path.GetDirectoryName(target));
                link.SetDescription("BlueDaFeiYu - Magpie desktop companion");
                link.SetIconLocation(target, 0);
                ((IPersistFile)instance).Save(path, true);
            } finally { Marshal.FinalReleaseComObject(instance); }
        }
    }
}
'@

function Assert-AppDirectory([string]$Candidate) {
    $Resolved = [IO.Path]::GetFullPath($Candidate)
    if ([IO.Path]::GetDirectoryName($Resolved) -ine $ProgramsDir -or
        [IO.Path]::GetFileName($Resolved) -notmatch '^magpie-DaFeiYu(\.(installing|previous)-[a-f0-9]{32})?$') {
        throw "Refusing to modify an unexpected directory: $Resolved"
    }
    if (Test-Path -LiteralPath $Resolved) {
        $Item = Get-Item -LiteralPath $Resolved -Force
        if (-not $Item.PSIsContainer -or ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Refusing to modify a file or linked directory: $Resolved"
        }
    }
}

function Remove-AppDirectory([string]$Candidate) {
    Assert-AppDirectory $Candidate
    if (Test-Path -LiteralPath $Candidate) { Remove-Item -LiteralPath $Candidate -Recurse -Force }
}

function Confirm-AppStopped {
    if (Get-Process -Name 'BlueDaFeiYu' -ErrorAction SilentlyContinue |
        Where-Object { $_.Path -ieq $ExePath }) {
        throw 'Exit BlueDaFeiYu from its tray menu, then run this script again.'
    }
}

Assert-AppDirectory $InstallDir
if (Test-Path -LiteralPath $InstallDir) {
    $MarkerPath = Join-Path $InstallDir $Marker
    if (-not (Test-Path -LiteralPath $MarkerPath) -or
        (Get-Content -LiteralPath $MarkerPath -Raw).Trim() -ne $ProductName) {
        throw "Existing directory is not managed by this installer: $InstallDir"
    }
}

if ($Uninstall) {
    Confirm-AppStopped
    Remove-AppDirectory $InstallDir
    if (Test-Path -LiteralPath $ShortcutPath) {
        if ([DaFeiYu.Shortcut]::Target($ShortcutPath) -ieq $ExePath) {
            Remove-Item -LiteralPath $ShortcutPath -Force
        }
    }
    Write-Host 'Uninstalled. Your preferences in AppData\Roaming\BlueDaFeiYu-Codex were preserved.'
    exit 0
}

$Candidates = @(Get-ChildItem -LiteralPath $PSScriptRoot -Directory |
    Where-Object { $_.Name -match '-win32-x64$' })
if ($Candidates.Count -ne 1 -or
    -not (Test-Path -LiteralPath (Join-Path $Candidates[0].FullName 'BlueDaFeiYu.exe'))) {
    throw 'Extract the entire release ZIP, then run install.ps1 beside its *-win32-x64 directory.'
}
Confirm-AppStopped
New-Item -ItemType Directory -Path $ProgramsDir -Force | Out-Null
$StagingDir = Join-Path $ProgramsDir "$ProductName.installing-$([guid]::NewGuid().ToString('N'))"
$BackupDir = Join-Path $ProgramsDir "$ProductName.previous-$([guid]::NewGuid().ToString('N'))"
Assert-AppDirectory $StagingDir
Assert-AppDirectory $BackupDir
$InstalledNew = $false
try {
    Copy-Item -LiteralPath $Candidates[0].FullName -Destination $StagingDir -Recurse
    Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $StagingDir 'install.ps1')
    Set-Content -LiteralPath (Join-Path $StagingDir $Marker) -Value $ProductName -Encoding ASCII
    # Copy first, then swap directories. Restore the previous version if installation fails.
    if (Test-Path -LiteralPath $InstallDir) {
        Assert-AppDirectory $InstallDir
        Assert-AppDirectory $BackupDir
        Move-Item -LiteralPath $InstallDir -Destination $BackupDir
    }
    Assert-AppDirectory $StagingDir
    Assert-AppDirectory $InstallDir
    Move-Item -LiteralPath $StagingDir -Destination $InstallDir
    $InstalledNew = $true
    New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
    if ((Test-Path -LiteralPath $ShortcutPath) -and
        [DaFeiYu.Shortcut]::Target($ShortcutPath) -ine $ExePath) {
        throw "An unrelated Start menu shortcut already exists: $ShortcutPath"
    }
    [DaFeiYu.Shortcut]::Save($ShortcutPath, $ExePath)
} catch {
    if ($InstalledNew) { Remove-AppDirectory $InstallDir }
    if (Test-Path -LiteralPath $BackupDir) {
        Assert-AppDirectory $BackupDir
        Assert-AppDirectory $InstallDir
        Move-Item -LiteralPath $BackupDir -Destination $InstallDir
    }
    throw
} finally {
    Remove-AppDirectory $StagingDir
}
Remove-AppDirectory $BackupDir
Write-Host "Installed: $InstallDir"
Write-Host "Start menu shortcut: $ShortcutPath"
Write-Host "Open the Start menu shortcut or $ExePath"
Write-Host "Uninstall: powershell -NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\install.ps1`" -Uninstall"
