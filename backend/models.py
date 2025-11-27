from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """사용자 모델"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')  # 'user', 'admin', 'super_admin'
    google_id = db.Column(db.String(100), unique=True, nullable=True)
    password_hash = db.Column(db.String(128), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # 인증 관련 필드
    is_verified = db.Column(db.Boolean, default=False)  # 인증 완료 여부
    verification_method = db.Column(db.String(20), nullable=True)  # 'email', 'code', 'auto'
    verification_code = db.Column(db.String(10), nullable=True)  # 인증 코드
    verification_code_expires = db.Column(db.DateTime, nullable=True)  # 인증 코드 만료 시간
    verified_at = db.Column(db.DateTime, nullable=True)  # 인증 완료 시간
    
    # 개인정보 보호 비밀번호
    privacy_password_hash = db.Column(db.String(128), nullable=True)  # 개인정보 열람 비밀번호
    
    # 활성 세션 관리
    active_token = db.Column(db.Text, nullable=True)  # 현재 활성화된 JWT 토큰
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    def set_password(self, password):
        """비밀번호 해시화"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """비밀번호 확인"""
        return check_password_hash(self.password_hash, password)
    
    def set_privacy_password(self, password):
        """개인정보 보호 비밀번호 해시화"""
        self.privacy_password_hash = generate_password_hash(password)
    
    def check_privacy_password(self, password):
        """개인정보 보호 비밀번호 확인"""
        if not self.privacy_password_hash:
            return False
        return check_password_hash(self.privacy_password_hash, password)
    
    def to_dict(self):
        """딕셔너리 형태로 변환"""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'role': self.role,
            'google_id': self.google_id,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'verification_method': self.verification_method,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'last_login': self.last_login.strftime('%Y-%m-%d %H:%M:%S') if self.last_login else None,
            'verified_at': self.verified_at.strftime('%Y-%m-%d %H:%M:%S') if self.verified_at else None
        }

class Member(db.Model):
    """회원 모델"""
    __tablename__ = 'members'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    gender = db.Column(db.String(10), nullable=True)  # '남', '여'
    level = db.Column(db.String(20), nullable=True)   # '초급', '중급', '고급', '전문' (레거시)
    tier = db.Column(db.String(20), nullable=True)    # '아이언', '브론즈', '실버', '골드', '플레티넘', '다이아', '마스터', '챌린저'
    average_score = db.Column(db.Float, nullable=True)  # 정기전 평균 점수
    email = db.Column(db.String(100), nullable=True)
    note = db.Column(db.Text, nullable=True)
    join_date = db.Column(db.Date, nullable=True)  # 가입일 (수정 가능)
    is_staff = db.Column(db.Boolean, default=False)  # 운영진 여부
    is_deleted = db.Column(db.Boolean, default=False)  # 삭제 여부 (soft delete)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f'<Member {self.name}>'
    
    def calculate_tier_from_score(self):
        """저장된 평균 점수의 백분위(상위 비율) 기준으로 티어 계산.
        기준(누적 상위 비율): 챌린저 1%, 마스터 3%, 다이아 7%, 플레티넘 12%,
        골드 18%, 실버 22%, 브론즈 20%, 아이언 17% (총 100%).
        """
        if self.average_score is None:
            return '배치'

        # 평균 점수가 있는 모든 회원 집합
        members_with_avg = (
            Member.query.filter(Member.average_score.isnot(None)).with_entities(Member.average_score).all()
        )
        if not members_with_avg:
            return '배치'

        # 내림차순 정렬 후 현재 회원의 순위(동점은 동일 구간으로 처리: 나보다 높은 값의 개수만 카운트)
        scores_desc = sorted((m[0] for m in members_with_avg), reverse=True)
        total = len(scores_desc)
        # 상위에 있는 인원 수
        higher_count = sum(1 for s in scores_desc if s > self.average_score)
        # 본인의 0-based 위치
        position = higher_count
        # 상위 비율(%) 계산
        top_percent = (position / total) * 100.0

        # 누적 상위 비율 구간 매핑
        # 0<=x<1 -> 챌린저, 1<=x<4 -> 마스터, 4<=x<11 -> 다이아, 11<=x<23 -> 플레, 23<=x<41 -> 골드,
        # 41<=x<63 -> 실버, 63<=x<83 -> 브론즈, 83<=x<=100 -> 아이언
        if top_percent < 1:
            return '챌린저'
        if top_percent < 4:
            return '마스터'
        if top_percent < 11:
            return '다이아'
        if top_percent < 23:
            return '플레티넘'
        if top_percent < 41:
            return '골드'
        if top_percent < 63:
            return '실버'
        if top_percent < 83:
            return '브론즈'
        return '아이언'
    
    def calculate_regular_season_average(self):
        """정기전 에버 계산 (반기별 초기화, 폴백 로직 적용) - 평균 점수 업데이트용
        
        계산 우선순위:
        1. 현재 반기 기록 (1-6월 또는 7-12월)
        2. 이전 반기 기록 (같은 연도)
        3. 이전 연도 기록 (최신 순)
        """
        current_date = datetime.now().date()
        current_year = current_date.year
        current_month = current_date.month
        
        # 1. 현재 반기 기록 확인
        if current_month >= 7:  # 7-12월 (하반기)
            current_half_scores = Score.query.filter(
                Score.member_id == self.id,
                Score.is_regular_season == True,
                Score.game_date >= f'{current_year}-07-01',
                Score.game_date < f'{current_year + 1}-01-01'
            ).all()
        else:  # 1-6월 (상반기)
            current_half_scores = Score.query.filter(
                Score.member_id == self.id,
                Score.is_regular_season == True,
                Score.game_date >= f'{current_year}-01-01',
                Score.game_date < f'{current_year}-07-01'
            ).all()
        
        if current_half_scores:
            return self._calculate_average_from_scores(current_half_scores)
        
        # 2. 이전 반기 기록 확인 (같은 연도)
        if current_month >= 7:  # 현재가 하반기면 상반기 확인
            prev_half_scores = Score.query.filter(
                Score.member_id == self.id,
                Score.is_regular_season == True,
                Score.game_date >= f'{current_year}-01-01',
                Score.game_date < f'{current_year}-07-01'
            ).all()
        else:  # 현재가 상반기면 이전 연도 하반기 확인
            prev_year = current_year - 1
            prev_half_scores = Score.query.filter(
                Score.member_id == self.id,
                Score.is_regular_season == True,
                Score.game_date >= f'{prev_year}-07-01',
                Score.game_date < f'{current_year}-01-01'
            ).all()
        
        if prev_half_scores:
            return self._calculate_average_from_scores(prev_half_scores)
        
        # 3. 이전 연도 기록 확인 (최신 순)
        prev_year = current_year - 1
        
        # 이전 연도 하반기 (7-12월)
        prev_year_second_half = Score.query.filter(
            Score.member_id == self.id,
            Score.is_regular_season == True,
            Score.game_date >= f'{prev_year}-07-01',
            Score.game_date < f'{current_year}-01-01'
        ).all()
        
        if prev_year_second_half:
            return self._calculate_average_from_scores(prev_year_second_half)
        
        # 이전 연도 상반기 (1-6월)
        prev_year_first_half = Score.query.filter(
            Score.member_id == self.id,
            Score.is_regular_season == True,
            Score.game_date >= f'{prev_year}-01-01',
            Score.game_date < f'{prev_year}-07-01'
        ).all()
        
        if prev_year_first_half:
            return self._calculate_average_from_scores(prev_year_first_half)
        
        # 4. 아무 기록도 없으면 None 반환 (배치 등급)
        return None
    
    def _calculate_average_from_scores(self, scores):
        """점수 리스트에서 평균 계산 (자연수로 반올림)"""
        if not scores:
            return None
        
        valid_scores = [score.average_score for score in scores if score.average_score is not None]
        if not valid_scores:
            return None
        
        # 평균 계산 후 자연수로 반올림
        average = sum(valid_scores) / len(valid_scores)
        rounded_average = round(average)
        
        return rounded_average
    
    def update_average_score(self):
        """평균 점수 업데이트 (이미 자연수로 반올림됨)"""
        calculated_avg = self.calculate_regular_season_average()
        if calculated_avg is not None:
            self.average_score = calculated_avg  # 이미 자연수로 반올림됨
        else:
            self.average_score = None
        return self.average_score
    
    def update_tier(self):
        """티어 업데이트 (평균 점수 기반)"""
        self.tier = self.calculate_tier_from_score()
        return self.tier
    
    def update_average_and_tier(self):
        """평균 점수와 티어 모두 업데이트"""
        self.update_average_score()
        # average_score가 업데이트되었으므로 티어도 다시 계산
        if self.average_score is not None:
            self.tier = self.calculate_tier_from_score()
        else:
            self.tier = '배치'
        return self.average_score, self.tier
    
    def to_dict(self, hide_privacy=False):
        """딕셔너리 형태로 변환"""
        # 저장된 티어를 사용 (DB에서 이미 계산되어 있음)
        # 티어가 없으면 기본값 '배치' 설정
        if not self.tier:
            self.tier = '배치'
        
        data = {
            'id': self.id,
            'name': self.name,
            'gender': self.gender,
            'level': self.level,  # 레거시 호환성
            'tier': self.tier,
            'average_score': self.average_score,  # 이미 자연수로 저장됨
            'note': self.note,
            'join_date': self.join_date.strftime('%Y-%m-%d') if self.join_date else None,
            'is_staff': self.is_staff,  # 운영진 여부
            'created_at': self.created_at.strftime('%Y-%m-%d') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d') if self.updated_at else None
        }
        
        if hide_privacy:
            # 개인정보 마스킹
            data['phone'] = '***-****-****' if self.phone else None
            if self.email:
                local, domain = self.email.split('@') if '@' in self.email else ('', '')
                if local and domain:
                    data['email'] = f'{local[0]}***@{domain}'
                else:
                    data['email'] = '***@***'
            else:
                data['email'] = None
        else:
            # 원본 데이터 반환
            data['phone'] = self.phone
            data['email'] = self.email
            
        return data

class Score(db.Model):
    """스코어 모델"""
    __tablename__ = 'scores'
    
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    game_date = db.Column(db.Date, nullable=False)
    score1 = db.Column(db.Integer, nullable=True)
    score2 = db.Column(db.Integer, nullable=True)
    score3 = db.Column(db.Integer, nullable=True)
    total_score = db.Column(db.Integer, nullable=True)
    average_score = db.Column(db.Float, nullable=True)
    is_regular_season = db.Column(db.Boolean, default=True)  # 정기전 여부
    season_year = db.Column(db.Integer, nullable=True)  # 시즌 연도
    season_half = db.Column(db.String(10), nullable=True)  # 'first_half' 또는 'second_half'
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 관계 설정
    member = db.relationship('Member', backref=db.backref('scores', lazy=True))
    
    def __repr__(self):
        return f'<Score {self.member.name} {self.game_date}>'
    
    def update_member_tier(self):
        """스코어 추가 후 회원 평균 점수와 티어 업데이트"""
        if self.member:
            self.member.update_average_and_tier()
            db.session.commit()
    
    def set_season_info(self):
        """스코어의 시즌 정보 자동 설정"""
        if not self.game_date:
            return
        
        year = self.game_date.year
        month = self.game_date.month
        
        # 반기 결정 (1-6월: 상반기, 7-12월: 하반기)
        if month <= 6:
            self.season_half = '1H'
        else:
            self.season_half = '2H'
        
        self.season_year = year
        self.is_regular_season = True  # 기본적으로 정기전으로 설정

class Point(db.Model):
    """포인트 모델"""
    __tablename__ = 'points'
    
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    point_date = db.Column(db.Date, nullable=True)  # 구글 시트에서 가져온 날짜
    point_type = db.Column(db.String(20), nullable=False)  # '적립', '사용'
    amount = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(100), nullable=True)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # 시스템 등록 시간
    
    # 관계 설정
    member = db.relationship('Member', backref=db.backref('points', lazy=True))
    
    def __repr__(self):
        return f'<Point {self.member.name} {self.point_type} {self.amount}>'

class AppSetting(db.Model):
    """앱 설정 모델 (전역 설정)"""
    __tablename__ = 'app_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    setting_key = db.Column(db.String(50), unique=True, nullable=False)
    setting_value = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    def __repr__(self):
        return f'<AppSetting {self.setting_key}>'


class FundState(db.Model):
    """회비 시작 월 및 시작 잔액 보관"""
    __tablename__ = 'fund_state'

    id = db.Column(db.Integer, primary_key=True)
    start_month = db.Column(db.String(7), nullable=False)  # 'YYYY-MM'
    opening_balance = db.Column(db.BigInteger, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    def __repr__(self):
        return f'<FundState {self.start_month} {self.opening_balance}>'


class FundLedger(db.Model):
    """회비 장부: 월회비, 정기전, 수기 조정 등 모든 이벤트 기록"""
    __tablename__ = 'fund_ledger'

    id = db.Column(db.Integer, primary_key=True)
    event_date = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    month = db.Column(db.String(7), nullable=False)  # 'YYYY-MM'
    entry_type = db.Column(db.String(10), nullable=False)  # 'credit' or 'debit'
    amount = db.Column(db.BigInteger, nullable=False)
    source = db.Column(db.String(20), nullable=False)  # 'monthly','game','manual'
    payment_id = db.Column(db.Integer, db.ForeignKey('payments.id'), nullable=True)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # 관계
    payment = db.relationship('Payment', backref=db.backref('fund_entries', lazy=True))

    def __repr__(self):
        return f'<FundLedger {self.entry_type} {self.amount} {self.source}>'

class Payment(db.Model):
    """납입 관리 모델"""
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    payment_type = db.Column(db.String(20), nullable=False)  # 'monthly', 'game' (월회비, 정기전 게임비)
    amount = db.Column(db.Integer, nullable=False)  # 금액
    payment_date = db.Column(db.Date, nullable=False)  # 납입일
    month = db.Column(db.String(10), nullable=True)  # 'YYYY-MM' 형식 (검색/통계용)
    is_paid = db.Column(db.Boolean, default=True)  # 납입 여부 (기본값: True)
    is_exempt = db.Column(db.Boolean, default=False)  # 면제 여부 (기본값: False)
    paid_with_points = db.Column(db.Boolean, default=False)  # 포인트로 납부 여부
    note = db.Column(db.Text, nullable=True)  # 비고
    created_at = db.Column(db.DateTime, default=datetime.utcnow)  # 등록 시간
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계 설정
    member = db.relationship('Member', backref=db.backref('payments', lazy=True))
    
    def __repr__(self):
        return f'<Payment {self.member.name} {self.payment_type} {self.amount}원>'
    
    def to_dict(self):
        """딕셔너리 형태로 변환"""
        return {
            'id': self.id,
            'member_id': self.member_id,
            'member_name': self.member.name if self.member else None,
            'payment_type': self.payment_type,
            'amount': self.amount,
            'payment_date': self.payment_date.strftime('%Y-%m-%d') if self.payment_date else None,
            'month': self.month,
            'is_paid': self.is_paid,
            'is_exempt': self.is_exempt,
            'paid_with_points': self.paid_with_points,
            'note': self.note,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        } 