@echo off
title CareFlow - Smart Health Appointment System
echo ========================================================
echo  Starting CareFlow - Smart Health Appointment System...
echo ========================================================
cd /d "%~dp0"
echo Launching server on http://localhost:3000 ...
start "" "http://localhost:3000"
node server.js
pause
