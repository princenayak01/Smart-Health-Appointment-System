@echo off
title CareFlow - Smart Health Appointment System
echo ========================================================
echo  Starting CareFlow - Smart Health Appointment System...
echo ========================================================
cd /d "%~dp0"
if exist package.json (
  goto RUN
)
if exist Smart_Health_Appointment_System\package.json (
  cd Smart_Health_Appointment_System
  goto RUN
)

:RUN
echo Launching server on http://localhost:3000 ...
start "" "http://localhost:3000"
node server.js
pause
