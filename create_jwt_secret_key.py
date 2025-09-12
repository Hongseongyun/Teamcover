import random
import string

# 32자리 랜덤 문자열
jwt_secret = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
print(jwt_secret)