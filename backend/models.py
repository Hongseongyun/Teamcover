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
    
    # FCM 푸시 알림 토큰
    fcm_token = db.Column(db.Text, nullable=True)  # Firebase Cloud Messaging 토큰
    
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

class Club(db.Model):
    """볼링 클럽 모델"""
    __tablename__ = 'clubs'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)  # 클럽 이름
    description = db.Column(db.Text, nullable=True)  # 클럽 설명
    is_points_enabled = db.Column(db.Boolean, default=False)  # 포인트 시스템 활성화 여부
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # 관계
    creator = db.relationship('User', foreign_keys=[created_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_points_enabled': self.is_points_enabled,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<Club {self.name}>'

class ClubMember(db.Model):
    """사용자-클럽 관계 모델 (다대다)"""
    __tablename__ = 'club_members'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='member')  # 'member', 'admin', 'owner'
    status = db.Column(db.String(20), nullable=False, default='approved')  # 'pending', 'approved', 'rejected'
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)  # 가입 요청 시간
    approved_at = db.Column(db.DateTime, nullable=True)  # 승인 시간
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # 승인한 사용자 ID
    
    # 관계
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('club_memberships', lazy=True))
    club = db.relationship('Club', backref=db.backref('memberships', lazy=True))
    approver = db.relationship('User', foreign_keys=[approved_by])
    
    # 중복 가입 방지
    __table_args__ = (db.UniqueConstraint('user_id', 'club_id', name='unique_user_club'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'club_id': self.club_id,
            'role': self.role,
            'status': self.status,
            'joined_at': self.joined_at.strftime('%Y-%m-%d %H:%M:%S') if self.joined_at else None,
            'requested_at': self.requested_at.strftime('%Y-%m-%d %H:%M:%S') if self.requested_at else None,
            'approved_at': self.approved_at.strftime('%Y-%m-%d %H:%M:%S') if self.approved_at else None,
            'approved_by': self.approved_by,
            'user_name': self.user.name if self.user else None,
            'club_name': self.club.name if self.club else None
        }
    
    def __repr__(self):
        return f'<ClubMember {self.user_id} - {self.club_id} ({self.role}, {self.status})>'

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
    rejoined_at = db.Column(db.DateTime, nullable=True)  # 재가입일 (탈퇴 후 재가입한 경우)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)  # 클럽 ID
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계
    club = db.relationship('Club', backref=db.backref('members', lazy=True))
    
    def __repr__(self):
        return f'<Member {self.name}>'
    
    def calculate_tier_from_score(self):
        """저장된 평균 점수의 백분위(상위 비율) 기준으로 티어 계산.
        기준(누적 상위 비율): 챌린저 1%, 마스터 3%, 다이아 7%, 플레티넘 12%,
        골드 18%, 실버 22%, 브론즈 20%, 아이언 17% (총 100%).
        클럽별로 계산됩니다.
        """
        if self.average_score is None:
            return '배치'

        # 클럽별 평균 점수가 있는 회원 집합
        query = Member.query.filter(
            Member.average_score.isnot(None),
            Member.is_deleted == False
        )
        
        # 클럽별로 필터링
        if self.club_id:
            query = query.filter(Member.club_id == self.club_id)
        
        members_with_avg = query.with_entities(Member.average_score).all()
        
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
        클럽별로 계산됩니다.
        
        계산 우선순위:
        1. 현재 반기 기록 (1-6월 또는 7-12월)
        2. 이전 반기 기록 (같은 연도)
        3. 이전 연도 기록 (최신 순)
        """
        current_date = datetime.now().date()
        current_year = current_date.year
        current_month = current_date.month
        
        # 클럽 필터링을 위한 기본 쿼리 조건
        base_filter = [
            Score.member_id == self.id,
            Score.is_regular_season == True
        ]
        
        # 클럽별 필터링 추가
        if self.club_id:
            base_filter.append(Score.club_id == self.club_id)
        
        # 1. 현재 반기 기록 확인
        if current_month >= 7:  # 7-12월 (하반기)
            current_half_scores = Score.query.filter(
                *base_filter,
                Score.game_date >= f'{current_year}-07-01',
                Score.game_date < f'{current_year + 1}-01-01'
            ).all()
        else:  # 1-6월 (상반기)
            current_half_scores = Score.query.filter(
                *base_filter,
                Score.game_date >= f'{current_year}-01-01',
                Score.game_date < f'{current_year}-07-01'
            ).all()
        
        if current_half_scores:
            return self._calculate_average_from_scores(current_half_scores)
        
        # 2. 이전 반기 기록 확인 (같은 연도)
        if current_month >= 7:  # 현재가 하반기면 상반기 확인
            prev_half_scores = Score.query.filter(
                *base_filter,
                Score.game_date >= f'{current_year}-01-01',
                Score.game_date < f'{current_year}-07-01'
            ).all()
        else:  # 현재가 상반기면 이전 연도 하반기 확인
            prev_year = current_year - 1
            prev_half_scores = Score.query.filter(
                *base_filter,
                Score.game_date >= f'{prev_year}-07-01',
                Score.game_date < f'{current_year}-01-01'
            ).all()
        
        if prev_half_scores:
            return self._calculate_average_from_scores(prev_half_scores)
        
        # 3. 이전 연도 기록 확인 (최신 순)
        prev_year = current_year - 1
        
        # 이전 연도 하반기 (7-12월)
        prev_year_second_half = Score.query.filter(
            *base_filter,
            Score.game_date >= f'{prev_year}-07-01',
            Score.game_date < f'{current_year}-01-01'
        ).all()
        
        if prev_year_second_half:
            return self._calculate_average_from_scores(prev_year_second_half)
        
        # 이전 연도 상반기 (1-6월)
        prev_year_first_half = Score.query.filter(
            *base_filter,
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
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)  # 클럽 ID
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
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)  # 클럽 ID
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


class Message(db.Model):
    """사용자 간 1:1 메시지 모델"""
    __tablename__ = 'messages'

    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)
    is_deleted = db.Column(db.Boolean, default=False)  # 삭제 여부 (soft delete)

    sender = db.relationship('User', foreign_keys=[sender_id], backref=db.backref('sent_messages', lazy=True))
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref=db.backref('received_messages', lazy=True))

    def to_dict(self, current_user_id=None):
        """프론트용 딕셔너리 변환"""
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'receiver_id': self.receiver_id,
            'sender_name': self.sender.name if self.sender else None,
            'receiver_name': self.receiver.name if self.receiver else None,
            'content': self.content if not self.is_deleted else None,  # 삭제된 메시지는 내용 숨김
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'is_read': self.is_read,
            'is_mine': current_user_id is not None and self.sender_id == current_user_id,
            'is_deleted': self.is_deleted,
            # 내가 보낸 메시지인 경우 상대방이 읽었는지 여부
            # 상대방이 받은 메시지 중 내가 보낸 메시지가 읽혔는지 확인
            'is_read_by_receiver': (
                self.is_read 
                if (current_user_id is not None and self.sender_id == current_user_id and self.receiver_id != current_user_id)
                else None
            ),
        }

class Inquiry(db.Model):
    """문의하기 모델"""
    __tablename__ = 'inquiries'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)  # 클럽 ID
    title = db.Column(db.String(30), nullable=False)  # 제목 (30자 이내)
    content = db.Column(db.String(200), nullable=False)  # 내용 (200자 이내)
    is_private = db.Column(db.Boolean, default=True)  # 비공개 여부 (기본값: 비공개)
    reply = db.Column(db.Text, nullable=True)  # 답변 내용
    replied_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # 답변한 사용자 ID
    replied_at = db.Column(db.DateTime, nullable=True)  # 답변 시간
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('inquiries', lazy=True))
    club = db.relationship('Club', backref=db.backref('inquiries', lazy=True))
    replier = db.relationship('User', foreign_keys=[replied_by])
    
    def to_dict(self):
        """프론트용 딕셔너리 변환"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'user_role': self.user.role if self.user else None,  # 작성자 role 추가
            'club_id': self.club_id,
            'club_name': self.club.name if self.club else None,
            'title': self.title,
            'content': self.content,
            'is_private': self.is_private,
            'reply': self.reply,
            'replied_by': self.replied_by,
            'replier_name': self.replier.name if self.replier else None,
            'replied_at': self.replied_at.strftime('%Y-%m-%d %H:%M:%S') if self.replied_at else None,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None,
            'reply_comments': [comment.to_dict() for comment in self.reply_comments] if self.reply_comments else [],
        }
    
    def __repr__(self):
        return f'<Inquiry {self.id} by {self.user_id}>'

class InquiryReplyComment(db.Model):
    """문의 답변 댓글 모델"""
    __tablename__ = 'inquiry_reply_comments'
    
    id = db.Column(db.Integer, primary_key=True)
    inquiry_id = db.Column(db.Integer, db.ForeignKey('inquiries.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('inquiry_reply_comments.id'), nullable=True)  # 대댓글용
    content = db.Column(db.Text, nullable=False)  # 댓글 내용
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계
    inquiry = db.relationship('Inquiry', backref=db.backref('reply_comments', lazy=True, cascade='all, delete-orphan'))
    user = db.relationship('User', backref=db.backref('inquiry_reply_comments', lazy=True))
    parent = db.relationship('InquiryReplyComment', remote_side=[id], backref=db.backref('replies', lazy=True))
    likes = db.relationship('InquiryReplyCommentLike', backref='comment', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self, current_user_id=None):
        """프론트용 딕셔너리 변환"""
        is_liked = False
        if current_user_id:
            is_liked = any(like.user_id == current_user_id for like in self.likes)
        
        return {
            'id': self.id,
            'inquiry_id': self.inquiry_id,
            'user_id': self.user_id,
            'parent_id': self.parent_id,
            'user_name': self.user.name if self.user else None,
            'author_name': self.user.name if self.user else None,  # 게시판과 호환성을 위해 추가
            'content': self.content,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None,
            'like_count': len(self.likes),
            'is_liked': is_liked,
            'replies': [reply.to_dict(current_user_id) for reply in self.replies] if self.replies else []
        }
    
    def __repr__(self):
        return f'<InquiryReplyComment {self.id} on inquiry {self.inquiry_id}>'


class InquiryReplyCommentLike(db.Model):
    """문의 답변 댓글 좋아요 모델"""
    __tablename__ = 'inquiry_reply_comment_likes'
    
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('inquiry_reply_comments.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 관계
    user = db.relationship('User', backref=db.backref('inquiry_reply_comment_likes', lazy=True))
    
    # 중복 좋아요 방지
    __table_args__ = (db.UniqueConstraint('comment_id', 'user_id', name='unique_inquiry_comment_user_like'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'comment_id': self.comment_id,
            'user_id': self.user_id,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

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
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)  # 클럽 ID
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
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)  # 클럽 ID
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


class FundBalanceCache(db.Model):
    """회비 잔액 및 그래프 데이터 캐시"""
    __tablename__ = 'fund_balance_cache'

    id = db.Column(db.Integer, primary_key=True)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True, unique=True)
    current_balance = db.Column(db.BigInteger, nullable=False, default=0)
    balance_series = db.Column(db.JSON, nullable=False, default={})
    last_calculated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<FundBalanceCache club_id={self.club_id} balance={self.current_balance}>'


class FundBalanceSnapshot(db.Model):
    """회비 및 포인트 월별 스냅샷"""
    __tablename__ = 'fund_balance_snapshot'

    id = db.Column(db.Integer, primary_key=True)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)
    month = db.Column(db.String(7), nullable=False)  # 'YYYY-MM' 형식
    fund_balance = db.Column(db.BigInteger, nullable=False, default=0)  # 회비 잔액
    point_balance = db.Column(db.BigInteger, nullable=False, default=0)  # 포인트 잔액
    credit = db.Column(db.BigInteger, nullable=False, default=0)  # 적립
    debit = db.Column(db.BigInteger, nullable=False, default=0)  # 소비
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 클럽별, 월별 유일성 보장
    __table_args__ = (db.UniqueConstraint('club_id', 'month', name='unique_club_month_snapshot'),)

    def __repr__(self):
        return f'<FundBalanceSnapshot club_id={self.club_id} month={self.month} fund={self.fund_balance} point={self.point_balance}>'

class Payment(db.Model):
    """납입 관리 모델"""
    __tablename__ = 'payments'
    
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey('members.id'), nullable=False)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)  # 클럽 ID
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


class Post(db.Model):
    """게시글 모델"""
    __tablename__ = 'posts'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    post_type = db.Column(db.String(20), nullable=False, default='free')  # 'free', 'notice'
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    club_id = db.Column(db.Integer, db.ForeignKey('clubs.id'), nullable=True)  # 클럽 ID
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계
    author = db.relationship('User', backref=db.backref('posts', lazy=True))
    club = db.relationship('Club', backref=db.backref('posts', lazy=True))
    comments = db.relationship('Comment', backref='post', lazy=True, cascade='all, delete-orphan')
    likes = db.relationship('Like', backref='post', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'post_type': self.post_type,
            'author_id': self.author_id,
            'author_name': self.author.name if self.author else None,
            'author_role': self.author.role if self.author else None,  # 작성자 role 추가
            'club_id': self.club_id,
            'club_name': self.club.name if self.club else None,
            'is_global': self.club_id is None,  # 전체 게시글 여부
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None,
            'comment_count': len(self.comments),
            'like_count': len(self.likes),
            'images': [img.url for img in self.images]
        }


class PostImage(db.Model):
    """게시글 이미지 모델"""
    __tablename__ = 'post_images'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 관계
    post = db.relationship('Post', backref=db.backref('images', lazy=True, cascade='all, delete-orphan'))


class Comment(db.Model):
    """댓글 모델"""
    __tablename__ = 'comments'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=True)  # 대댓글용
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 관계
    author = db.relationship('User', backref=db.backref('comments', lazy=True))
    parent = db.relationship('Comment', remote_side=[id], backref=db.backref('replies', lazy=True))
    likes = db.relationship('CommentLike', backref='comment', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'post_id': self.post_id,
            'author_id': self.author_id,
            'parent_id': self.parent_id,
            'author_name': self.author.name if self.author else None,
            'content': self.content,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None,
            'like_count': len(self.likes),
            'replies': [reply.to_dict() for reply in self.replies] if self.replies else []
        }


class CommentLike(db.Model):
    """댓글 좋아요 모델"""
    __tablename__ = 'comment_likes'
    
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 관계
    user = db.relationship('User', backref=db.backref('comment_likes', lazy=True))
    
    # 중복 좋아요 방지
    __table_args__ = (db.UniqueConstraint('comment_id', 'user_id', name='unique_comment_user_like'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'comment_id': self.comment_id,
            'user_id': self.user_id,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }


class Like(db.Model):
    """좋아요 모델"""
    __tablename__ = 'likes'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('posts.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 관계
    user = db.relationship('User', backref=db.backref('likes', lazy=True))
    
    # 중복 좋아요 방지
    __table_args__ = (db.UniqueConstraint('post_id', 'user_id', name='unique_post_user_like'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'post_id': self.post_id,
            'user_id': self.user_id,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        } 