@echo off
setlocal
cd /d "%~dp0"
where py.exe >nul 2>nul
if not errorlevel 1 (
  py -3 scripts\start_local.py %*
  if errorlevel 1 pause
  exit /b
)
where python.exe >nul 2>nul
if not errorlevel 1 (
  python scripts\start_local.py %*
  if errorlevel 1 pause
  exit /b
)
echo Python 3 is required. Install Python, then open this file again.
pause
