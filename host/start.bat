@echo off
rem Starts OBS Web Controller's web server. Keep the window open while the app is in use.
title OBS Web Controller
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js isn't installed, or isn't on the PATH.
  echo Install the LTS version from https://nodejs.org and try again.
  echo.
  pause
  exit /b 1
)

node server.mjs %*
if errorlevel 1 (
  echo.
  pause
)
