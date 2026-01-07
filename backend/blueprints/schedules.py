from flask import Blueprint, request, jsonify, make_response
from datetime import datetime, timedelta
from models import db, Schedule, ScheduleAttendance, Member, User
from flask_jwt_extended import jwt_required, get_jwt_identity
from utils.club_helpers import get_current_club_id, require_club_membership, check_club_permission

# 일정 관리 Blueprint
schedules_bp = Blueprint('schedules', __name__, url_prefix='/api/schedules')

@schedules_bp.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        response.status_code = 200
        from flask import current_app
        allowed_origins = current_app.config.get('CORS_ALLOWED_ORIGINS', [])
        request_origin = request.headers.get('Origin')
        if request_origin and request_origin in allowed_origins:
            response.headers.add("Access-Control-Allow-Origin", request_origin)
        else:
            # 로컬 개발 환경에서는 모든 origin 허용
            if 'localhost' in str(request_origin):
                response.headers.add("Access-Control-Allow-Origin", request_origin or "*")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Privacy-Token,X-Club-Id")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

@schedules_bp.route('/', methods=['GET'])
@jwt_required(optional=True)
def get_schedules():
    """일정 목록 조회 API"""
    try:
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽을 선택해주세요.'}), 400
        
        # 날짜 범위 필터 (선택적)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = Schedule.query.filter(Schedule.club_id == club_id)
        
        if start_date:
            query = query.filter(Schedule.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        if end_date:
            query = query.filter(Schedule.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
        schedules = query.order_by(Schedule.date.asc(), Schedule.time.asc()).all()
        
        return jsonify({
            'success': True,
            'schedules': [s.to_dict(include_attendances=True) for s in schedules]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@schedules_bp.route('/<int:schedule_id>', methods=['GET'])
@jwt_required(optional=True)
def get_schedule(schedule_id):
    """일정 상세 조회 API"""
    try:
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽을 선택해주세요.'}), 400
        
        schedule = Schedule.query.filter(
            Schedule.id == schedule_id,
            Schedule.club_id == club_id
        ).first()
        
        if not schedule:
            return jsonify({'success': False, 'message': '일정을 찾을 수 없습니다.'}), 404
        
        return jsonify({
            'success': True,
            'schedule': schedule.to_dict(include_attendances=True)
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@schedules_bp.route('/', methods=['POST'])
@jwt_required()
def create_schedule():
    """일정 생성 API"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽을 선택해주세요.'}), 400
        
        data = request.get_json()
        
        # 필수 필드 검증
        required_fields = ['schedule_type', 'title', 'date', 'time', 'max_participants']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'message': f'{field} 필드가 필요합니다.'}), 400
        
        # 날짜와 시간 파싱
        try:
            schedule_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            schedule_time = datetime.strptime(data['time'], '%H:%M').time()
        except ValueError:
            return jsonify({'success': False, 'message': '날짜 또는 시간 형식이 올바르지 않습니다.'}), 400
        
        # 정기전 설정 검증
        is_recurring = data.get('is_recurring', False)
        recurring_config = data.get('recurring_config')
        if is_recurring and not recurring_config:
            return jsonify({'success': False, 'message': '정기전 설정이 필요합니다.'}), 400
        
        schedule = Schedule(
            club_id=club_id,
            schedule_type=data['schedule_type'],
            title=data['title'],
            date=schedule_date,
            time=schedule_time,
            max_participants=data['max_participants'],
            description=data.get('description'),
            is_recurring=is_recurring,
            recurring_config=recurring_config,
            created_by=int(user_id)
        )
        
        db.session.add(schedule)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'schedule': schedule.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@schedules_bp.route('/<int:schedule_id>', methods=['PUT'])
@jwt_required()
def update_schedule(schedule_id):
    """일정 수정 API"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽을 선택해주세요.'}), 400
        
        schedule = Schedule.query.filter(
            Schedule.id == schedule_id,
            Schedule.club_id == club_id
        ).first()
        
        if not schedule:
            return jsonify({'success': False, 'message': '일정을 찾을 수 없습니다.'}), 404
        
        data = request.get_json()
        
        # 권한 확인 (운영진 또는 작성자만 수정 가능)
        current_user = User.query.get(int(user_id))
        is_admin = current_user and (current_user.role in ['super_admin', 'admin'] or check_club_permission(int(user_id), club_id))
        is_creator = schedule.created_by == int(user_id)
        
        if not (is_admin or is_creator):
            return jsonify({'success': False, 'message': '수정 권한이 없습니다.'}), 403
        
        # 필드 업데이트
        if 'title' in data:
            schedule.title = data['title']
        if 'date' in data:
            schedule.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        if 'time' in data:
            schedule.time = datetime.strptime(data['time'], '%H:%M').time()
        if 'max_participants' in data:
            schedule.max_participants = data['max_participants']
        if 'description' in data:
            schedule.description = data['description']
        if 'is_recurring' in data:
            schedule.is_recurring = data['is_recurring']
        if 'recurring_config' in data:
            schedule.recurring_config = data['recurring_config']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'schedule': schedule.to_dict(include_attendances=True)
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@schedules_bp.route('/<int:schedule_id>', methods=['DELETE'])
@jwt_required()
def delete_schedule(schedule_id):
    """일정 삭제 API"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽을 선택해주세요.'}), 400
        
        schedule = Schedule.query.filter(
            Schedule.id == schedule_id,
            Schedule.club_id == club_id
        ).first()
        
        if not schedule:
            return jsonify({'success': False, 'message': '일정을 찾을 수 없습니다.'}), 404
        
        # 권한 확인 (운영진 또는 작성자만 삭제 가능)
        current_user = User.query.get(int(user_id))
        is_admin = current_user and (current_user.role in ['super_admin', 'admin'] or check_club_permission(int(user_id), club_id))
        is_creator = schedule.created_by == int(user_id)
        
        if not (is_admin or is_creator):
            return jsonify({'success': False, 'message': '삭제 권한이 없습니다.'}), 403
        
        db.session.delete(schedule)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '일정이 삭제되었습니다.'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@schedules_bp.route('/<int:schedule_id>/attend', methods=['POST'])
@jwt_required()
def attend_schedule(schedule_id):
    """일정 참석 API - 로그인한 유저 정보 기반

    - member_id가 넘어오면 그대로 사용
    - 없거나 매칭 실패 시, 로그인한 User의 이메일/이름으로 Member를 찾고,
      그래도 없으면 해당 클럽에 Member를 자동 생성한 뒤 참석 처리
    """
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽을 선택해주세요.'}), 400
        
        data = request.get_json() or {}
        member_id = data.get('member_id')
        
        schedule = Schedule.query.filter(
            Schedule.id == schedule_id,
            Schedule.club_id == club_id
        ).first()
        
        if not schedule:
            return jsonify({'success': False, 'message': '일정을 찾을 수 없습니다.'}), 404
        
        # 로그인한 유저 정보 가져오기
        current_user = User.query.get(int(user_id))
        if not current_user:
            return jsonify({'success': False, 'message': '사용자 정보를 찾을 수 없습니다.'}), 404
        
        # 회원 찾기: member_id가 제공되면 사용, 없으면 로그인한 유저의 이메일/이름으로 찾기
        member = None
        if member_id:
            member = Member.query.filter(
                Member.id == member_id,
                Member.club_id == club_id,
                Member.is_deleted == False
            ).first()
        
        # member_id가 없거나 찾지 못한 경우, 로그인한 유저 정보로 회원 찾기
        if not member:
            # 이메일로 먼저 찾기
            if current_user.email:
                member = Member.query.filter(
                    Member.email == current_user.email,
                    Member.club_id == club_id,
                    Member.is_deleted == False
                ).first()
            
            # 이메일로 못 찾으면 이름으로 찾기
            if not member and current_user.name:
                member = Member.query.filter(
                    Member.name == current_user.name,
                    Member.club_id == club_id,
                    Member.is_deleted == False
                ).first()
        
        if not member:
            # 해당 클럽에 속한 Member가 없으면 자동으로 생성
            display_name = current_user.name or (current_user.email.split('@')[0] if current_user.email else '익명')
            member = Member(
                club_id=club_id,
                name=display_name,
                email=current_user.email,
                gender=None,
                level=None,
                note='일정 참석 시 자동 생성된 회원',
                is_deleted=False
            )
            db.session.add(member)
            db.session.flush()  # member.id 확보

        # 이후 로직에서 사용할 member_id를 보정
        member_id = member.id
        
        # 당일 및 시간 확인
        today = datetime.now().date()
        current_time = datetime.now().time()
        
        if schedule.date < today:
            return jsonify({'success': False, 'message': '과거 일정에는 참석할 수 없습니다.'}), 400
        
        if schedule.date == today and schedule.time < current_time:
            return jsonify({'success': False, 'message': '이미 지난 시간입니다.'}), 400
        
        # 중복 참석 확인
        existing = ScheduleAttendance.query.filter(
            ScheduleAttendance.schedule_id == schedule_id,
            ScheduleAttendance.member_id == member_id
        ).first()
        
        if existing:
            if existing.status == 'attending':
                return jsonify({'success': False, 'message': '이미 참석 신청되어 있습니다.'}), 400
            # 거부된 경우 다시 참석 가능
            existing.status = 'attending'
            existing.rejected_by = None
            existing.rejected_at = None
            db.session.commit()
            return jsonify({
                'success': True,
                'attendance': existing.to_dict()
            })
        
        # 최대 인원 확인
        attending_count = ScheduleAttendance.query.filter(
            ScheduleAttendance.schedule_id == schedule_id,
            ScheduleAttendance.status == 'attending'
        ).count()
        
        if attending_count >= schedule.max_participants:
            return jsonify({'success': False, 'message': '참석 인원이 가득 찼습니다.'}), 400
        
        # 참석 추가
        attendance = ScheduleAttendance(
            schedule_id=schedule_id,
            member_id=member_id,
            status='attending'
        )
        
        db.session.add(attendance)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'attendance': attendance.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@schedules_bp.route('/<int:schedule_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_attendance(schedule_id):
    """일정 참석 취소 API - 로그인한 유저 정보 기반"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽을 선택해주세요.'}), 400
        
        data = request.get_json() or {}
        member_id = data.get('member_id')
        
        schedule = Schedule.query.filter(
            Schedule.id == schedule_id,
            Schedule.club_id == club_id
        ).first()
        
        if not schedule:
            return jsonify({'success': False, 'message': '일정을 찾을 수 없습니다.'}), 404
        
        # 로그인한 유저 정보 가져오기
        current_user = User.query.get(int(user_id))
        if not current_user:
            return jsonify({'success': False, 'message': '사용자 정보를 찾을 수 없습니다.'}), 404
        
        # 회원 찾기: member_id가 제공되면 사용, 없으면 로그인한 유저의 이메일/이름으로 찾기
        member = None
        if member_id:
            member = Member.query.filter(
                Member.id == member_id,
                Member.club_id == club_id,
                Member.is_deleted == False
            ).first()
        
        # member_id가 없거나 찾지 못한 경우, 로그인한 유저 정보로 회원 찾기
        if not member:
            # 이메일로 먼저 찾기
            if current_user.email:
                member = Member.query.filter(
                    Member.email == current_user.email,
                    Member.club_id == club_id,
                    Member.is_deleted == False
                ).first()
            
            # 이메일로 못 찾으면 이름으로 찾기
            if not member and current_user.name:
                member = Member.query.filter(
                    Member.name == current_user.name,
                    Member.club_id == club_id,
                    Member.is_deleted == False
                ).first()
        
        if not member:
            return jsonify({'success': False, 'message': '회원 정보를 찾을 수 없습니다.'}), 404

        # 이후 로직에서 사용할 member_id를 보정
        member_id = member.id

        attendance = ScheduleAttendance.query.filter(
            ScheduleAttendance.schedule_id == schedule_id,
            ScheduleAttendance.member_id == member_id
        ).first()
        
        if not attendance:
            return jsonify({'success': False, 'message': '참석 내역을 찾을 수 없습니다.'}), 404
        
        if attendance.status != 'attending':
            return jsonify({'success': False, 'message': '취소할 수 있는 상태가 아닙니다.'}), 400
        
        db.session.delete(attendance)
        db.session.commit()
        
        return jsonify({'success': True, 'message': '참석이 취소되었습니다.'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@schedules_bp.route('/<int:schedule_id>/reject', methods=['POST'])
@jwt_required()
def reject_attendance(schedule_id):
    """일정 참석 거부 API (운영진/슈퍼관리자만)"""
    try:
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽을 선택해주세요.'}), 400
        
        # 권한 확인
        current_user = User.query.get(int(user_id))
        is_admin = current_user and (current_user.role in ['super_admin', 'admin'] or check_club_permission(int(user_id), club_id))
        
        if not is_admin:
            return jsonify({'success': False, 'message': '거부 권한이 없습니다.'}), 403
        
        data = request.get_json()
        member_id = data.get('member_id')
        
        if not member_id:
            return jsonify({'success': False, 'message': '회원 ID가 필요합니다.'}), 400
        
        schedule = Schedule.query.filter(
            Schedule.id == schedule_id,
            Schedule.club_id == club_id
        ).first()
        
        if not schedule:
            return jsonify({'success': False, 'message': '일정을 찾을 수 없습니다.'}), 404
        
        attendance = ScheduleAttendance.query.filter(
            ScheduleAttendance.schedule_id == schedule_id,
            ScheduleAttendance.member_id == member_id
        ).first()
        
        if not attendance:
            return jsonify({'success': False, 'message': '참석 내역을 찾을 수 없습니다.'}), 404
        
        attendance.status = 'rejected'
        attendance.rejected_by = int(user_id)
        attendance.rejected_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'attendance': attendance.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

