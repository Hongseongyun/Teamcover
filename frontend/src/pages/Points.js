import React, { useState, useEffect, useCallback } from 'react';
import { pointAPI, sheetsAPI, memberAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Points.css';

const Points = () => {
  const { user } = useAuth(); // 현재 사용자 정보
  const isAdmin =
    user && (user.role === 'admin' || user.role === 'super_admin');
  const [points, setPoints] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [editingPoint, setEditingPoint] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    member_name: '',
    point_type: '',
    amount: '',
    reason: '',
    point_date: '',
    note: '',
  });

  // 구글시트 가져오기 관련 상태
  const [importFormData, setImportFormData] = useState({
    spreadsheetUrl: '',
    worksheetName: '',
    confirmDelete: false,
  });

  // 통계 상태
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalUsed: 0,
    totalBalance: 0,
    activeMembers: 0,
    monthlyStats: {},
  });

  // 개인별 검색 상태
  const [searchMember, setSearchMember] = useState('');
  const [memberStats, setMemberStats] = useState(null);
  const [showMemberSearch, setShowMemberSearch] = useState(true);

  // 월별 뷰 상태
  const [viewMode, setViewMode] = useState('all'); // 'all' 또는 'monthly'
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const loadPoints = useCallback(async () => {
    try {
      setLoading(true);
      console.log('포인트 목록 로드 시작');
      const response = await pointAPI.getPoints();
      console.log('포인트 응답:', response);
      if (response.data.success) {
        setPoints(response.data.points);
        calculateStats(response.data.points);
        console.log(
          '포인트 목록 로드 성공:',
          response.data.points.length,
          '개'
        );
      } else {
        console.error('포인트 목록 로드 실패:', response.data.message);
      }
    } catch (error) {
      console.error('포인트 목록 로드 실패:', error);
      console.error('에러 상세:', error.response?.data);
      console.error('에러 코드:', error.code);
      console.error('요청 URL:', error.config?.url);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPoints();
    loadMembers();
  }, [loadPoints]);

  const loadMembers = async () => {
    try {
      const response = await memberAPI.getMembers();
      if (response.data.success) {
        setMembers(response.data.members);
      }
    } catch (error) {
      console.error('회원 목록 로드 실패:', error);
    }
  };

  const calculateStats = (pointList) => {
    if (!pointList || pointList.length === 0) return;

    let totalEarned = 0;
    let totalUsed = 0;
    const memberPoints = {};
    const monthlyStats = {};

    pointList.forEach((point) => {
      // amount가 이미 올바른 부호를 가지고 있음
      const amount = parseInt(point.amount) || 0;

      // 적립: +와 - 두 종류 모두 포함 (모든 포인트의 절댓값)
      // 사용: 실제 사용된 포인트 (음수 포인트의 절댓값)
      totalEarned += Math.abs(amount); // 모든 포인트의 절댓값을 적립에 포함

      if (amount < 0) {
        totalUsed += Math.abs(amount); // 음수 포인트만 사용으로 계산
      }

      // 회원별 포인트 계산
      if (!memberPoints[point.member_name]) {
        memberPoints[point.member_name] = 0;
      }
      if (point.point_type === '적립' || point.point_type === '보너스') {
        memberPoints[point.member_name] += Math.abs(amount);
      } else {
        memberPoints[point.member_name] -= Math.abs(amount);
      }

      // 월별 통계
      const date = new Date(point.point_date || point.created_at);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, '0')}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { earned: 0, used: 0, count: 0 };
      }
      monthlyStats[monthKey].earned += Math.abs(amount); // 모든 포인트의 절댓값을 적립에 포함

      if (amount < 0) {
        monthlyStats[monthKey].used += Math.abs(amount); // 음수 포인트만 사용으로 계산
      }
      monthlyStats[monthKey].count++;
    });

    // 정확한 잔여 포인트 계산
    const totalBalance = totalEarned - totalUsed;
    const activeMembers = Object.keys(memberPoints).length;

    setStats({
      totalEarned,
      totalUsed,
      totalBalance,
      activeMembers,
      monthlyStats,
    });
  };

  // 월 네비게이션 함수
  const goToPreviousMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCurrentMonth(newMonth);
  };

  const goToNextMonth = () => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCurrentMonth(newMonth);
  };

  const goToLatestMonth = () => {
    setCurrentMonth(new Date());
  };

  // 현재 선택된 월의 포인트만 가져오기
  const getCurrentMonthPoints = () => {
    const yearMonth = `${currentMonth.getFullYear()}-${String(
      currentMonth.getMonth() + 1
    ).padStart(2, '0')}`;

    return points.filter((point) => {
      const pointDate = point.point_date || point.created_at;
      if (!pointDate) return false;
      return pointDate.startsWith(yearMonth);
    });
  };

  // 표시할 포인트 목록
  const displayPoints =
    viewMode === 'monthly' ? getCurrentMonthPoints() : points;

  // 개인별 통계 계산
  const calculateMemberStats = (memberName) => {
    if (!memberName || !points.length) return;

    const memberPoints = points.filter(
      (point) => point.member_name === memberName
    );
    if (memberPoints.length === 0) {
      setMemberStats(null);
      return;
    }

    let totalEarned = 0;
    let totalUsed = 0;
    let totalTransactions = memberPoints.length;

    memberPoints.forEach((point) => {
      const amount = parseInt(point.amount) || 0;
      // 적립: +와 - 두 종류 모두 포함 (모든 포인트의 절댓값)
      // 사용: 실제 사용된 포인트 (음수 포인트의 절댓값)
      totalEarned += Math.abs(amount); // 모든 포인트의 절댓값을 적립에 포함

      if (amount < 0) {
        totalUsed += Math.abs(amount); // 음수 포인트만 사용으로 계산
      }
    });

    // 포인트 내역과 동일한 방식으로 계산 (날짜순 누적)
    // calculateRemainingPoints 함수와 동일한 로직 사용
    const currentBalance = calculateRemainingPoints(
      points, // 전체 포인트 목록
      memberName, // 검색된 회원명
      new Date().toISOString().split('T')[0] // 현재 날짜 (가장 최근까지)
    );

    // 전체 포인트 기록 (날짜순 정렬)
    const allPointsSorted = memberPoints.sort(
      (a, b) =>
        new Date(b.point_date || b.created_at) -
        new Date(a.point_date || a.created_at)
    );

    setMemberStats({
      memberName,
      totalTransactions,
      totalEarned,
      totalUsed,
      currentBalance,
      allPoints: allPointsSorted,
    });
  };

  // 개인별 검색 실행
  const handleMemberSearch = () => {
    if (searchMember.trim()) {
      calculateMemberStats(searchMember.trim());
      setShowMemberSearch(false);
    }
  };

  // 검색 초기화
  const resetMemberSearch = () => {
    setSearchMember('');
    setMemberStats(null);
    setShowMemberSearch(true);
  };

  // 구글시트 가져오기
  const handleImportFromSheets = async (e) => {
    e.preventDefault();
    if (!importFormData.confirmDelete) {
      alert('경고사항을 확인해주세요.');
      return;
    }

    try {
      const response = await sheetsAPI.importPoints(importFormData);
      const { success, message, error_type } = response?.data || {};
      if (success) {
        alert('구글시트에서 포인트를 성공적으로 가져왔습니다.');
        setShowImportForm(false);
        setImportFormData({
          spreadsheetUrl: '',
          worksheetName: '',
          confirmDelete: false,
        });
        loadPoints();
      } else {
        let errorMessage = message || '구글시트 가져오기에 실패했습니다.';
        if (error_type === 'authentication_failed') {
          errorMessage += '\n\n환경변수 설정을 확인해주세요.';
        } else if (error_type === 'data_fetch_failed') {
          errorMessage += '\n\n구글 시트 URL과 권한을 확인해주세요.';
        } else if (error_type === 'parsing_failed') {
          errorMessage += '\n\n시트 형식을 확인해주세요.';
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('구글시트 가져오기 실패:', error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        '구글시트 가져오기에 실패했습니다.';
      alert(`오류: ${errorMessage}`);
    }
  };

  // 천 단위 구분 쉼표 추가 함수
  const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // 잔여포인트 계산 함수 (날짜별 순차 계산)
  const calculateRemainingPoints = (
    pointList,
    currentMemberName,
    currentPointDate
  ) => {
    if (!pointList || pointList.length === 0) return 0;

    let balance = 0;

    // 날짜별로 정렬된 포인트 목록에서 현재 포인트 날짜까지의 누적 계산
    const sortedPoints = [...pointList]
      .filter((point) => point.member_name === currentMemberName)
      .sort((a, b) => {
        const dateA = new Date(a.point_date || a.created_at);
        const dateB = new Date(b.point_date || b.created_at);
        return dateA - dateB; // 오름차순 정렬 (과거부터 현재까지)
      });

    // 현재 포인트 날짜까지의 누적 계산
    const currentDate = new Date(currentPointDate || currentPointDate);

    sortedPoints.forEach((point) => {
      const pointDate = new Date(point.point_date || point.created_at);
      // 현재 포인트 날짜까지의 포인트만 누적
      if (pointDate <= currentDate) {
        balance += parseInt(point.amount) || 0;
      }
    });

    return balance;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPoint) {
        await pointAPI.updatePoint(editingPoint.id, formData);
      } else {
        await pointAPI.addPoint(formData);
      }
      setShowAddForm(false);
      setEditingPoint(null);
      setFormData({
        member_name: '',
        point_type: '',
        amount: '',
        reason: '',
        point_date: '',
        note: '',
      });
      loadPoints();
    } catch (error) {
      console.error('포인트 저장 실패:', error);
    }
  };

  const startInlineEdit = (point) => {
    setEditingId(point.id);
    setFormData({
      member_name: point.member_name,
      point_type: point.point_type,
      amount: point.amount,
      reason: point.reason || '',
      point_date: point.point_date,
      note: point.note || '',
    });
  };

  const cancelInlineEdit = () => {
    setEditingId(null);
    setFormData({
      member_name: '',
      point_type: '',
      amount: '',
      reason: '',
      point_date: '',
      note: '',
    });
  };

  const saveInlineEdit = async () => {
    try {
      console.log('포인트 인라인 수정 시도:', formData);
      console.log('수정할 포인트 ID:', editingId);

      await pointAPI.updatePoint(editingId, formData);

      // 성공 시 목록 새로고침
      await loadPoints();
      setEditingId(null);
      setFormData({
        member_name: '',
        point_type: '',
        amount: '',
        reason: '',
        point_date: '',
        note: '',
      });
    } catch (error) {
      console.error('인라인 수정 실패:', error);
      console.error('에러 타입:', error.constructor.name);
      console.error('에러 메시지:', error.message);
      console.error('에러 코드:', error.code);
      console.error('에러 상세:', error.response?.data);
      console.error('요청 URL:', error.config?.url);
      console.error('요청 메서드:', error.config?.method);
      alert('포인트 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말로 이 포인트를 삭제하시겠습니까?')) {
      try {
        await pointAPI.deletePoint(id);
        loadPoints();
      } catch (error) {
        console.error('포인트 삭제 실패:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      member_name: '',
      point_type: '',
      amount: '',
      reason: '',
      point_date: '',
      note: '',
    });
    setEditingPoint(null);
    setShowAddForm(false);
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="points-page">
      <div className="page-header">
        <h1>2025 포인트 관리</h1>
        {isAdmin && (
          <div className="header-actions">
            <button
              className="btn btn-info"
              onClick={() => setShowImportForm(true)}
            >
              구글시트 가져오기
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              포인트 추가
            </button>
          </div>
        )}
      </div>

      {/* 통계 섹션 (관리자만) */}
      {isAdmin && (
        <div className="stats-section">
          <div className="stats-grid">
            <div className="stat-card stat-success">
              <div className="stat-number">
                {formatNumber(stats.totalEarned)}
              </div>
              <div className="stat-label">총 적립</div>
            </div>
            <div className="stat-card stat-danger">
              <div className="stat-number">{formatNumber(stats.totalUsed)}</div>
              <div className="stat-label">총 사용</div>
            </div>
            <div className="stat-card stat-primary">
              <div className="stat-number">
                {formatNumber(stats.totalBalance)}
              </div>
              <div className="stat-label">잔여 포인트</div>
            </div>
            <div className="stat-card stat-info">
              <div className="stat-number">{stats.activeMembers}</div>
              <div className="stat-label">활동 회원</div>
            </div>
          </div>

          {/* 월별 통계 */}
          {Object.keys(stats.monthlyStats).length > 0 && (
            <div className="monthly-stats">
              <h3>월별 포인트 현황</h3>
              <div className="monthly-stats-grid">
                {Object.entries(stats.monthlyStats)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 6)
                  .map(([month, data]) => (
                    <div key={month} className="monthly-stat-card">
                      <h4>{month}</h4>
                      <div className="monthly-stat-content">
                        <div className="stat-item">
                          <span className="stat-label">적립:</span>
                          <span className="stat-value positive">
                            +{formatNumber(data.earned)}
                          </span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">사용:</span>
                          <span className="stat-value negative">
                            -{formatNumber(data.used)}
                          </span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">건수:</span>
                          <span className="stat-value">{data.count}건</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 구글시트 가져오기 폼 (관리자만) */}
      {isAdmin && showImportForm && (
        <div className="import-section">
          <div className="section-card">
            <h3 className="section-title">구글시트에서 포인트 가져오기</h3>
            <div className="alert alert-warning">
              <strong>주의:</strong> 기존 포인트 모두 삭제 후 가져오기 (기존
              데이터가 모두 삭제됩니다)
            </div>
            <form onSubmit={handleImportFromSheets} className="import-form">
              <div className="form-row">
                <div className="form-group">
                  <label>구글시트 URL *</label>
                  <input
                    type="url"
                    value={importFormData.spreadsheetUrl}
                    onChange={(e) =>
                      setImportFormData({
                        ...importFormData,
                        spreadsheetUrl: e.target.value,
                      })
                    }
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label>워크시트 이름 (선택)</label>
                  <input
                    type="text"
                    value={importFormData.worksheetName}
                    onChange={(e) =>
                      setImportFormData({
                        ...importFormData,
                        worksheetName: e.target.value,
                      })
                    }
                    placeholder="Sheet1 (기본값)"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={importFormData.confirmDelete}
                    onChange={(e) =>
                      setImportFormData({
                        ...importFormData,
                        confirmDelete: e.target.checked,
                      })
                    }
                    required
                  />
                  위 경고사항을 확인했습니다
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  구글시트에서 가져오기
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowImportForm(false)}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 포인트 추가/수정 폼 (관리자만) */}
      {isAdmin && showAddForm && (
        <div className="form-section">
          <div className="section-card">
            <h3 className="section-title">
              {editingPoint ? '포인트 수정' : '새 포인트 등록'}
            </h3>
            <form onSubmit={handleSubmit} className="point-form">
              <div className="form-row">
                <div className="form-group">
                  <label>회원 이름 *</label>
                  <select
                    value={formData.member_name}
                    onChange={(e) =>
                      setFormData({ ...formData, member_name: e.target.value })
                    }
                    required
                  >
                    <option value="">회원 선택</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.name}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>포인트 유형 *</label>
                  <select
                    value={formData.point_type}
                    onChange={(e) =>
                      setFormData({ ...formData, point_type: e.target.value })
                    }
                    required
                  >
                    <option value="">유형 선택</option>
                    <option value="적립">적립</option>
                    <option value="사용">사용</option>
                    <option value="차감">차감</option>
                    <option value="보너스">보너스</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>포인트 금액 *</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    required
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>포인트 날짜</label>
                  <input
                    type="date"
                    value={formData.point_date}
                    onChange={(e) =>
                      setFormData({ ...formData, point_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>사유</label>
                  <select
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                  >
                    <option value="">사유 선택</option>
                    <option value="경기 참여">경기 참여</option>
                    <option value="스트라이크">스트라이크</option>
                    <option value="스페어">스페어</option>
                    <option value="200점 이상">200점 이상</option>
                    <option value="상품 교환">상품 교환</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>비고</label>
                  <input
                    type="text"
                    value={formData.note}
                    onChange={(e) =>
                      setFormData({ ...formData, note: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingPoint ? '수정' : '등록'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 개인별 검색 섹션 */}
      <div className="member-search-section">
        <div className="section-card">
          <h3 className="section-title">개인별 포인트 검색</h3>

          {showMemberSearch ? (
            <div className="search-form">
              <div className="search-row">
                <div className="form-group">
                  <input
                    type="text"
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === 'Enter' && handleMemberSearch()
                    }
                    placeholder="회원명을 입력하거나 선택하세요"
                    list="member-list"
                    className="member-search-input"
                  />
                  <datalist id="member-list">
                    {members.map((member) => (
                      <option key={member.id} value={member.name} />
                    ))}
                  </datalist>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleMemberSearch}
                  disabled={!searchMember.trim()}
                >
                  검색
                </button>
              </div>
            </div>
          ) : (
            <div className="member-stats">
              {memberStats && (
                <>
                  <div className="member-header">
                    <h4>{memberStats.memberName}님의 포인트 통계</h4>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={resetMemberSearch}
                    >
                      다른 회원 검색
                    </button>
                  </div>

                  <div className="member-stats-grid">
                    <div className="stat-card stat-primary">
                      <div className="stat-number">
                        {memberStats.totalTransactions}
                      </div>
                      <div className="stat-label">총 내역</div>
                    </div>
                    <div className="stat-card stat-success">
                      <div className="stat-number">
                        {formatNumber(memberStats.totalEarned)}
                      </div>
                      <div className="stat-label">총 적립</div>
                    </div>
                    <div className="stat-card stat-danger">
                      <div className="stat-number">
                        {formatNumber(memberStats.totalUsed)}
                      </div>
                      <div className="stat-label">총 사용</div>
                    </div>
                    <div className="stat-card stat-info">
                      <div className="stat-number">
                        {formatNumber(memberStats.currentBalance)}
                      </div>
                      <div className="stat-label">현재 잔여</div>
                    </div>
                  </div>

                  {/* 전체 포인트 기록 */}
                  <div className="all-games">
                    <h5>
                      전체 포인트 기록 ({memberStats.totalTransactions}건)
                    </h5>
                    <div className="all-games-table">
                      <table>
                        <thead>
                          <tr>
                            <th>날짜</th>
                            <th>유형</th>
                            <th>포인트</th>
                            <th>사유</th>
                            <th>메모</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberStats.allPoints.map((point, index) => (
                            <tr key={index}>
                              <td>{point.point_date || point.created_at}</td>
                              <td>
                                <span
                                  className={`point-type ${
                                    (point.point_type === '적립' ||
                                      point.point_type === '보너스') &&
                                    point.amount >= 0
                                      ? 'positive'
                                      : 'negative'
                                  }`}
                                >
                                  {point.point_type}
                                </span>
                              </td>
                              <td
                                className={
                                  (point.point_type === '적립' ||
                                    point.point_type === '보너스') &&
                                  point.amount >= 0
                                    ? 'positive'
                                    : 'negative'
                                }
                              >
                                {formatNumber(point.amount)}P
                              </td>
                              <td>{point.reason || '-'}</td>
                              <td>{point.note || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 포인트 목록 (관리자만) */}
      {isAdmin && (
        <div className="points-section">
          <div className="section-card">
            <div className="points-header">
              <h3 className="section-title">포인트 내역</h3>
              <div className="view-toggle">
                <button
                  className={`btn btn-sm ${
                    viewMode === 'all' ? 'btn-primary' : 'btn-outline-secondary'
                  }`}
                  onClick={() => setViewMode('all')}
                >
                  전체 보기
                </button>
                <button
                  className={`btn btn-sm ${
                    viewMode === 'monthly'
                      ? 'btn-primary'
                      : 'btn-outline-secondary'
                  }`}
                  onClick={() => setViewMode('monthly')}
                >
                  월별 보기
                </button>
              </div>
            </div>

            {/* 월별 네비게이션 */}
            {viewMode === 'monthly' && (
              <div className="date-navigation">
                <button
                  className="btn btn-primary nav-btn"
                  onClick={() => {
                    setCurrentMonth(new Date());
                  }}
                  title="최신 월로 이동"
                >
                  《《
                </button>
                <button
                  className="btn btn-primary nav-btn"
                  onClick={goToPreviousMonth}
                  title="이전 월"
                >
                  《
                </button>
                <div className="current-date-info">
                  <div className="date-display">
                    {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}
                    월
                  </div>
                  <div className="participant-count">
                    총 {displayPoints.length}건
                  </div>
                </div>
                <button
                  className="btn btn-primary nav-btn"
                  onClick={goToNextMonth}
                  title="다음 월"
                >
                  》
                </button>
                <button
                  className="btn btn-outline-primary nav-btn"
                  onClick={goToLatestMonth}
                  title="최신 월"
                >
                  》》
                </button>
              </div>
            )}

            <div className="points-table">
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>회원</th>
                    <th>유형</th>
                    <th>포인트</th>
                    <th>사유</th>
                    <th>잔여 포인트</th>
                    <th>메모</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPoints.map((point) => (
                    <tr
                      key={point.id}
                      className={editingId === point.id ? 'editing' : ''}
                    >
                      <td>
                        {editingId === point.id ? (
                          <input
                            type="date"
                            value={formData.point_date}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                point_date: e.target.value,
                              })
                            }
                            className="form-control"
                          />
                        ) : (
                          point.point_date || point.created_at
                        )}
                      </td>
                      <td>
                        {editingId === point.id ? (
                          <select
                            value={formData.member_name}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                member_name: e.target.value,
                              })
                            }
                            className="form-control"
                          >
                            <option value="">회원 선택</option>
                            {members.map((member) => (
                              <option key={member.id} value={member.name}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          point.member_name
                        )}
                      </td>
                      <td>
                        {editingId === point.id ? (
                          <select
                            value={formData.point_type}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                point_type: e.target.value,
                              })
                            }
                            className="form-control"
                          >
                            <option value="">유형 선택</option>
                            <option value="적립">적립</option>
                            <option value="사용">사용</option>
                            <option value="차감">차감</option>
                            <option value="보너스">보너스</option>
                          </select>
                        ) : (
                          <span
                            className={`point-type ${
                              (point.point_type === '적립' ||
                                point.point_type === '보너스') &&
                              point.amount >= 0
                                ? 'positive'
                                : 'negative'
                            }`}
                          >
                            {point.point_type}
                          </span>
                        )}
                      </td>
                      <td>
                        {editingId === point.id ? (
                          <input
                            type="number"
                            value={formData.amount}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                amount: e.target.value,
                              })
                            }
                            className="form-control"
                            min="1"
                          />
                        ) : (
                          <span
                            className={
                              (point.point_type === '적립' ||
                                point.point_type === '보너스') &&
                              point.amount >= 0
                                ? 'positive'
                                : 'negative'
                            }
                          >
                            {formatNumber(point.amount)}P
                          </span>
                        )}
                      </td>
                      <td>
                        {editingId === point.id ? (
                          <select
                            value={formData.reason}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                reason: e.target.value,
                              })
                            }
                            className="form-control"
                          >
                            <option value="">사유 선택</option>
                            <option value="경기 참여">경기 참여</option>
                            <option value="스트라이크">스트라이크</option>
                            <option value="스페어">스페어</option>
                            <option value="200점 이상">200점 이상</option>
                            <option value="상품 교환">상품 교환</option>
                            <option value="기타">기타</option>
                          </select>
                        ) : (
                          point.reason || '-'
                        )}
                      </td>
                      <td className="balance-cell">
                        {formatNumber(
                          calculateRemainingPoints(
                            points,
                            point.member_name,
                            point.point_date || point.created_at
                          )
                        )}
                        P
                      </td>
                      <td>
                        {editingId === point.id ? (
                          <input
                            type="text"
                            value={formData.note}
                            onChange={(e) =>
                              setFormData({ ...formData, note: e.target.value })
                            }
                            className="form-control"
                            placeholder="메모"
                          />
                        ) : (
                          point.note || '-'
                        )}
                      </td>
                      <td>
                        {editingId === point.id ? (
                          <div className="inline-edit-actions">
                            <button
                              className="btn btn-sm btn-success"
                              onClick={saveInlineEdit}
                            >
                              완료
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={cancelInlineEdit}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="inline-edit-actions">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => startInlineEdit(point)}
                            >
                              수정
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(point.id)}
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Points;
