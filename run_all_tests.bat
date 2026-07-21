@echo off
REM Vector Stock Pattern Studio - run the full desktop test/verification suite.
REM Run this file from the repo root, or double-click it in Explorer.

cd /d "%~dp0app"
if not exist node_modules (
    echo Installing dependencies, this only happens once...
    call npm install
    if errorlevel 1 goto :error
)

echo.
echo [1/4] Running the automated test suite...
call npm test
if errorlevel 1 goto :error

echo.
echo [2/4] Type-checking the Electron main/preload/IPC code...
call npx tsc -p tsconfig.electron.json --noEmit
if errorlevel 1 goto :error

echo.
echo [3/4] Building the renderer for the offline dependency check...
call npm run desktop:build:renderer
if errorlevel 1 goto :error

echo.
echo [4/4] Verifying the build has no online dependencies...
call npx tsx scripts/verifyOfflineBuild.ts
if errorlevel 1 goto :error

echo.
echo All checks passed.
pause
goto :eof

:error
echo.
echo Something went wrong. See the messages above for details.
pause
exit /b 1
