@echo off
echo Teamcover Docker 환경 시작...
echo.

echo Docker Compose로 서비스 시작...
docker-compose up -d

echo.
echo 모든 서비스가 시작되었습니다.
echo 프론트엔드: http://localhost:3000
echo 백엔드 API: http://localhost:5000
echo 데이터베이스: localhost:5432
echo.
echo 로그 확인: docker-compose logs -f
echo 서비스 중지: docker-compose down
echo.
pause
