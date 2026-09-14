@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-mycelium.ps1" %*
set "mycelium_exit=%errorlevel%"
if not "%mycelium_exit%"=="0" pause
exit /b %mycelium_exit%
