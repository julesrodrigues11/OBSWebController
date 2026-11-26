@echo off
rem Makes Stagehand start (minimised) whenever this Windows user logs in.
rem Undo with remove-autostart.bat.
cd /d "%~dp0"
set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Stagehand.lnk"
rem The shortcut used before the app was renamed (OBS Web Controller, up to v0.2): removed so it doesn't start twice.
set "OLD_SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OBS Web Controller.lnk"
if exist "%OLD_SHORTCUT%" del "%OLD_SHORTCUT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:SHORTCUT);" ^
  "$s.TargetPath = (Join-Path (Get-Location) 'start.bat');" ^
  "$s.WorkingDirectory = (Get-Location).Path;" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'Stagehand web server';" ^
  "$s.Save()"

if exist "%SHORTCUT%" (
  echo Done. Stagehand will start minimised when you log in.
  echo To start it now, double-click start.bat.
) else (
  echo Couldn't create the start-up shortcut.
)
echo.
pause
