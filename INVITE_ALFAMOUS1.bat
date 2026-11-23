@echo off
REM Ouvre une invite de commandes directement dans le dossier Alfamous1
REM (quel que soit le dossier de depart habituel de cmd.exe).
cd /d "%~dp0"
title Alfamous1 - invite de commandes
echo Dossier : %CD%
cmd /k "git branch --show-current"
