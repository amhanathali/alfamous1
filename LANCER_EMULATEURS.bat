@echo off
REM Lance les émulateurs Firebase (Auth, Firestore, Storage) en local, sans toucher au nuage.
REM Console : http://localhost:4000 . Fermer cette fenêtre (ou Ctrl+C) les arrête et garde
REM les données d'essai dans .emulateurs\ .
REM Comptes d'essai (niveaux 0 à 3) : dans une 2e fenêtre, npm run emulateurs:peupler
REM --- Dossier Alfamous1 : celui de ce fichier ; en secours %USERPROFILE%\Desktop\Alfamous1.
REM     Jamais le dossier par defaut de cmd (reglage AutoRun du PC vers Desktop\Alfamous).
set "ALFAMOUS1=%~dp0"
if not exist "%ALFAMOUS1%package.json" set "ALFAMOUS1=%USERPROFILE%\Desktop\Alfamous1\"
cd /d "%ALFAMOUS1%" || goto pas_alfamous1
findstr /c:"\"name\": \"alfamous1\"" package.json >nul || goto pas_alfamous1
REM --- Fermeture de ce qui peut bloquer : processus qui ecoutent sur les ports %FERMER_PORTS%.
set "FERMER_PORTS=4000,4400,4500,5001,5005,8085,9099,9150,9199"
set "FERMER_TOUT=0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$garder = @(); $p = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)).ParentProcessId; while ($p) { $garder += $p; $q = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $p); if (-not $q) { break }; $p = $q.ParentProcessId; if ($garder -contains $p) { break } }; $ports = $env:FERMER_PORTS -split ','; Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { ($ports -contains [string]$_.LocalPort) -and ($garder -notcontains $_.OwningProcess) -and ($_.OwningProcess -gt 4) } | ForEach-Object { 'port ' + $_.LocalPort + ' : ferme ' + $_.OwningProcess; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; if ($env:FERMER_TOUT -eq '1') { Get-CimInstance Win32_Process | Where-Object { ($_.Name -in 'node.exe','java.exe') -and ($_.CommandLine -match 'Alfamous1|firebase|emulat') -and ($garder -notcontains $_.ProcessId) } | ForEach-Object { 'ferme ' + $_.Name + ' ' + $_.ProcessId; Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $garder -notcontains $_.Id } | ForEach-Object { 'ferme cmd ' + $_.Id; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } }"
title Alfamous1 - emulateurs Firebase
if not exist node_modules\firebase-tools (
  echo Premiere fois : installation des outils, npm install...
  call npm install
)
start "" http://localhost:4000
call npm run emulateurs
pause
goto :eof

:pas_alfamous1
echo.
echo ARRET : dossier Alfamous1 introuvable (dossier actuel : %CD%).
echo Le fichier .bat doit etre dans Desktop\Alfamous1.
pause
exit /b 1
