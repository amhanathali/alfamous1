@echo off
REM ======================================================================
REM  Essai local d Alfamous1 en un double-clic (procedure fixe, 26 nov. 2026)
REM ----------------------------------------------------------------------
REM  ESSAI_LOCAL.bat            essaie la DERNIERE version preparee par Claude :
REM                             la branche modifiee le plus recemment sur GitHub (ou main)
REM  ESSAI_LOCAL.bat main       essaie main (ce qui est en ligne)
REM  ESSAI_LOCAL.bat <branche>  essaie cette branche
REM  Etapes :
REM   1. ferme toutes les autres fenetres cmd.exe, les emulateurs et le serveur local
REM   2. recupere la version a essayer (git fetch ; jamais de fusion ; arret si modifications locales)
REM   3. outils (npm install)
REM   4. emulateurs Firebase + donnees d essai (comptes, commentaires sur 112:1, notes, fils)
REM   5. application sur http://localhost:5050 dans le navigateur
REM  Le script se recopie dans %TEMP% et s execute de la : changer de branche ne peut pas
REM  modifier ce fichier pendant qu il tourne.
REM  cmd /d : ignore le reglage AutoRun du PC, qui renvoie sinon vers Desktop\Alfamous.
REM ======================================================================
if /i "%~1"=="--copie" goto copie
set "ARG=%~1"
REM Ancienne version (git pull puis "suite") : "suite" = pas de branche demandee.
if /i "%ARG%"=="suite" set "ARG="
copy /y "%~f0" "%TEMP%\essai-alfamous1.bat" >nul
"%TEMP%\essai-alfamous1.bat" --copie "%~dp0." "%ARG%"

:copie
cd /d "%~2"
set "CIBLE=%~3"
title Alfamous1 - essai local
echo.
echo [1/5] Fermeture des autres fenetres cmd, des emulateurs et du serveur local...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$moi = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)).ParentProcessId; Get-CimInstance Win32_Process | Where-Object { ($_.Name -in 'node.exe','java.exe') -and ($_.CommandLine -match 'Alfamous1|firebase|emulat') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $moi } | Stop-Process -Force -ErrorAction SilentlyContinue"
timeout /t 2 /nobreak >nul

echo [2/5] Recuperation de la version a essayer...
git fetch --prune origin
if errorlevel 1 goto echec_git
for /f %%x in ('git status --porcelain --untracked-files=no') do goto modifs
if "%CIBLE%"=="" for /f "usebackq delims=" %%b in (`git for-each-ref --sort=-committerdate --count=2 --format="%%(refname:lstrip=3)" refs/remotes/origin`) do if not defined CIBLE if /i not "%%b"=="HEAD" set "CIBLE=%%b"
if "%CIBLE%"=="" set "CIBLE=main"
git rev-parse --verify --quiet "origin/%CIBLE%" >nul || goto branche_inconnue
if /i "%CIBLE%"=="main" (
  git checkout main || goto echec_git
  git merge --ff-only origin/main || goto echec_git
) else (
  git checkout -B "%CIBLE%" "origin/%CIBLE%" || goto echec_git
)
echo.
echo   ==================================================================
echo     Version essayee : %CIBLE%
git log -1 --date=format:"%%d/%%m/%%Y %%H:%%M" --format="    Dernier changement : %%cd - %%s"
echo   ==================================================================
echo.

echo [3/5] Outils (npm install)...
call npm install --no-audit --no-fund
call npm ci --prefix functions --no-audit --no-fund

echo [4/5] Emulateurs et donnees d essai...
start "Alfamous1 - emulateurs" cmd /d /k npm run emulateurs
node scripts\attendre-emulateurs.mjs
if errorlevel 1 goto echec
call npm run emulateurs:peupler

echo [5/5] Lancement de l application...
start "Alfamous1 - local" cmd /d /k node scripts\servir.mjs
timeout /t 2 /nobreak >nul
start "" "http://localhost:5050/#/q/112"
echo.
echo Tout est lance : http://localhost:5050  - console des emulateurs : http://localhost:4000
echo Version essayee : %CIBLE%
echo Comptes d essai : membre@essai.local, modo@essai.local, admin@essai.local - mot de passe essai123
echo Pour revenir a ce qui est en ligne : ESSAI_LOCAL.bat main
echo Cette fenetre peut etre fermee.
pause
exit

:modifs
echo.
echo ARRET : le dossier contient des modifications locales non enregistrees (git status ci-dessous).
echo Rien n a ete change. Demander a Claude quoi en faire avant de relancer.
git status --short
pause
exit

:branche_inconnue
echo.
echo ARRET : la branche "%CIBLE%" n existe pas sur GitHub. Branches disponibles :
git branch -r
pause
exit

:echec_git
echo.
echo ARRET : git n a pas pu recuperer ou changer de version (connexion ? modifications locales ?).
git status --short
pause
exit

:echec
echo.
echo Les emulateurs n ont pas demarre : lire la fenetre "Alfamous1 - emulateurs".
echo Cause frequente : un ancien emulateur occupe le port 8085 - netstat -ano ^| findstr :8085
pause
exit
