@echo off
REM Ouvre une invite de commandes dans le dossier Alfamous1 et met le code a jour.
REM git pull --ff-only : avance seulement si c est sans risque, jamais de fusion.
REM cmd /d : ignore le reglage AutoRun du PC, qui renvoie sinon vers Desktop\Alfamous.
cd /d "%~dp0"
REM Bloc lu en entier avant execution : git pull peut modifier ce fichier sans risque.
(
  title Alfamous1 - invite de commandes
  echo Dossier : %CD%
  git pull --ff-only || echo ATTENTION : mise a jour impossible, modifications locales ?
  cmd /d /k "git branch --show-current"
)
