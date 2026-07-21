@echo off
REM Vector Stock Pattern Studio - build the Windows portable .exe.
REM Run this file from the repo root, or double-click it in Explorer.

cd /d "%~dp0app"
if not exist node_modules (
    echo Installing dependencies, this only happens once...
    call npm install
    if errorlevel 1 goto :error
)

call npm run desktop:portable
if errorlevel 1 goto :error

echo.
echo Build finished. Copy the portable .exe from:
echo   app\release\VectorStockPatternStudio_Desktop\build-tmp\
echo into:
echo   release\VectorStockPatternStudio_Desktop\portable\
echo See docs\RELEASE_PROCESS_DESKTOP.md for the full release folder layout.

goto :eof

:error
echo.
echo Something went wrong. See the messages above for details.
pause
exit /b 1
