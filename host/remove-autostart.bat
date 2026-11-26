@echo off
rem Stops OBS Web Controller starting automatically at log-in (doesn't stop it if it's running now).
set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OBS Web Controller.lnk"

if exist "%SHORTCUT%" (
  del "%SHORTCUT%"
  echo Done. OBS Web Controller will no longer start at log-in.
) else (
  echo It wasn't set to start at log-in.
)
echo.
pause
