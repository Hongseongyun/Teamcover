FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 패키지 설치
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 포트 노출 (Railway가 동적으로 포트를 할당하지만, 여기는 기본값 사용)
EXPOSE 5000

# Railway의 startCommand가 이 CMD를 덮어씁니다
# 쉘 형식으로 변경하여 환경변수가 제대로 확장되도록 함
CMD gunicorn app:app --bind 0.0.0.0:${PORT:-5000} --workers 1 --threads 2 --timeout 120 --log-level debug --access-logfile - --error-logfile - --capture-output
