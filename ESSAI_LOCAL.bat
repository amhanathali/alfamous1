@echo off
REM Essai local complet en un double-clic :
REM   0. mise a jour du code (git pull --ff-only : jamais de fusion) et des outils (npm install)
REM   1. emulateurs Firebase (fenetre "Alfamous1 - emulateurs")
REM   2. comptes, commentaires, notes et fils d essai (npm run emulateurs:peupler)
REM   3. application sur http://localhost:5050 (fenetre "Alfamous1 - local")
REM Pour tout arreter : Ctrl+C dans chacune des deux fenetres, puis O.
REM cmd /d : ignore le reglage AutoRun du PC, qui renvoie sinon vers Desktop\Alfamous.
cd /d "%~dp0"
if "%~1"=="suite" goto suite
REM Bloc lu en entier avant execution : git pull peut modifier ce fichier sans risque,
REM puis la nouvelle version est relancee pour la suite.
(
  title Alfamous1 - essai local
  echo [0/3] Mise a jour du code et des outils...
  git pull --ff-only || echo ATTENTION : mise a jour impossible, modifications locales ? On continue avec la version presente.
  call npm install --no-audit --no-fund
  call npm ci --prefix functions --no-audit --no-fund
  call "%~f0" suite
  exit /b
)
:suite
echo [1/3] Lancement des emulateurs...
start "Alfamous1 - emulateurs" cmd /d /k npm run emulateurs
node scripts\attendre-emulateurs.mjs
if errorlevel 1 goto echec
echo [2/3] Donnees d essai...
call npm run emulateurs:peupler
echo [3/3] Lancement de l application...
start "Alfamous1 - local" cmd /d /k node scripts\servir.mjs
timeout /t 2 /nobreak >nul
start "" "http://localhost:5050/#/q/112"
echo.
echo Tout est lance : http://localhost:5050  - console des emulateurs : http://localhost:4000
echo Comptes d essai : membre@essai.local, modo@essai.local, admin@essai.local - mot de passe essai123
echo Cette fenetre peut etre fermee.
pause
exit /b 0
:echec
echo.
echo Les emulateurs n ont pas demarre : lire la fenetre "Alfamous1 - emulateurs".
echo Cause frequente : un ancien emulateur occupe le port 8085 - netstat -ano ^| findstr :8085
pause
exit /b 1
