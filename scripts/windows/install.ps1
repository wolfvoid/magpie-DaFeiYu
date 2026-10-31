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
    if (Get-Process -Name 'BlueDaFeiYu' -ErrorAction SilentlyContinue) {
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
        $Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($ShortcutPath)
        if ($Shortcut.TargetPath -ieq $ExePath) { Remove-Item -LiteralPath $ShortcutPath -Force }
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
    $Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($ShortcutPath)
    if ((Test-Path -LiteralPath $ShortcutPath) -and $Shortcut.TargetPath -ine $ExePath) {
        throw "An unrelated Start menu shortcut already exists: $ShortcutPath"
    }
    $Shortcut.TargetPath = $ExePath
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = 'BlueDaFeiYu - Magpie desktop companion'
    $Shortcut.IconLocation = "$ExePath,0"
    $Shortcut.Save()
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
