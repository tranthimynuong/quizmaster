@echo off
title QuizMaster Launcher
chcp 65001 >nul
cls
echo ========================================================
echo   KHOI DONG QUIZMASTER (AZOTA/QUIZLET STYLE QUIZ APP)
echo   Backend: FastAPI (Port 8000)
echo   Frontend: React + Vite (Port 5173)
echo   Database: Neon PostgreSQL
echo ========================================================

set SCRIPT_DIR=%~dp0

echo [1/3] Khoi dong Backend Server (FastAPI)...
start "QuizMaster Backend (Port 8000)" cmd /k "title QuizMaster Backend && cd /d "%SCRIPT_DIR%backend" && .\venv\Scripts\python.exe run.py"

echo [2/3] Khoi dong Frontend (React Vite)...
start "QuizMaster Frontend (Port 5173)" cmd /k "title QuizMaster Frontend && cd /d "%SCRIPT_DIR%frontend" && npm run dev"

echo [3/3] Dang mo trinh duyet...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================================
echo   HE THONG DA DUOC KHOI DONG THANH CONG!
echo   - Giao dien Web: http://localhost:5173
echo   - API Docs: http://localhost:8000/docs
echo   (Khong tat 2 cua so Backend va Frontend dang mo)
echo ========================================================
pause

