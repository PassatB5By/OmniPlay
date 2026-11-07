@echo off
chcp 65001 >nul
echo ========================================================
echo       WestPlay Fast In-Place Updater (No Reinstall)
echo ========================================================
echo.

echo [1/3] Closing running WestPlay processes...
taskkill /F /IM westplay.exe /IM westplay-maps.exe >nul 2>&1
timeout /t 1 /nobreak >nul

set "DEST=%LOCALAPPDATA%\WestPlay"
if not exist "%DEST%" (
    echo [ERROR] WestPlay folder not found at: %DEST%
    echo Please run the setup installer once first.
    pause
    exit /b 1
)

echo [2/3] Updating executables and libraries in %DEST%...
copy /y "target\release\westplay.exe" "%DEST%\westplay.exe"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to copy westplay.exe. Make sure it is closed.
    pause
    exit /b 1
)

copy /y "target\release\westplay-maps.exe" "%DEST%\westplay-maps.exe"
copy /y "target\release\westplay.dll" "%DEST%\westplay.dll"

if exist "ui\dist" (
    xcopy /e /i /y "ui\dist" "%DEST%\ui" >nul
)

echo.
echo [3/3] Update completed successfully!
echo All settings, logs, and profiles remain intact.
echo.
echo Starting WestPlay...
start "" "%DEST%\westplay.exe"
echo Done.
timeout /t 3 >nul

