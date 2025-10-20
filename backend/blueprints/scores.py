from flask import Blueprint, request, jsonify
from datetime import datetime
from models import db, Member, Score
from flask_jwt_extended import jwt_required, get_jwt_identity

# 스코어 관리 Blueprint
scores_bp = Blueprint('scores', __name__, url_prefix='/api/scores')

@scores_bp.route('/', methods=['GET'])
@jwt_required(optional=True)
def get_scores():
    """스코어 목록 조회 API"""
    try:
        scores = Score.query.order_by(Score.game_date.desc(), Score.average_score.desc()).all()
        scores_data = []
        
        for score in scores:
            member = Member.query.get(score.member_id)
            scores_data.append({
                'id': score.id,
                'member_name': member.name if member else 'Unknown',
                'member_id': score.member_id,
                'game_date': score.game_date.strftime('%Y-%m-%d') if score.game_date else None,
                'score1': score.score1,
                'score2': score.score2,
                'score3': score.score3,
                'total_score': score.total_score,
                'average_score': score.average_score,
                'note': score.note,
                'created_at': score.created_at.strftime('%Y-%m-%d') if score.created_at else None
            })
        
        return jsonify({
            'success': True,
            'scores': scores_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'스코어 목록 조회 중 오류가 발생했습니다: {str(e)}'})

@scores_bp.route('/', methods=['POST'])
def add_score():
    """스코어 등록 API"""
    try:
        data = request.get_json()
        
        member_name = data.get('member_name', '').strip() if data.get('member_name') else ''
        if not member_name:
            return jsonify({'success': False, 'message': '회원 이름은 필수 입력 항목입니다.'})
        
        member = Member.query.filter_by(name=member_name).first()
        if not member:
            return jsonify({'success': False, 'message': f'등록되지 않은 회원입니다: {member_name}'})
        
        game_date_str = data.get('game_date', '')
        if game_date_str:
            try:
                game_date = datetime.strptime(game_date_str, '%Y-%m-%d').date()
            except ValueError:
                game_date = datetime.now().date()
        else:
            game_date = datetime.now().date()
        
        score1 = data.get('score1', 0) or 0
        score2 = data.get('score2', 0) or 0
        score3 = data.get('score3', 0) or 0
        total_score = score1 + score2 + score3
        average_score = total_score / 3 if total_score > 0 else 0
        
        new_score = Score(
            member_id=member.id,
            game_date=game_date,
            score1=score1,
            score2=score2,
            score3=score3,
            total_score=total_score,
            average_score=round(average_score, 2),
            note=data.get('note', '').strip() if data.get('note') else ''
        )
        
        # 시즌 정보 자동 설정
        new_score.set_season_info()
        
        db.session.add(new_score)
        db.session.commit()
        
        # 스코어 추가 후 회원 티어 업데이트
        new_score.update_member_tier()
        
        return jsonify({
            'success': True, 
            'message': f'{member_name}의 스코어가 등록되었습니다.',
            'score': {
                'id': new_score.id,
                'member_name': member_name,
                'game_date': game_date.strftime('%Y-%m-%d'),
                'total_score': total_score,
                'average_score': round(average_score, 2)
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'스코어 등록 중 오류가 발생했습니다: {str(e)}'})

@scores_bp.route('/<int:score_id>/', methods=['DELETE'])
@scores_bp.route('/<int:score_id>', methods=['DELETE'])
def delete_score(score_id):
    """스코어 삭제 API"""
    try:
        score = Score.query.get_or_404(score_id)
        member = Member.query.get(score.member_id)
        member_name = member.name if member else 'Unknown'
        
        db.session.delete(score)
        db.session.commit()
        
        # 스코어 삭제 후 회원 평균 점수와 티어 업데이트
        if member:
            member.update_average_and_tier()
            db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': f'{member_name}의 스코어가 삭제되었습니다.'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'스코어 삭제 중 오류가 발생했습니다: {str(e)}'})

@scores_bp.route('/<int:score_id>/', methods=['PUT'])
@scores_bp.route('/<int:score_id>', methods=['PUT'])
def update_score(score_id):
    """스코어 수정 API"""
    try:
        data = request.get_json()
        member_name = data.get('member_name', '').strip() if data.get('member_name') else ''
        game_date_str = data.get('game_date', '').strip() if data.get('game_date') else ''
        score1 = data.get('score1', 0)
        score2 = data.get('score2', 0)
        score3 = data.get('score3', 0)
        note = data.get('note', '').strip() if data.get('note') else ''
        
        if not member_name:
            return jsonify({'success': False, 'message': '회원 이름을 입력해주세요.'})
        
        member = Member.query.filter_by(name=member_name).first()
        if not member:
            return jsonify({'success': False, 'message': f'회원 "{member_name}"을 찾을 수 없습니다.'})
        
        try:
            game_date = datetime.strptime(game_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'success': False, 'message': '올바른 날짜 형식을 입력해주세요.'})
        
        score = Score.query.get_or_404(score_id)
        
        score.member_id = member.id
        score.game_date = game_date
        score.score1 = score1
        score.score2 = score2
        score.score3 = score3
        score.total_score = score1 + score2 + score3
        score.average_score = round((score1 + score2 + score3) / 3, 1) if (score1 + score2 + score3) > 0 else 0
        score.note = note
        score.updated_at = datetime.utcnow()
        
        # 시즌 정보 업데이트
        score.set_season_info()
        
        db.session.commit()
        
        # 스코어 수정 후 회원 평균 점수와 티어 업데이트
        member.update_average_and_tier()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'{member_name}의 스코어가 수정되었습니다.'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'스코어 수정 중 오류가 발생했습니다: {str(e)}'})

@scores_bp.route('/averages', methods=['GET'])
@jwt_required(optional=True)
def get_member_averages():
    """회원별 평균(에버) 순위 조회 API"""
    try:
        # 모든 회원 조회
        members = Member.query.all()
        
        # 각 회원의 평균 계산 및 순위 매기기
        member_averages = []
        
        for member in members:
            # 저장된 평균 점수 사용 (없으면 계산)
            if member.average_score is not None:
                # average_score가 있으면 항상 최신 티어 계산
                current_tier = member.calculate_tier_from_score()
                member_averages.append({
                    'member_id': member.id,
                    'member_name': member.name,
                    'average_score': round(member.average_score, 1),
                    'tier': current_tier
                })
            else:
                # 평균 점수가 없으면 계산해서 추가
                regular_avg = member.calculate_regular_season_average()
                if regular_avg is not None:
                    # 계산된 평균으로 티어 계산
                    member.average_score = regular_avg  # 임시로 설정
                    current_tier = member.calculate_tier_from_score()
                    member_averages.append({
                        'member_id': member.id,
                        'member_name': member.name,
                        'average_score': round(regular_avg, 1),
                        'tier': current_tier
                    })
        
        # 평균 점수 기준으로 내림차순 정렬 (높은 점수부터)
        member_averages.sort(key=lambda x: x['average_score'], reverse=True)
        
        # 순위 추가 (1등부터 시작)
        for i, member in enumerate(member_averages):
            member['rank'] = i + 1
        
        return jsonify({
            'success': True,
            'averages': member_averages
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': f'회원별 평균 조회 중 오류가 발생했습니다: {str(e)}'})