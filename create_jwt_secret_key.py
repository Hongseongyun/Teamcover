import random
import secrets
import string

# 32자리 랜덤 문자열
jwt_secret = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
print(f"JWT_SECRET_KEY={jwt_secret}")


secret_key = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
print(f"FLASK_SECRET_KEY={secret_key}")