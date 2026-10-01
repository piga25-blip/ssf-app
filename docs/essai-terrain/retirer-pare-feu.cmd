@echo off
rem ============================================================
rem  Application SSF Reseau (test) - retrait de l'autorisation du pare-feu
rem  A lancer apres l'essai (double-clic, puis "Oui").
rem ============================================================
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
netsh advfirewall firewall delete rule name="Application SSF Reseau (test)"
echo.
echo Autorisation retiree.
echo.
pause
