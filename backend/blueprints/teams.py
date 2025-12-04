from flask import Blueprint, request, jsonify, make_response
import random
from typing import List, Tuple
from models import db

# 팀 배정 Blueprint
teams_bp = Blueprint('teams', __name__, url_prefix='/api')

@teams_bp.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        from flask import current_app
        allowed_origins = current_app.config.get('CORS_ALLOWED_ORIGINS', [])
        request_origin = request.headers.get('Origin')
        if request_origin and request_origin in allowed_origins:
            response.headers.add("Access-Control-Allow-Origin", request_origin)
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Privacy-Token,X-Club-Id")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

class BowlingTeamMaker:
    def __init__(self):
        self.players = []
    
    def add_player(self, name: str, average: float, gender: str = ""):
        """선수 추가"""
        self.players.append((name, average, gender))
    
    def clear_players(self):
        """모든 선수 제거"""
        self.players.clear()
    
    def remove_player(self, name: str):
        """특정 선수 제거"""
        self.players = [player for player in self.players if player[0].strip() != name.strip()]
    
    def get_players(self):
        """등록된 선수 목록 반환"""
        return self.players
    
    def balance_teams(self, team_count: int, team_size: int) -> List[List[Tuple[str, float, str]]]:
        """팀 밸런싱 알고리즘 (성별 고려, 팀 인원 균일 우선)"""
        players = self.players.copy()
        random.shuffle(players)
        
        required_players = team_count * team_size
        if len(players) < required_players:
            return []
        
        players = players[:required_players]
        teams = [[] for _ in range(team_count)]
        
        # 여성 선수와 남성 선수 분리
        female_players = [p for p in players if p[2].strip().lower() in ['여', '여성', 'f', 'female', '여자']]
        male_players = [p for p in players if p[2].strip().lower() not in ['여', '여성', 'f', 'female', '여자']]
        
        # 에버 기준으로 정렬 (높은 순)
        female_players.sort(key=lambda x: x[1], reverse=True)
        male_players.sort(key=lambda x: x[1], reverse=True)
        
        # 팀별로 정확히 team_size만큼 선수 배정
        current_team = 0
        
        # 여성 선수들을 먼저 고르게 분배
        for player in female_players:
            while len(teams[current_team]) >= team_size:
                current_team = (current_team + 1) % team_count
                if current_team == 0:
                    break
            
            if len(teams[current_team]) < team_size:
                teams[current_team].append(player)
                current_team = (current_team + 1) % team_count
        
        # 남성 선수들을 나머지 자리에 분배
        for player in male_players:
            while len(teams[current_team]) >= team_size:
                current_team = (current_team + 1) % team_count
                if current_team == 0:
                    break
            
            if len(teams[current_team]) < team_size:
                teams[current_team].append(player)
                current_team = (current_team + 1) % team_count
        
        # 팀 밸런싱 최적화
        teams = self.optimize_team_balance(teams, team_size)
        return teams
    
    def optimize_team_balance(self, teams: List[List[Tuple[str, float, str]]], team_size: int) -> List[List[Tuple[str, float, str]]]:
        """팀 밸런싱 최적화 (성별 고려, 팀 인원 유지)"""
        max_iterations = 100
        best_teams = teams.copy()
        best_score = self.calculate_team_balance_score(teams)
        
        for _ in range(max_iterations):
            if len(teams) < 2:
                break
                
            team1_idx = random.randint(0, len(teams) - 1)
            team2_idx = random.randint(0, len(teams) - 1)
            
            if team1_idx == team2_idx or len(teams[team1_idx]) != team_size or len(teams[team2_idx]) != team_size:
                continue
            
            player1_idx = random.randint(0, len(teams[team1_idx]) - 1)
            player2_idx = random.randint(0, len(teams[team2_idx]) - 1)
            
            temp_teams = [team.copy() for team in teams]
            temp_teams[team1_idx][player1_idx], temp_teams[team2_idx][player2_idx] = \
                temp_teams[team2_idx][player2_idx], temp_teams[team1_idx][player1_idx]
            
            valid_teams = True
            for team in temp_teams:
                if len(team) != team_size:
                    valid_teams = False
                    break
            
            if not valid_teams:
                continue
            
            current_score = self.calculate_team_balance_score(temp_teams)
            
            if current_score < best_score:
                best_score = current_score
                best_teams = temp_teams
        
        return best_teams
    
    def calculate_team_balance_score(self, teams: List[List[Tuple[str, float, str]]]) -> float:
        """팀 밸런싱 점수 계산 (에버 분산 + 성별 분산)"""
        # 에버 분산 계산
        team_sums = []
        for team in teams:
            if team:
                team_sum = sum(player[1] for player in team)
                team_sums.append(team_sum)
        
        if not team_sums:
            return float('inf')
        
        mean = sum(team_sums) / len(team_sums)
        variance = sum((x - mean) ** 2 for x in team_sums) / len(team_sums)
        
        # 성별 분산 계산
        female_counts = []
        for team in teams:
            if team:
                female_count = sum(1 for player in team if player[2].strip().lower() in ['여', '여성', 'f', 'female', '여자'])
                female_counts.append(female_count)
        
        if female_counts:
            female_mean = sum(female_counts) / len(female_counts)
            female_variance = sum((x - female_mean) ** 2 for x in female_counts) / len(female_counts)
        else:
            female_variance = 0
        
        # 에버 분산과 성별 분산을 가중 평균 (에버 70%, 성별 30%)
        total_score = variance * 0.7 + female_variance * 0.3
        return total_score

# 전역 팀메이커 인스턴스
team_maker = BowlingTeamMaker()

@teams_bp.route('/add-player', methods=['POST'])
def add_player():
    """선수 추가 API"""
    data = request.get_json()
    name = data.get('name', '').strip()
    average = data.get('average', 0)
    gender = data.get('gender', '').strip()
    
    if not name or average <= 0:
        return jsonify({'success': False, 'message': '이름과 에버를 올바르게 입력해주세요.'})
    
    team_maker.add_player(name, average, gender)
    return jsonify({'success': True, 'message': f'{name} 선수가 추가되었습니다.'})

@teams_bp.route('/get-players', methods=['GET'])
def get_players():
    """등록된 선수 목록 조회 API"""
    players = team_maker.get_players()
    return jsonify({'success': True, 'players': players})

@teams_bp.route('/delete-player', methods=['POST'])
def delete_player():
    """선수 삭제 API"""
    data = request.get_json()
    name = data.get('name', '').strip()
    
    if not name:
        return jsonify({'success': False, 'message': '선수 이름을 입력해주세요.'})
    
    # 해당 선수만 삭제
    team_maker.remove_player(name)
    
    return jsonify({'success': True, 'message': f'{name} 선수가 삭제되었습니다.'})

@teams_bp.route('/clear-players', methods=['POST'])
def clear_players():
    """모든 선수 삭제 API"""
    team_maker.clear_players()
    return jsonify({'success': True, 'message': '모든 선수가 삭제되었습니다.'})

@teams_bp.route('/make-teams', methods=['POST'])
def make_teams():
    """팀짜기 API"""
    data = request.get_json()
    team_count = data.get('team_count', 2)
    team_size = data.get('team_size', 4)
    
    if team_count < 1 or team_size < 1:
        return jsonify({'success': False, 'message': '팀 갯수와 팀 인원은 1 이상이어야 합니다.'})
    
    players = team_maker.get_players()
    required_players = team_count * team_size
    
    if len(players) < required_players:
        return jsonify({'success': False, 'message': f'필요한 선수 수({required_players}명)보다 적은 선수({len(players)}명)가 있습니다.'})
    
    teams = team_maker.balance_teams(team_count, team_size)
    
    if not teams:
        return jsonify({'success': False, 'message': '팀 구성에 실패했습니다.'})
    
    # 팀 결과 포맷팅
    team_results = []
    for i, team in enumerate(teams, 1):
        team_sum = sum(player[1] for player in team)
        female_count = sum(1 for player in team if player[2].strip().lower() in ['여', '여성', 'f', 'female', '여자'])
        male_count = len(team) - female_count
        
        team_results.append({
            'team_number': i,
            'players': [{'name': player[0], 'average': player[1], 'gender': player[2]} for player in team],
            'total_average': team_sum,
            'average_per_player': team_sum / len(team),
            'male_count': male_count,
            'female_count': female_count
        })
    
    # 전체 통계
    all_players = [player for team in teams for player in team]
    total_average = sum(player[1] for player in all_players)
    total_female = sum(1 for player in all_players if player[2].strip().lower() in ['여', '여성', 'f', 'female', '여자'])
    total_male = len(all_players) - total_female
    
    overall_stats = {
        'total_players': len(all_players),
        'total_male': total_male,
        'total_female': total_female,
        'total_average': total_average,
        'overall_average': total_average / len(all_players)
    }
    
    return jsonify({
        'success': True,
        'teams': team_results,
        'overall_stats': overall_stats
    })
