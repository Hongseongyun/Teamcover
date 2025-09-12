import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import random
from typing import List, Tuple
import json
import os

# 구글 시트 연동 (선택적)
try:
    import gspread
    from google.oauth2.service_account import Credentials
    GOOGLE_SHEETS_AVAILABLE = True
except ImportError:
    GOOGLE_SHEETS_AVAILABLE = False

class BowlingTeamMaker:
    def __init__(self, root):
        self.root = root
        self.root.title("볼링 팀짜기 프로그램")
        self.root.geometry("900x800")
        
        # 데이터 저장용
        self.players = []
        self.teams = []
        
        self.setup_ui()
    
    def setup_ui(self):
        # 메인 캔버스와 스크롤바
        canvas = tk.Canvas(self.root)
        scrollbar = ttk.Scrollbar(self.root, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # 캔버스와 스크롤바 배치
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # 마우스 휠 스크롤 바인딩
        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        canvas.bind_all("<MouseWheel>", _on_mousewheel)
        
        # 메인 프레임
        main_frame = ttk.Frame(scrollable_frame, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 입력 섹션
        input_frame = ttk.LabelFrame(main_frame, text="선수 정보 입력", padding="10")
        input_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 이름 입력
        ttk.Label(input_frame, text="이름:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
        self.name_entry = ttk.Entry(input_frame, width=15)
        self.name_entry.grid(row=0, column=1, sticky=tk.W, padx=(0, 10))
        
        # 에버 입력
        ttk.Label(input_frame, text="에버(평균점수):").grid(row=0, column=2, sticky=tk.W, padx=(0, 5))
        self.average_entry = ttk.Entry(input_frame, width=10)
        self.average_entry.grid(row=0, column=3, sticky=tk.W, padx=(0, 10))
        
        # 선수 추가 버튼
        add_btn = ttk.Button(input_frame, text="선수 추가", command=self.add_player)
        add_btn.grid(row=0, column=4, padx=(10, 0))
        
        # 대량 데이터 입력 섹션
        bulk_frame = ttk.LabelFrame(main_frame, text="대량 데이터 입력", padding="10")
        bulk_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # 대량 입력 안내
        ttk.Label(bulk_frame, text="형식: 이름 탭 에버 (한 줄에 한 명씩)").grid(row=0, column=0, columnspan=2, sticky=tk.W, pady=(0, 5))
        
        # 텍스트 영역
        self.bulk_text = tk.Text(bulk_frame, height=8, width=60)
        self.bulk_text.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 10))
        
        # 마우스 휠 스크롤 바인딩 (대량 입력 텍스트에만)
        def _on_bulk_mousewheel(event):
            self.bulk_text.yview_scroll(int(-1*(event.delta/120)), "units")
            # 이벤트 전파 중단 (전체 화면 스크롤 방지)
            return "break"
        self.bulk_text.bind("<MouseWheel>", _on_bulk_mousewheel)
        
        # 스크롤바
        bulk_scrollbar = ttk.Scrollbar(bulk_frame, orient=tk.VERTICAL, command=self.bulk_text.yview)
        bulk_scrollbar.grid(row=1, column=1, sticky=(tk.N, tk.S))
        self.bulk_text.configure(yscrollcommand=bulk_scrollbar.set)
        
        # 대량 추가 버튼
        bulk_add_btn = ttk.Button(bulk_frame, text="대량 추가", command=self.add_bulk_players)
        bulk_add_btn.grid(row=2, column=0, pady=(10, 0))
        
        # 텍스트 초기화 버튼
        clear_btn = ttk.Button(bulk_frame, text="텍스트 초기화", command=self.clear_bulk_text)
        clear_btn.grid(row=2, column=1, pady=(10, 0), padx=(10, 0))
        
        # 구글 시트 연동 섹션 (선택적)
        if GOOGLE_SHEETS_AVAILABLE:
            gsheet_frame = ttk.LabelFrame(main_frame, text="구글 시트 연동", padding="10")
            gsheet_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
            
            # 인증 파일 선택
            ttk.Label(gsheet_frame, text="인증 파일:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
            self.auth_file_entry = ttk.Entry(gsheet_frame, width=40)
            self.auth_file_entry.grid(row=0, column=1, sticky=tk.W, padx=(0, 10))
            
            browse_btn = ttk.Button(gsheet_frame, text="찾아보기", command=self.browse_auth_file)
            browse_btn.grid(row=0, column=2, padx=(0, 10))
            
            # 시트 URL 입력
            ttk.Label(gsheet_frame, text="시트 URL:").grid(row=1, column=0, sticky=tk.W, padx=(0, 5), pady=(5, 0))
            self.sheet_url_entry = ttk.Entry(gsheet_frame, width=60)
            self.sheet_url_entry.grid(row=1, column=1, columnspan=2, sticky=tk.W, pady=(5, 0))
            
            # 시트 이름 입력
            ttk.Label(gsheet_frame, text="시트 이름:").grid(row=2, column=0, sticky=tk.W, padx=(0, 5), pady=(5, 0))
            self.sheet_name_entry = ttk.Entry(gsheet_frame, width=20)
            self.sheet_name_entry.grid(row=2, column=1, sticky=tk.W, pady=(5, 0))
            self.sheet_name_entry.insert(0, "Sheet1")
            
            # 데이터 가져오기 버튼
            load_btn = ttk.Button(gsheet_frame, text="시트에서 데이터 가져오기", command=self.load_from_sheet)
            load_btn.grid(row=2, column=2, padx=(10, 0), pady=(5, 0))
            
            # 시트 미리보기
            preview_frame = ttk.LabelFrame(gsheet_frame, text="시트 미리보기", padding="5")
            preview_frame.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(10, 0))
            
            # 미리보기 트리뷰
            preview_columns = ("이름", "에버", "성별", "선택")
            self.preview_tree = ttk.Treeview(preview_frame, columns=preview_columns, show="headings", height=6)
            
            # 컬럼 설정
            self.preview_tree.heading("이름", text="이름")
            self.preview_tree.heading("에버", text="에버")
            self.preview_tree.heading("성별", text="성별")
            self.preview_tree.heading("선택", text="선택")
            
            self.preview_tree.column("이름", width=120, anchor="center")
            self.preview_tree.column("에버", width=80, anchor="center")
            self.preview_tree.column("성별", width=60, anchor="center")
            self.preview_tree.column("선택", width=60, anchor="center")
            
            # 트리뷰 클릭 이벤트 바인딩 (체크박스 토글)
            self.preview_tree.bind("<Button-1>", self.on_tree_click)
            
            # 마우스 휠 스크롤 바인딩 (미리보기 트리뷰에만)
            def _on_preview_mousewheel(event):
                self.preview_tree.yview_scroll(int(-1*(event.delta/120)), "units")
                # 이벤트 전파 중단 (전체 화면 스크롤 방지)
                return "break"
            self.preview_tree.bind("<MouseWheel>", _on_preview_mousewheel)
            
            # 선택 표시 비활성화 (파란줄 제거)
            self.preview_tree.configure(selectmode="none")
            
            self.preview_tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
            
            # 미리보기 스크롤바
            preview_scrollbar = ttk.Scrollbar(preview_frame, orient=tk.VERTICAL, command=self.preview_tree.yview)
            preview_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
            self.preview_tree.configure(yscrollcommand=preview_scrollbar.set)
            
            # 선택된 선수 수 표시 라벨
            self.selected_count_label = ttk.Label(preview_frame, text="선택된 선수: 0명")
            self.selected_count_label.grid(row=1, column=0, columnspan=2, pady=(5, 0))
            
            # 선택된 선수 추가 버튼
            add_selected_btn = ttk.Button(preview_frame, text="선택된 선수 추가", command=self.add_selected_players)
            add_selected_btn.grid(row=2, column=0, pady=(10, 0))
            
            # 전체 선택/해제 버튼
            select_all_btn = ttk.Button(preview_frame, text="전체 선택", command=self.select_all_players)
            select_all_btn.grid(row=2, column=1, pady=(10, 0), padx=(10, 0))
            
            deselect_all_btn = ttk.Button(preview_frame, text="전체 해제", command=self.deselect_all_players)
            deselect_all_btn.grid(row=2, column=2, pady=(10, 0), padx=(10, 0))
            
            # 그리드 가중치 설정
            gsheet_frame.columnconfigure(1, weight=1)
            preview_frame.columnconfigure(0, weight=1)
            preview_frame.rowconfigure(0, weight=1)
            
            # 시트 데이터 저장용
            self.sheet_data = []
        
        # 선수 목록
        list_frame = ttk.LabelFrame(main_frame, text="등록된 선수 목록", padding="10")
        list_frame.grid(row=3 if GOOGLE_SHEETS_AVAILABLE else 2, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        # 트리뷰 생성
        columns = ("이름", "에버", "성별")
        self.player_tree = ttk.Treeview(list_frame, columns=columns, show="headings", height=8)
        
        for col in columns:
            self.player_tree.heading(col, text=col)
            if col == "이름":
                self.player_tree.column(col, width=120, anchor="center")
            elif col == "에버":
                self.player_tree.column(col, width=80, anchor="center")
            else:  # 성별
                self.player_tree.column(col, width=60, anchor="center")
        
        self.player_tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 마우스 휠 스크롤 바인딩 (등록된 선수 목록 트리뷰에만)
        def _on_player_mousewheel(event):
            self.player_tree.yview_scroll(int(-1*(event.delta/120)), "units")
            # 이벤트 전파 중단 (전체 화면 스크롤 방지)
            return "break"
        self.player_tree.bind("<MouseWheel>", _on_player_mousewheel)
        
        # 스크롤바
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.player_tree.yview)
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.player_tree.configure(yscrollcommand=scrollbar.set)
        
        # 선수 삭제 버튼
        delete_btn = ttk.Button(list_frame, text="선택된 선수 삭제", command=self.delete_player)
        delete_btn.grid(row=1, column=0, pady=(10, 0))
        
        # 팀 설정 섹션
        team_frame = ttk.LabelFrame(main_frame, text="팀 설정", padding="10")
        team_frame.grid(row=4, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(team_frame, text="팀 갯수:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))
        self.team_count_entry = ttk.Entry(team_frame, width=10)
        self.team_count_entry.grid(row=0, column=1, sticky=tk.W, padx=(0, 10))
        self.team_count_entry.insert(0, "2")
        
        ttk.Label(team_frame, text="팀 인원:").grid(row=0, column=2, sticky=tk.W, padx=(0, 5))
        self.team_size_entry = ttk.Entry(team_frame, width=10)
        self.team_size_entry.grid(row=0, column=3, sticky=tk.W, padx=(0, 10))
        self.team_size_entry.insert(0, "4")
        
        # 팀짜기 버튼
        make_teams_btn = ttk.Button(team_frame, text="팀짜기", command=self.make_teams)
        make_teams_btn.grid(row=0, column=4, padx=(10, 0))
        
        # 팀 결과 섹션
        result_frame = ttk.LabelFrame(main_frame, text="팀 결과", padding="10")
        result_frame.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 결과 텍스트
        self.result_text = tk.Text(result_frame, height=15, width=80)
        self.result_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 결과 스크롤바
        result_scrollbar = ttk.Scrollbar(result_frame, orient=tk.VERTICAL, command=self.result_text.yview)
        result_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.result_text.configure(yscrollcommand=result_scrollbar.set)
        
        # 그리드 가중치 설정
        scrollable_frame.columnconfigure(0, weight=1)
        scrollable_frame.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(3 if GOOGLE_SHEETS_AVAILABLE else 2, weight=1)
        main_frame.rowconfigure(5 if GOOGLE_SHEETS_AVAILABLE else 4, weight=1)
        bulk_frame.columnconfigure(0, weight=1)
        bulk_frame.rowconfigure(1, weight=1)
        list_frame.columnconfigure(0, weight=1)
        list_frame.rowconfigure(0, weight=1)
        result_frame.columnconfigure(0, weight=1)
        result_frame.rowconfigure(0, weight=1)
    
    def add_player(self):
        name = self.name_entry.get().strip()
        average_str = self.average_entry.get().strip()
        
        if not name or not average_str:
            messagebox.showerror("오류", "모든 필드를 입력해주세요.")
            return
        
        try:
            average = float(average_str)
            
            if average < 0:
                messagebox.showerror("오류", "에버는 0 이상이어야 합니다.")
                return
                
        except ValueError:
            messagebox.showerror("오류", "에버는 숫자로 입력해주세요.")
            return
        
        # 선수 추가 (중복 허용) - 성별 정보는 빈 문자열로 설정
        self.players.append((name, average, ""))
        self.player_tree.insert("", "end", values=(name, f"{average:.1f}", ""))
        
        # 입력 필드 초기화
        self.name_entry.delete(0, tk.END)
        self.average_entry.delete(0, tk.END)
        self.name_entry.focus()
    
    def add_bulk_players(self):
        """대량 데이터로 선수 추가"""
        text_content = self.bulk_text.get(1.0, tk.END).strip()
        
        if not text_content:
            messagebox.showwarning("경고", "입력할 데이터가 없습니다.")
            return
        
        lines = text_content.split('\n')
        added_count = 0
        error_count = 0
        error_messages = []
        
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue
            
            # 탭이나 공백으로 분리
            parts = line.split('\t') if '\t' in line else line.split()
            
            if len(parts) != 2:
                error_messages.append(f"줄 {line_num}: 형식 오류 (이름 에버)")
                error_count += 1
                continue
            
            name, average_str = parts
            
            # 이름 검증
            if not name.strip():
                error_messages.append(f"줄 {line_num}: 이름이 비어있습니다.")
                error_count += 1
                continue
            
            # 에버 검증
            try:
                average = float(average_str)
                if average < 0:
                    error_messages.append(f"줄 {line_num}: 에버는 0 이상이어야 합니다.")
                    error_count += 1
                    continue
            except ValueError:
                error_messages.append(f"줄 {line_num}: 에버는 숫자로 입력해주세요.")
                error_count += 1
                continue
            
            # 선수 추가 (중복 허용) - 성별 정보는 빈 문자열로 설정
            self.players.append((name, average, ""))
            self.player_tree.insert("", "end", values=(name, f"{average:.1f}", ""))
            added_count += 1
        
        # 결과 메시지 표시
        if added_count > 0:
            message = f"{added_count}명의 선수가 추가되었습니다."
            if error_count > 0:
                message += f"\n{error_count}개의 오류가 발생했습니다."
            messagebox.showinfo("대량 추가 완료", message)
        
        if error_count > 0 and error_messages:
            error_text = "\n".join(error_messages[:10])  # 최대 10개까지만 표시
            if len(error_messages) > 10:
                error_text += f"\n... 외 {len(error_messages) - 10}개 오류"
            messagebox.showerror("오류 목록", error_text)
    
    def clear_bulk_text(self):
        """대량 입력 텍스트 초기화"""
        self.bulk_text.delete(1.0, tk.END)
    
    def delete_player(self):
        selected_item = self.player_tree.selection()
        if not selected_item:
            messagebox.showwarning("경고", "삭제할 선수를 선택해주세요.")
            return
        
        values = self.player_tree.item(selected_item[0])["values"]
        name = values[0]
        
        # 리스트에서도 삭제
        self.players = [(n, a, t) for n, a, t in self.players if n != name]
        
        # 트리뷰에서 삭제
        self.player_tree.delete(selected_item[0])
    
    def make_teams(self):
        if len(self.players) < 2:
            messagebox.showerror("오류", "최소 2명 이상의 선수가 필요합니다.")
            return
        
        try:
            team_count = int(self.team_count_entry.get())
            team_size = int(self.team_size_entry.get())
            
            if team_count < 1:
                messagebox.showerror("오류", "팀 갯수는 1개 이상이어야 합니다.")
                return
                
            if team_size < 1:
                messagebox.showerror("오류", "팀 인원은 1명 이상이어야 합니다.")
                return
                
        except ValueError:
            messagebox.showerror("오류", "팀 갯수와 팀 인원은 정수로 입력해주세요.")
            return
        
        # 필요한 총 선수 수 계산
        required_players = team_count * team_size
        
        if len(self.players) < required_players:
            messagebox.showerror("오류", f"팀 갯수({team_count}개) × 팀 인원({team_size}명) = {required_players}명이 필요한데, 현재 {len(self.players)}명의 선수만 있습니다.")
            return
        
        if len(self.players) > required_players:
            messagebox.showwarning("경고", f"팀 갯수({team_count}개) × 팀 인원({team_size}명) = {required_players}명이 필요한데, 현재 {len(self.players)}명의 선수가 있습니다. 일부 선수는 제외됩니다.")
        
        # 팀짜기 알고리즘 실행
        teams = self.balance_teams(team_count, team_size)
        
        # 팀 구성이 실패한 경우
        if not teams:
            return
        
        # 결과 표시
        self.display_teams(teams)
    
    def balance_teams(self, team_count: int, team_size: int) -> List[List[Tuple[str, float, str]]]:
        """팀 밸런싱 알고리즘 (성별 고려, 팀 인원 균일 우선)"""
        players = self.players.copy()
        random.shuffle(players)  # 초기 랜덤 셔플
        
        # 필요한 선수 수만큼만 사용
        required_players = team_count * team_size
        if len(players) < required_players:
            messagebox.showerror("오류", f"필요한 선수 수({required_players}명)보다 적은 선수({len(players)}명)가 있습니다.")
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
        
        # 여성 선수들을 먼저 고르게 분배 (팀 인원 제한 고려)
        for i, player in enumerate(female_players):
            # 현재 팀이 가득 찼으면 다음 팀으로
            while len(teams[current_team]) >= team_size:
                current_team = (current_team + 1) % team_count
                if current_team == 0:  # 모든 팀이 가득 찬 경우
                    break
            
            if len(teams[current_team]) < team_size:
                teams[current_team].append(player)
                current_team = (current_team + 1) % team_count
        
        # 남성 선수들을 나머지 자리에 분배
        for i, player in enumerate(male_players):
            # 현재 팀이 가득 찼으면 다음 팀으로
            while len(teams[current_team]) >= team_size:
                current_team = (current_team + 1) % team_count
                if current_team == 0:  # 모든 팀이 가득 찬 경우
                    break
            
            if len(teams[current_team]) < team_size:
                teams[current_team].append(player)
                current_team = (current_team + 1) % team_count
        
        # 팀 밸런싱 최적화 (성별 고려, 팀 인원 유지)
        teams = self.optimize_team_balance(teams, team_size)
        
        return teams
    
    def optimize_team_balance(self, teams: List[List[Tuple[str, float, str]]], team_size: int) -> List[List[Tuple[str, float, str]]]:
        """팀 밸런싱 최적화 (성별 고려, 팀 인원 유지)"""
        max_iterations = 100
        best_teams = teams.copy()
        best_score = self.calculate_team_balance_score(teams)
        
        for _ in range(max_iterations):
            # 랜덤하게 두 팀의 선수 교환 (팀 인원 유지)
            if len(teams) < 2:
                break
                
            team1_idx = random.randint(0, len(teams) - 1)
            team2_idx = random.randint(0, len(teams) - 1)
            
            if team1_idx == team2_idx or len(teams[team1_idx]) != team_size or len(teams[team2_idx]) != team_size:
                continue
            
            # 랜덤하게 선수 선택
            player1_idx = random.randint(0, len(teams[team1_idx]) - 1)
            player2_idx = random.randint(0, len(teams[team2_idx]) - 1)
            
            # 선수 교환
            temp_teams = [team.copy() for team in teams]
            temp_teams[team1_idx][player1_idx], temp_teams[team2_idx][player2_idx] = \
                temp_teams[team2_idx][player2_idx], temp_teams[team1_idx][player1_idx]
            
            # 팀 인원이 올바른지 확인
            valid_teams = True
            for team in temp_teams:
                if len(team) != team_size:
                    valid_teams = False
                    break
            
            if not valid_teams:
                continue
            
            # 밸런스 점수 계산
            current_score = self.calculate_team_balance_score(temp_teams)
            
            # 더 나은 결과면 업데이트
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
    
    def display_teams(self, teams: List[List[Tuple[str, float, str]]]):
        """팀 결과 표시 (성별 정보 포함)"""
        self.result_text.delete(1.0, tk.END)
        
        result = "=== 볼링 팀 구성 결과 ===\n\n"
        
        for i, team in enumerate(teams, 1):
            if not team:
                continue
                
            team_sum = sum(player[1] for player in team)
            female_count = sum(1 for player in team if player[2].strip().lower() in ['여', '여성', 'f', 'female', '여자'])
            male_count = len(team) - female_count
            
            result += f"팀 {i}:\n"
            result += f"  선수: {', '.join(player[0] for player in team)}\n"
            result += f"  에버 합계: {team_sum:.1f}\n"
            result += f"  평균 에버: {team_sum/len(team):.1f}\n"
            result += f"  성별 구성: 남성 {male_count}명, 여성 {female_count}명\n"
            result += "\n"
        
        # 전체 통계
        all_players = [player for team in teams for player in team]
        if all_players:
            total_average = sum(player[1] for player in all_players)
            total_female = sum(1 for player in all_players if player[2].strip().lower() in ['여', '여성', 'f', 'female', '여자'])
            total_male = len(all_players) - total_female
            
            result += "=== 전체 통계 ===\n"
            result += f"총 선수 수: {len(all_players)}명\n"
            result += f"성별 구성: 남성 {total_male}명, 여성 {total_female}명\n"
            result += f"총 에버 합계: {total_average:.1f}\n"
            result += f"전체 평균 에버: {total_average/len(all_players):.1f}\n"
        
        self.result_text.insert(1.0, result)
    
    def browse_auth_file(self):
        """인증 파일 선택"""
        filename = filedialog.askopenfilename(
            title="구글 서비스 계정 키 파일 선택",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if filename:
            self.auth_file_entry.delete(0, tk.END)
            self.auth_file_entry.insert(0, filename)
    
    def load_from_sheet(self):
        """구글 시트에서 데이터 가져오기"""
        if not GOOGLE_SHEETS_AVAILABLE:
            messagebox.showerror("오류", "구글 시트 연동 라이브러리가 설치되지 않았습니다.")
            return
        
        auth_file = self.auth_file_entry.get().strip()
        sheet_url = self.sheet_url_entry.get().strip()
        sheet_name = self.sheet_name_entry.get().strip()
        
        if not auth_file or not sheet_url or not sheet_name:
            messagebox.showerror("오류", "인증 파일, 시트 URL, 시트 이름을 모두 입력해주세요.")
            return
        
        if not os.path.exists(auth_file):
            messagebox.showerror("오류", "인증 파일을 찾을 수 없습니다.")
            return
        
        try:
            # 구글 시트 연결
            scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
            creds = Credentials.from_service_account_file(auth_file, scopes=scope)
            client = gspread.authorize(creds)
            
            # 시트 URL에서 ID 추출
            sheet_id = sheet_url.split('/')[5]
            sheet = client.open_by_key(sheet_id).worksheet(sheet_name)
            
            # 데이터 가져오기
            data = sheet.get_all_values()
            
            if len(data) < 2:
                messagebox.showerror("오류", "시트에 데이터가 없습니다.")
                return
            
            # 미리보기 트리뷰 초기화
            for item in self.preview_tree.get_children():
                self.preview_tree.delete(item)
            
            self.sheet_data = []
            
            # 선수별로 하반기/상반기 점수 구분하여 저장
            player_scores = {}  # {이름: {'하반기': 점수, '상반기': 점수, '성별': 성별}}
            
            # 디버깅 정보
            debug_info = []
            debug_info.append(f"총 데이터 행 수: {len(data)}")
            
            # 첫 번째 행은 헤더로 가정하고, C열(인덱스 2), D열(인덱스 3), AC열(인덱스 28) 사용
            for i, row in enumerate(data[1:], 2):  # 실제 구글 시트 행 번호로 시작 (헤더 다음 행부터)
                if len(row) >= 29:  # C열, D열, AC열이 모두 있는지 확인
                    name = row[2].strip()  # C열: 회원 목록
                    gender = row[28].strip() if len(row) > 28 else ""  # AC열: 성별
                    try:
                        average = float(row[3])  # D열: 평균점수
                        if name and average >= 0:
                            # 55줄 기준으로 하반기/상반기 구분
                            if i <= 55:  # 55줄 이하: 상반기
                                if name not in player_scores:
                                    player_scores[name] = {'성별': gender}
                                player_scores[name]['상반기'] = average
                                debug_info.append(f"행 {i}: {name} - 상반기 점수 {average} ({gender})")
                            else:  # 55줄 초과: 하반기
                                if name not in player_scores:
                                    player_scores[name] = {'성별': gender}
                                player_scores[name]['하반기'] = average
                                debug_info.append(f"행 {i}: {name} - 하반기 점수 {average} ({gender})")
                    except ValueError:
                        continue
            
            # 하반기 점수를 우선으로 하고, 없으면 상반기 점수 사용
            final_players = []
            for name, scores in player_scores.items():
                if '하반기' in scores:
                    # 하반기 점수가 있으면 하반기 점수 사용
                    final_score = scores['하반기']
                    period = "하반기"
                    gender = scores.get('성별', '')
                    debug_info.append(f"최종: {name} - {period} 점수 {final_score} 사용 ({gender})")
                elif '상반기' in scores:
                    # 하반기 점수가 없고 상반기 점수만 있으면 상반기 점수 사용
                    final_score = scores['상반기']
                    period = "상반기"
                    gender = scores.get('성별', '')
                    debug_info.append(f"최종: {name} - {period} 점수 {final_score} 사용 ({gender})")
                else:
                    continue
                
                # 성별 정보를 포함하여 저장 (이름, 점수, 성별)
                self.sheet_data.append((name, final_score, gender))
                self.preview_tree.insert("", "end", values=(name, f"{final_score:.1f}", gender, "□"))
                final_players.append((name, final_score, period, gender))
            
            # 디버깅 정보를 메시지에 포함
            debug_message = f"{len(self.sheet_data)}명의 선수 데이터를 가져왔습니다.\n(하반기 점수 우선, 없으면 상반기 점수 사용)\n\n디버그 정보:\n" + "\n".join(debug_info[:10])
            if len(debug_info) > 10:
                debug_message += f"\n... 외 {len(debug_info) - 10}개 항목"
            
            messagebox.showinfo("성공", debug_message)
            
            # 선택된 선수 수 초기화
            self.update_selected_count()
            
        except Exception as e:
            messagebox.showerror("오류", f"구글 시트에서 데이터를 가져오는 중 오류가 발생했습니다:\n{str(e)}")
    
    def add_selected_players(self):
        """체크된 선수들을 추가"""
        added_count = 0
        
        # 모든 아이템을 확인하여 체크된 선수들만 추가
        for item in self.preview_tree.get_children():
            values = self.preview_tree.item(item)["values"]
            if values[3] == "■":  # 체크된 선수만 추가 (성별 컬럼이 추가되어 인덱스가 3으로 변경)
                name = values[0]
                average = float(values[1])
                gender = values[2]  # 성별 정보
                
                # 선수 추가 (중복 허용) - 성별 정보 포함
                self.players.append((name, average, gender))
                self.player_tree.insert("", "end", values=(name, f"{average:.1f}", gender))
                added_count += 1
        
        if added_count > 0:
            messagebox.showinfo("추가 완료", f"{added_count}명의 선수가 추가되었습니다.")
        else:
            messagebox.showwarning("경고", "체크된 선수가 없습니다.")
    
    def select_all_players(self):
        """모든 선수 체크"""
        for item in self.preview_tree.get_children():
            values = self.preview_tree.item(item)["values"]
            self.preview_tree.item(item, values=(values[0], values[1], values[2], "■"))
        
        # 선택된 선수 수 업데이트
        self.update_selected_count()
    
    def deselect_all_players(self):
        """모든 선수 체크 해제"""
        for item in self.preview_tree.get_children():
            values = self.preview_tree.item(item)["values"]
            self.preview_tree.item(item, values=(values[0], values[1], values[2], "□"))
        
        # 선택된 선수 수 업데이트
        self.update_selected_count()

    def update_selected_count(self):
        """선택된 선수 수 업데이트"""
        selected_count = 0
        for item in self.preview_tree.get_children():
            values = self.preview_tree.item(item)["values"]
            if values[3] == "■":  # 체크된 선수 수 계산
                selected_count += 1
        self.selected_count_label.config(text=f"선택된 선수: {selected_count}명")

    def on_tree_click(self, event):
        """트리뷰 클릭 시 체크박스 토글"""
        item = self.preview_tree.identify_row(event.y)
        if item:
            # 클릭된 행의 값을 가져옴
            values = self.preview_tree.item(item)["values"]
            
            # 선택 상태를 토글 (성별 컬럼이 추가되어 인덱스가 3으로 변경)
            if values[3] == "□":
                self.preview_tree.item(item, values=(values[0], values[1], values[2], "■"))
            else:
                self.preview_tree.item(item, values=(values[0], values[1], values[2], "□"))
            
            # 선택된 선수 수 업데이트
            self.update_selected_count()

def main():
    root = tk.Tk()
    app = BowlingTeamMaker(root)
    root.mainloop()

if __name__ == "__main__":
    main() 