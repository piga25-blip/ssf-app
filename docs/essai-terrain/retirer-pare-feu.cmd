@echo off
rem ============================================================
rem  Application SSF - retrait de l'autorisation du pare-feu
rem  (retire aussi celle de l'ancienne version de test)
rem  Double-clic, puis "Oui". L'application la redemandera a la
rem  prochaine activation du mode reseau.
rem ============================================================
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
netsh advfirewall firewall delete rule name="Application SSF" >nul 2>&1
netsh advfirewall firewall delete rule name="Application SSF Reseau (test)" >nul 2>&1
echo.
echo Autorisation retiree.
echo.
pause
