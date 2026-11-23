@echo off
REM Ouvre Alfamous1 en local, sans déployer (mode développement).
REM Une modification du code se voit en rechargeant la page (F5).
REM Fermer cette fenêtre (ou Ctrl+C) arrête le serveur.
cd /d "%~dp0"
title Alfamous1 - local
start "" http://localhost:5050
node scripts\servir.mjs
pause
