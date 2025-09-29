import React, { useState, useEffect } from 'react';
import { pointAPI, sheetsAPI, memberAPI } from '../services/api';
import './Points.css';

const Points = () => {
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

  // 필터링 상태
  const [filters, setFilters] = useState({
    member: '',
  });

  // 통계 상태
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalUsed: 0,
    totalBalance: 0,
    activeMembers: 0,
    monthlyStats: {},
  });

  // 선택된 회원의 잔여 포인트
  const [selectedMemberBalance, setSelectedMemberBalance] = useState(0);

  useEffect(() => {
    loadPoints();
    loadMembers();
  }, []);

  // 필터가 변경될 때마다 선택된 회원의 잔여 포인트 계산
  useEffect(() => {
    if (filters.member) {
      calculateMemberBalance(filters.member);
    } else {
      setSelectedMemberBalance(0);
    }
  }, [filters.member, points]);

  const loadPoints = async () => {
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
  };

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

      // 포인트 유형에 따라 적립/사용 분류
      if (point.point_type === '적립' || point.point_type === '보너스') {
        totalEarned += Math.abs(amount); // 적립은 양수로 처리
      } else {
        // 사용/차감은 절댓값으로 처리하여 총 사용량 계산
        totalUsed += Math.abs(amount);
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
      if (point.point_type === '적립' || point.point_type === '보너스') {
        monthlyStats[monthKey].earned += Math.abs(amount);
      } else {
        monthlyStats[monthKey].used += Math.abs(amount);
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

  // 특정 회원의 잔여 포인트 계산
  const calculateMemberBalance = (memberName) => {
    if (!memberName || !points || points.length === 0) {
      setSelectedMemberBalance(0);
      return;
    }

    let earned = 0;
    let used = 0;

    points.forEach((point) => {
      if (point.member_name === memberName) {
        const amount = parseInt(point.amount) || 0;
        if (point.point_type === '적립' || point.point_type === '보너스') {
          earned += Math.abs(amount);
        } else {
          used += Math.abs(amount);
        }
      }
    });

    const balance = earned - used;
    setSelectedMemberBalance(balance);
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

  // 필터링된 포인트 목록
  const getFilteredPoints = () => {
    return points.filter((point) => {
      if (filters.member && point.member_name !== filters.member) return false;
      return true;
    });
  };

  // 필터 초기화
  const clearFilters = () => {
    setFilters({ member: '' });
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

  const handleEdit = (point) => {
    setEditingPoint(point);
    setEditingId(point.id);
    setFormData({
      member_name: point.member_name,
      point_type: point.point_type,
      amount: point.amount,
      reason: point.reason || '',
      point_date: point.point_date,
      note: point.note || '',
    });
    setShowAddForm(true);
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

  const filteredPoints = getFilteredPoints();

  return (
    <div className="points-page">
      <div className="page-header">
        <h1>2025 포인트 관리</h1>
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
      </div>

      {/* 통계 섹션 */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card stat-success">
            <div className="stat-number">{formatNumber(stats.totalEarned)}</div>
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

      {/* 구글시트 가져오기 폼 */}
      {showImportForm && (
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

      {/* 포인트 추가/수정 폼 */}
      {showAddForm && (
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

      {/* 포인트 목록 */}
      <div className="points-section">
        <div className="section-card">
          <h3 className="section-title">포인트 내역</h3>

          {/* 필터 섹션 */}
          <div className="filter-section">
            <div className="filter-row">
              <div className="form-group">
                <label>회원 필터</label>
                <input
                  type="text"
                  value={filters.member}
                  onChange={(e) =>
                    setFilters({ ...filters, member: e.target.value })
                  }
                  onKeyPress={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder="회원명을 입력하거나 선택하세요"
                  list="member-filter-list"
                  className="member-filter-input"
                />
                <datalist id="member-filter-list">
                  {members.map((member) => (
                    <option key={member.id} value={member.name} />
                  ))}
                </datalist>
              </div>

              {/* 선택된 회원의 잔여 포인트 표시 */}
              {filters.member && (
                <div className="member-balance-display">
                  <div className="balance-label">잔여 포인트</div>
                  <div
                    className={`balance-amount ${
                      selectedMemberBalance >= 0 ? 'positive' : 'negative'
                    }`}
                  >
                    {formatNumber(selectedMemberBalance)}P
                  </div>
                </div>
              )}

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={clearFilters}
              >
                필터 초기화
              </button>
            </div>
          </div>

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
                {filteredPoints.map((point) => (
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
                            setFormData({ ...formData, amount: e.target.value })
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
                            setFormData({ ...formData, reason: e.target.value })
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
    </div>
  );
};

export default Points;
