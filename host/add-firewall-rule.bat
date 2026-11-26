@echo off
rem Lets other PCs on the local (private) network reach the app and OBS's WebSocket server.
rem Right-click this file and choose "Run as administrator".
rem Optional: add-firewall-rule.bat 8080 4455   (app port, OBS WebSocket port)

net session >nul 2>&1
if errorlevel 1 (
  echo This needs administrator rights: right-click add-firewall-rule.bat and choose "Run as administrator".
  echo.
  pause
  exit /b 1
)

set "APP_PORT=8080"
set "OBS_PORT=4455"
if not "%~1"=="" set "APP_PORT=%~1"
if not "%~2"=="" set "OBS_PORT=%~2"

netsh advfirewall firewall delete rule name="OBS Web Controller (app)" >nul 2>&1
netsh advfirewall firewall delete rule name="Stagehand (app)" >nul 2>&1
netsh advfirewall firewall add rule name="Stagehand (app)" dir=in action=allow protocol=TCP localport=%APP_PORT% profile=private
netsh advfirewall firewall delete rule name="OBS WebSocket (OBS Web Controller)" >nul 2>&1
netsh advfirewall firewall delete rule name="OBS WebSocket (Stagehand)" >nul 2>&1
netsh advfirewall firewall add rule name="OBS WebSocket (Stagehand)" dir=in action=allow protocol=TCP localport=%OBS_PORT% profile=private

echo.
echo Allowed inbound TCP %APP_PORT% (app) and %OBS_PORT% (OBS WebSocket) on private networks.
echo If your network is set to "Public" in Windows, change it to "Private" for these rules to apply.
echo.
pause
