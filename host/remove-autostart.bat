@echo off
rem Stops Stagehand starting automatically at log-in (doesn't stop it if it's running now).
set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Stagehand.lnk"
rem Also the shortcut from before the rename (OBS Web Controller, up to v0.2).
set "OLD_SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OBS Web Controller.lnk"
if exist "%OLD_SHORTCUT%" del "%OLD_SHORTCUT%"

if exist "%SHORTCUT%" (
  del "%SHORTCUT%"
  echo Done. Stagehand will no longer start at log-in.
) else (
  echo It wasn't set to start at log-in.
)
echo.
pause
