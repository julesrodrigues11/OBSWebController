@echo off
rem Makes OBS Web Controller start (minimised) whenever this Windows user logs in.
rem Undo with remove-autostart.bat.
cd /d "%~dp0"
set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OBS Web Controller.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:SHORTCUT);" ^
  "$s.TargetPath = (Join-Path (Get-Location) 'start.bat');" ^
  "$s.WorkingDirectory = (Get-Location).Path;" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'OBS Web Controller web server';" ^
  "$s.Save()"

if exist "%SHORTCUT%" (
  echo Done. OBS Web Controller will start minimised when you log in.
  echo To start it now, double-click start.bat.
) else (
  echo Couldn't create the start-up shortcut.
)
echo.
pause
