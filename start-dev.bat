@echo off
echo Teamcover 개발 환경 시작...
echo.

echo 백엔드 서버 시작...
cd backend
start "Backend Server" cmd /k "python app.py"
cd ..

echo.
echo 프론트엔드 서버 시작...
cd frontend
start "Frontend Server" cmd /k "npm start"
cd ..

echo.
echo 모든 서비스가 시작되었습니다.
echo 백엔드: http://localhost:5000
echo 프론트엔드: http://localhost:3000
echo.
pause
