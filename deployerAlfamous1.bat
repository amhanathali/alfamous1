@echo off
REM Deploiement d Alfamous1 en un double-clic (accord de l auteur requis avant chaque mise en ligne).
REM   deployerAlfamous1.bat          -> site d essai   (alfamous-essai, https://alfamous-essai.web.app)
REM   deployerAlfamous1.bat prod     -> production     (alfamous-atelier), confirmation "PROD" demandee
REM Etapes :
REM   0. code a jour : branche main, git pull --ff-only (jamais de fusion), npm install
REM   1. tests (npm test) et tests des regles Firestore (npm run test:regles)
REM      (les emulateurs d ESSAI_LOCAL.bat et les autres fenetres cmd sont fermes d abord, automatiquement)
REM   2. construction de dist/ avec les pages publiques des articles (npm run construire -- --articles) :
REM      lecture des articles publies avec la cle de service HORS du depot :
REM        essai : %USERPROFILE%\cles\alfamous-essai.json     prod : %USERPROFILE%\cles\alfamous-atelier.json
REM      cle absente : on demande s il faut continuer sans ces pages
REM   3. mise en ligne : site (Hosting, avec les redirections de l ancien blog), regles et index Firestore,
REM      regles Storage, Cloud Functions
REM --- Dossier Alfamous1 : celui de ce fichier ; en secours %USERPROFILE%\Desktop\Alfamous1.
REM     Jamais le dossier par defaut de cmd (reglage AutoRun du PC vers Desktop\Alfamous).
set "ALFAMOUS1=%~dp0"
if not exist "%ALFAMOUS1%package.json" set "ALFAMOUS1=%USERPROFILE%\Desktop\Alfamous1\"
cd /d "%ALFAMOUS1%" || goto pas_alfamous1
findstr /c:"\"name\": \"alfamous1\"" package.json >nul || goto pas_alfamous1
if "%~1"=="suite" goto suite
REM Bloc lu en entier avant execution : git pull peut modifier ce fichier sans risque,
REM puis la nouvelle version est relancee pour la suite.
(
  title Alfamous1 - deploiement
  echo [0/3] Mise a jour du code (branche main^)...
  REM package-lock.json (regeneres par npm) : remis a leur version GitHub.
  git checkout -- package-lock.json functions/package-lock.json
  git checkout main || goto echec_git
  git pull --ff-only || goto echec_git
  call npm install --no-audit --no-fund
  call npm ci --prefix functions --no-audit --no-fund
  call "%~f0" suite %1
  exit /b
)

:suite
REM Fermeture ici (et non avant la mise a jour) : elle sert aussi au premier lancement apres une mise a jour du fichier.
echo Fermeture des emulateurs, du serveur local et des autres fenetres cmd...
REM --- Fermeture de ce qui peut bloquer : processus qui ecoutent sur les ports %FERMER_PORTS% ;
REM     node/java d Alfamous1 ou de Firebase ; autres fenetres cmd (celle-ci et ses parents sont gardees).
set "FERMER_PORTS=4000,4400,4500,5001,5005,8085,9099,9150,9199,5050"
set "FERMER_TOUT=1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$garder = @(); $p = (Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)).ParentProcessId; while ($p) { $garder += $p; $q = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $p); if (-not $q) { break }; $p = $q.ParentProcessId; if ($garder -contains $p) { break } }; $ports = $env:FERMER_PORTS -split ','; Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { ($ports -contains [string]$_.LocalPort) -and ($garder -notcontains $_.OwningProcess) -and ($_.OwningProcess -gt 4) } | ForEach-Object { 'port ' + $_.LocalPort + ' : ferme ' + $_.OwningProcess; Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; if ($env:FERMER_TOUT -eq '1') { Get-CimInstance Win32_Process | Where-Object { ($_.Name -in 'node.exe','java.exe') -and ($_.CommandLine -match 'Alfamous1|firebase|emulat') -and ($garder -notcontains $_.ProcessId) } | ForEach-Object { 'ferme ' + $_.Name + ' ' + $_.ProcessId; Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $garder -notcontains $_.Id } | ForEach-Object { 'ferme cmd ' + $_.Id; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } }"
timeout /t 2 /nobreak >nul
set CIBLE=essai
set SITE=https://alfamous-essai.web.app
set CLE=%USERPROFILE%\cles\alfamous-essai.json
if /i "%~2"=="prod" (
  set CIBLE=prod
  set SITE=https://alfamous-atelier.web.app
  set CLE=%USERPROFILE%\cles\alfamous-atelier.json
)
if "%CIBLE%"=="prod" (
  echo.
  echo ATTENTION : mise en ligne en PRODUCTION ^(alfamous-atelier^).
  set /p REPONSE=Tapez PROD pour confirmer : 
)
if "%CIBLE%"=="prod" if not "%REPONSE%"=="PROD" (
  echo Annule.
  pause
  exit /b 1
)

echo.
echo [1/3] Tests...
call npm test || goto echec
call npm run test:regles || goto echec_regles

echo.
echo [2/3] Construction de dist/ (application et pages publiques des articles)...
if exist "%CLE%" goto avec_articles
echo.
echo Cle de service introuvable : %CLE%
echo Sans elle, les pages publiques des articles (/articles/...) ne sont pas construites
echo et celles deja en ligne disparaissent a ce deploiement.
set /p SANS=Continuer sans les pages des articles ? (O/N) : 
if /i not "%SANS%"=="O" goto echec
call npm run construire || goto echec
goto construit
:avec_articles
set GOOGLE_APPLICATION_CREDENTIALS=%CLE%
call npm run construire -- --articles --projet %CIBLE% || goto echec
:construit

echo.
echo [3/3] Mise en ligne sur %CIBLE% (site, regles et index Firestore, regles Storage, Cloud Functions)...
call npx firebase deploy --only hosting,firestore,functions,storage --project %CIBLE% || goto echec_deploiement

echo.
echo Deploiement termine : %SITE%
echo Penser a recharger la page avec Ctrl+F5.
pause
exit /b 0

:echec_git
echo.
echo Mise a jour du code impossible : fichiers modifies dans le dossier ? (git status pour voir^)
echo Rien n a ete mis en ligne.
pause
exit /b 1

:echec_regles
echo.
echo Les tests des regles n ont pas pu se lancer ou ont echoue.
echo Lire les messages ci-dessus (un port encore occupe ? relancer ce fichier, il ferme les emulateurs).
echo Rien n a ete mis en ligne.
pause
exit /b 1

:echec_deploiement
echo.
echo La mise en ligne a echoue. Si Firebase demande une connexion : npx firebase login, puis relancer.
pause
exit /b 1

:echec
echo.
echo Echec : rien n a ete mis en ligne. Lire les messages ci-dessus.
pause
exit /b 1

:pas_alfamous1
echo.
echo ARRET : dossier Alfamous1 introuvable (dossier actuel : %CD%).
echo Le fichier .bat doit etre dans Desktop\Alfamous1.
pause
exit /b 1
