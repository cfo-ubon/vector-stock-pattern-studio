@echo off
REM Vector Stock Pattern Studio - run the desktop app in dev mode.
REM Run this file from the repo root, or double-click it in Explorer.

cd /d "%~dp0app"
if not exist node_modules (
    echo Installing dependencies, this only happens once...
    call npm install
    if errorlevel 1 goto :error
)

call npm run desktop:dev
if errorlevel 1 goto :error

goto :eof

:error
echo.
echo Something went wrong. See the messages above for details.
pause
exit /b 1
