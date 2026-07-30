# Build 027 Phase 4 — Windows 11 verification script for the
# Vector Stock Pattern Studio desktop build.
#
# This sandbox (Linux, root, no WebView2/Windows runtime) can build the
# Windows artifacts and run a Linux-side Electron smoke test, but it
# CANNOT install or launch a real .exe on Windows. Per the project's own
# honest-result policy, that step is PENDING USER-PC VERIFICATION — this
# script automates everything that can be automated on your machine, and
# prints clear PASS/FAIL/MANUAL lines. Read the printed summary at the end
# before trusting the build.
#
# Usage (from PowerShell, in the folder containing the two .exe files and
# SHA256SUMS.txt):
#   .\verifyWindowsInstall.ps1

$ErrorActionPreference = 'Stop'
$results = @()

function Add-Result($name, $status, $detail) {
    $script:results += [PSCustomObject]@{ Name = $name; Status = $status; Detail = $detail }
}

Write-Host "== Vector Stock Pattern Studio — Windows verification ==" -ForegroundColor Cyan
Write-Host "Run this from the folder containing the installer, the portable build, and SHA256SUMS.txt.`n"

$setupExe    = Get-ChildItem -Filter 'VectorStockPatternStudio-Setup-x64.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
$portableExe = Get-ChildItem -Filter 'VectorStockPatternStudio-Portable-x64.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
$sumsFile    = Get-ChildItem -Filter 'SHA256SUMS.txt' -ErrorAction SilentlyContinue | Select-Object -First 1

# --- Step 1: checksum verification ---------------------------------------
if (-not $sumsFile) {
    Add-Result 'Checksum file present' 'FAIL' 'SHA256SUMS.txt not found next to this script.'
} else {
    $expected = @{}
    Get-Content $sumsFile.FullName | ForEach-Object {
        if ($_ -match '^([0-9a-fA-F]{64})\s+\*?(.+)$') {
            $expected[$matches[2].Trim()] = $matches[1].ToLower()
        }
    }
    foreach ($exe in @($setupExe, $portableExe)) {
        if (-not $exe) { continue }
        $actual = (Get-FileHash -Algorithm SHA256 -Path $exe.FullName).Hash.ToLower()
        $want = $expected[$exe.Name]
        if ($null -eq $want) {
            Add-Result "Checksum: $($exe.Name)" 'FAIL' 'No expected hash found in SHA256SUMS.txt for this file.'
        } elseif ($actual -eq $want) {
            Add-Result "Checksum: $($exe.Name)" 'PASS' "SHA-256 matches: $actual"
        } else {
            Add-Result "Checksum: $($exe.Name)" 'FAIL' "Mismatch. Expected $want, got $actual — do not run this file."
        }
    }
}

if (-not $setupExe)    { Add-Result 'Installer present'  'FAIL' 'VectorStockPatternStudio-Setup-x64.exe not found.' }
if (-not $portableExe) { Add-Result 'Portable present'    'FAIL' 'VectorStockPatternStudio-Portable-x64.exe not found.' }

# --- Step 2: run the installer (interactive — NSIS is not silent by default) ---
if ($setupExe -and ($results | Where-Object { $_.Name -eq "Checksum: $($setupExe.Name)" -and $_.Status -eq 'FAIL' }).Count -eq 0) {
    Write-Host "`nLaunching the installer. Follow the wizard, then return here and press Enter." -ForegroundColor Yellow
    Start-Process -FilePath $setupExe.FullName -Wait
    Add-Result 'Installer ran without crashing' 'MANUAL' 'Confirm the wizard completed and offered to launch the app.'
} else {
    Add-Result 'Installer smoke test' 'FAIL' 'Skipped — checksum or file missing.'
}

# --- Step 3: locate the per-user install (perMachine:false -> LOCALAPPDATA) ---
$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\Vector Stock Pattern Studio'
if (Test-Path $installRoot) {
    $exePath = Join-Path $installRoot 'Vector Stock Pattern Studio.exe'
    if (Test-Path $exePath) {
        Add-Result 'Installed app.exe found' 'PASS' $exePath
    } else {
        Add-Result 'Installed app.exe found' 'FAIL' "Install folder exists but exe missing: $installRoot"
    }
} else {
    Add-Result 'Installed app.exe found' 'FAIL' "Expected install folder not found: $installRoot"
}

# --- Step 4: launch the installed app for a manual smoke test ---
if (Test-Path $installRoot) {
    $exePath = Join-Path $installRoot 'Vector Stock Pattern Studio.exe'
    if (Test-Path $exePath) {
        Write-Host "`nLaunching the installed app. In the window that opens, please:" -ForegroundColor Yellow
        Write-Host "  1. Confirm the app UI loads (no blank/white window)."
        Write-Host "  2. Generate a pattern and confirm the preview renders."
        Write-Host "  3. Open Backup Manager -> Create Backup, and save a .vspsb file via the native Save dialog."
        Write-Host "  4. Close the app, relaunch it, and confirm your pattern/project is still there (IndexedDB persisted)."
        Write-Host "  5. Restore the .vspsb you just saved via Backup Manager -> Restore, and confirm it succeeds."
        Start-Process -FilePath $exePath
        Add-Result 'Installed app manual smoke test' 'MANUAL' 'Complete steps 1-5 above, then record PASS/FAIL yourself.'
    }
}

# --- Step 5: portable build ------------------------------------------------
if ($portableExe -and ($results | Where-Object { $_.Name -eq "Checksum: $($portableExe.Name)" -and $_.Status -eq 'FAIL' }).Count -eq 0) {
    Write-Host "`nLaunching the portable build (no installation). Confirm it opens the same as the installed app, then close it." -ForegroundColor Yellow
    Start-Process -FilePath $portableExe.FullName
    Add-Result 'Portable build launches' 'MANUAL' 'Confirm the portable .exe opens without installing anything.'
}

# --- Step 6: upgrade-safety reminder (requires a second build to test) ----
Add-Result 'Upgrade persistence (optional)' 'MANUAL' 'To fully verify: install this build, create data, then install a NEWER build over it and confirm your data survives. Not automatable from a single build.'

# --- Summary ---------------------------------------------------------------
Write-Host "`n== Summary ==" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$fails = ($results | Where-Object { $_.Status -eq 'FAIL' }).Count
$manual = ($results | Where-Object { $_.Status -eq 'MANUAL' }).Count
Write-Host "`n$fails automated FAIL(s), $manual step(s) need your manual confirmation." -ForegroundColor $(if ($fails -gt 0) { 'Red' } else { 'Green' })
Write-Host "Report back: for each MANUAL line, whether it was PASS or FAIL on your machine."
