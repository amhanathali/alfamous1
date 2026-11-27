@echo off
REM Ouvre une invite de commandes dans le dossier Alfamous1 et met le code a jour.
REM git pull --ff-only : avance seulement si c est sans risque, jamais de fusion.
REM cmd /d : ignore le reglage AutoRun du PC, qui renvoie sinon vers Desktop\Alfamous.
REM --- Dossier Alfamous1 : celui de ce fichier ; en secours %USERPROFILE%\Desktop\Alfamous1.
REM     Jamais le dossier par defaut de cmd (reglage AutoRun du PC vers Desktop\Alfamous).
set "ALFAMOUS1=%~dp0"
if not exist "%ALFAMOUS1%package.json" set "ALFAMOUS1=%USERPROFILE%\Desktop\Alfamous1\"
cd /d "%ALFAMOUS1%" || goto pas_alfamous1
findstr /c:"\"name\": \"alfamous1\"" package.json >nul || goto pas_alfamous1
REM Bloc lu en entier avant execution : git pull peut modifier ce fichier sans risque.
(
  title Alfamous1 - invite de commandes
  echo Dossier : %CD%
  git pull --ff-only || echo ATTENTION : mise a jour impossible, modifications locales ?
  cmd /d /k "git branch --show-current"
)
goto :eof

:pas_alfamous1
echo.
echo ARRET : dossier Alfamous1 introuvable (dossier actuel : %CD%).
echo Le fichier .bat doit etre dans Desktop\Alfamous1.
pause
exit /b 1
