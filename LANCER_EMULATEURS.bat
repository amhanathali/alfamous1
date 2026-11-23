@echo off
REM Lance les émulateurs Firebase (Auth, Firestore, Storage) en local, sans toucher au nuage.
REM Console : http://localhost:4000 . Fermer cette fenêtre (ou Ctrl+C) les arrête et garde
REM les données d'essai dans .emulateurs\ .
REM Comptes d'essai (niveaux 0 à 3) : dans une 2e fenêtre, npm run emulateurs:peupler
cd /d "%~dp0"
title Alfamous1 - emulateurs Firebase
if not exist node_modules\firebase-tools (
  echo Premiere fois : installation des outils, npm install...
  call npm install
)
start "" http://localhost:4000
call npm run emulateurs
pause
