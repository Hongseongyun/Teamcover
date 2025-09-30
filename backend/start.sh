#!/bin/bash

# PORT 환경변수가 설정되지 않았으면 기본값 5000 사용
PORT=${PORT:-5000}

echo "Starting gunicorn on port $PORT"

# gunicorn 실행
exec gunicorn app:app \
    --bind "0.0.0.0:${PORT}" \
    --workers 1 \
    --threads 2 \
    --timeout 120 \
    --log-level debug \
    --access-logfile - \
    --error-logfile - \
    --capture-output
