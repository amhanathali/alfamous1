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
REM  modifier ce fichier pendant qu il tourne. Journal : essai-local.log (dans ce dossier, non versionne).
REM  package-lock.json et functions\package-lock.json (regeneres par npm) sont remis a leur version GitHub.
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
set "JOURNAL=%CD%\essai-local.log"
set "TMPE=%TEMP%\essai-alfamous1"
if not exist "%TMPE%" mkdir "%TMPE%"
title Alfamous1 - essai local
echo Essai local du %DATE% %TIME% dans %CD% > "%JOURNAL%"
echo.
echo [1/5] Fermeture des autres fenetres cmd, des emulateurs et du serveur local...
REM Garde ce cmd et tous ses parents ; ferme les autres cmd, et node/java d Alfamous1 ou de Firebase.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$garder = @(); $p = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)).ParentProcessId; while ($p) { $garder += $p; $q = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $p); if (-not $q) { break }; $p = $q.ParentProcessId; if ($garder -contains $p) { break } }; Get-CimInstance Win32_Process | Where-Object { ($_.Name -in 'node.exe','java.exe') -and ($_.CommandLine -match 'Alfamous1|firebase|emulat') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $garder -notcontains $_.Id } | ForEach-Object { 'ferme cmd ' + $_.Id; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }" >> "%JOURNAL%" 2>&1
timeout /t 2 /nobreak >nul

echo [2/5] Recuperation de la version a essayer...
REM Aucune commande git dans une sous-invite (for /f) : le reglage AutoRun du PC la renverrait vers Desktop\Alfamous.
git fetch --prune origin >> "%JOURNAL%" 2>&1
if errorlevel 1 goto echec_git
REM Fichiers regeneres par npm : remis a leur version GitHub avant la verification.
git checkout -- package-lock.json functions/package-lock.json >> "%JOURNAL%" 2>&1
git status --porcelain --untracked-files=no > "%TMPE%\statut.txt" 2>> "%JOURNAL%"
for %%F in ("%TMPE%\statut.txt") do if %%~zF GTR 0 goto modifs
if not "%CIBLE%"=="" goto cible_choisie
git for-each-ref --sort=-committerdate --count=3 --format="%%(refname)" refs/remotes/origin > "%TMPE%\branches.txt" 2>> "%JOURNAL%"
findstr /v /x /c:"refs/remotes/origin/HEAD" "%TMPE%\branches.txt" > "%TMPE%\branche.txt"
set "REF="
set /p REF=< "%TMPE%\branche.txt"
type "%TMPE%\branches.txt" >> "%JOURNAL%"
if not defined REF set "REF=refs/remotes/origin/main"
set "CIBLE=%REF:refs/remotes/origin/=%"
:cible_choisie
echo Branche choisie : %CIBLE% >> "%JOURNAL%"
git rev-parse --verify --quiet "origin/%CIBLE%" >nul 2>&1 || goto branche_inconnue
if /i "%CIBLE%"=="main" (
  git checkout main >> "%JOURNAL%" 2>&1 || goto echec_git
  git merge --ff-only origin/main >> "%JOURNAL%" 2>&1 || goto echec_git
) else (
  git checkout -B "%CIBLE%" "origin/%CIBLE%" >> "%JOURNAL%" 2>&1 || goto echec_git
)
echo.
echo   ==================================================================
echo     Version essayee : %CIBLE%
git log -1 --date=format:"%%d/%%m/%%Y %%H:%%M" --format="    Dernier changement : %%cd - %%s"
echo   ==================================================================
echo.
git log -1 --format="Version : %%h %%s" >> "%JOURNAL%"

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
echo OK tout est lance >> "%JOURNAL%"
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
git status --short >> "%JOURNAL%"
pause
exit

:branche_inconnue
echo.
echo ARRET : la branche "%CIBLE%" n existe pas sur GitHub. Branches disponibles :
echo ARRET branche inconnue %CIBLE% >> "%JOURNAL%"
git branch -r
pause
exit

:echec_git
echo.
echo ARRET : git n a pas pu recuperer ou changer de version (connexion ? modifications locales ?).
echo ARRET echec git - voir les lignes precedentes du journal >> "%JOURNAL%"
git status --short
pause
exit

:echec
echo.
echo Les emulateurs n ont pas demarre : lire la fenetre "Alfamous1 - emulateurs".
echo ARRET emulateurs non demarres >> "%JOURNAL%"
echo Cause frequente : un ancien emulateur occupe le port 8085 - netstat -ano ^| findstr :8085
pause
exit
