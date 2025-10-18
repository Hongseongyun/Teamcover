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
  const [submitting, setSubmitting] = useState(false); // 포인트 등록 중 로딩 상태
  const [deleting, setDeleting] = useState(false); // 포인트 삭제 중 로딩 상태
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

  // 사유 옵션 목록과 기본 금액 (상태로 관리하여 수정 가능)
  const [reasonOptions, setReasonOptions] = useState([
    { name: '오름', amount: 1000 },
    { name: '내림', amount: -1000 },
    { name: '5배가', amount: 500 },
    { name: '7배가', amount: 1000 },
    { name: '9배가', amount: 2000 },
    { name: '퍼팩트', amount: 5000 },
    { name: '올커버', amount: 1000 },
    { name: '팀승리', amount: 1000 },
    { name: '기타', amount: 0 },
  ]);

  // 사유 설정 모달 관련 상태
  const [showReasonSettings, setShowReasonSettings] = useState(false);
  const [editingReasons, setEditingReasons] = useState([...reasonOptions]);

  // 표 형식 포인트 등록을 위한 상태
  const [pointRows, setPointRows] = useState([
    {
      id: 1,
      member_name: '',
      point_type: '',
      amount: '',
      reasons: [],
      point_date: '',
      note: '',
    },
  ]);

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
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredMembers, setFilteredMembers] = useState([]);

  // 월별 뷰 상태
  const [viewMode, setViewMode] = useState('monthly'); // 'all' 또는 'monthly' - 기본값: 월별 보기
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const loadPoints = useCallback(async () => {
    try {
      setLoading(true);
      const response = await pointAPI.getPoints();
      if (response.data.success) {
        setPoints(response.data.points);
        calculateStats(response.data.points);
      }
    } catch (error) {
      // 에러 처리
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
      // 에러 처리
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
      if (point.point_type === '적립' || point.point_type === '기타') {
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

  // 표 형식 포인트 등록 관련 함수들
  const addPointRow = () => {
    const newId = Math.max(...pointRows.map((row) => row.id), 0) + 1;

    // 첫 번째 행의 날짜를 가져와서 새 행에 적용
    const firstRowDate = pointRows.length > 0 ? pointRows[0].point_date : '';

    setPointRows([
      ...pointRows,
      {
        id: newId,
        member_name: '',
        point_type: '',
        amount: '',
        reasons: [],
        point_date: firstRowDate,
        note: '',
      },
    ]);
  };

  const removePointRow = (id) => {
    if (pointRows.length > 1) {
      setPointRows(pointRows.filter((row) => row.id !== id));
    }
  };

  const updatePointRow = (id, field, value) => {
    setPointRows(
      pointRows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );

    // 첫 번째 행의 날짜가 변경되면 모든 행의 날짜를 동기화
    if (field === 'point_date' && id === pointRows[0]?.id) {
      setPointRows((prevRows) =>
        prevRows.map((row, index) =>
          index === 0 ? row : { ...row, point_date: value }
        )
      );
    }
  };

  const toggleReasonForRow = (rowId, reasonName) => {
    setPointRows(
      pointRows.map((row) => {
        if (row.id === rowId) {
          const isSelected = row.reasons.includes(reasonName);
          let newReasons, newAmount;

          if (isSelected) {
            // 사유 해제
            newReasons = row.reasons.filter((r) => r !== reasonName);

            // 해제된 사유의 금액만큼 차감
            const reasonData = reasonOptions.find((r) => r.name === reasonName);
            const currentAmount = parseInt(row.amount) || 0;
            const amountToSubtract = reasonData?.amount || 0;

            if (reasonName === '기타') {
              // 기타 해제 시 반올림 없이 차감
              newAmount = currentAmount - amountToSubtract;
            } else {
              // 다른 사유 해제 시 500단위로 반올림
              newAmount =
                Math.round((currentAmount - amountToSubtract) / 500) * 500;
            }
          } else {
            // 사유 추가
            newReasons = [...row.reasons, reasonName];

            if (reasonName === '기타') {
              // 기타 선택 시 현재 금액 유지 (사용자가 직접 입력할 예정)
              newAmount = parseInt(row.amount) || 0;
            } else {
              // 다른 사유 선택 시 금액 추가
              const reasonData = reasonOptions.find(
                (r) => r.name === reasonName
              );
              const currentAmount = parseInt(row.amount) || 0;
              const amountToAdd = reasonData?.amount || 0;

              // 500단위로 반올림 (음수 허용)
              newAmount = Math.round((currentAmount + amountToAdd) / 500) * 500;
            }
          }

          return {
            ...row,
            reasons: newReasons,
            amount: newAmount.toString(),
          };
        }
        return row;
      })
    );
  };

  const clearReasonsForRow = (rowId) => {
    setPointRows(
      pointRows.map((row) =>
        row.id === rowId ? { ...row, reasons: [], amount: '' } : row
      )
    );
  };

  // 기타 항목의 현재 금액 계산 함수
  const getOtherAmount = (row) => {
    if (!row.reasons.includes('기타')) return 0;

    // otherAmount가 있으면 우선 사용 (입력 중인 상태)
    if (row.otherAmount !== undefined) {
      return row.otherAmount;
    }

    const currentAmount = parseInt(row.amount) || 0;
    let otherReasonsAmount = 0;

    row.reasons.forEach((reasonName) => {
      if (reasonName !== '기타') {
        const reasonData = reasonOptions.find((r) => r.name === reasonName);
        if (reasonData) {
          otherReasonsAmount += reasonData.amount;
        }
      }
    });

    return currentAmount - otherReasonsAmount;
  };

  // 기타 항목 금액 업데이트 함수
  const updateOtherAmount = (rowId, amount) => {
    setPointRows(
      pointRows.map((row) => {
        if (row.id === rowId) {
          // 입력 중인 상태(빈 문자열, '-')는 그대로 유지
          if (amount === '' || amount === '-') {
            return { ...row, otherAmount: amount };
          }

          const otherAmount = parseInt(amount) || 0;

          // 기타가 선택되어 있으면 기타 금액을 반영
          if (row.reasons.includes('기타')) {
            // 다른 사유들의 금액 계산
            let otherReasonsAmount = 0;
            row.reasons.forEach((reasonName) => {
              if (reasonName !== '기타') {
                const reasonData = reasonOptions.find(
                  (r) => r.name === reasonName
                );
                if (reasonData) {
                  otherReasonsAmount += reasonData.amount;
                }
              }
            });

            // 기타 금액 + 다른 사유 금액
            const newAmount = otherReasonsAmount + otherAmount;
            return {
              ...row,
              amount: newAmount.toString(),
              otherAmount: amount,
            };
          }
          return row;
        }
        return row;
      })
    );
  };

  // 사유 설정 관련 함수들
  const openReasonSettings = () => {
    setEditingReasons([...reasonOptions]);
    setShowReasonSettings(true);
  };

  const updateEditingReason = (index, field, value) => {
    setEditingReasons((prev) =>
      prev.map((reason, i) =>
        i === index ? { ...reason, [field]: value } : reason
      )
    );
  };

  const saveReasonSettings = () => {
    setReasonOptions([...editingReasons]);
    setShowReasonSettings(false);
  };

  const resetReasonSettings = () => {
    const defaultReasons = [
      { name: '오름', amount: 1000 },
      { name: '내림', amount: -1000 },
      { name: '5배가', amount: 500 },
      { name: '7배가', amount: 1000 },
      { name: '9배가', amount: 2000 },
      { name: '퍼팩트', amount: 5000 },
      { name: '올커버', amount: 1000 },
      { name: '팀승리', amount: 1000 },
      { name: '기타', amount: 0 },
    ];
    setEditingReasons([...defaultReasons]);
    setReasonOptions([...defaultReasons]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); // 로딩 시작

    try {
      if (editingPoint) {
        await pointAPI.updatePoint(editingPoint.id, formData);
      } else {
        // 표 형식에서 각 행을 개별적으로 등록
        const validRows = pointRows.filter(
          (row) => row.member_name && row.point_type && row.amount
        );

        if (validRows.length === 0) {
          alert('최소 하나의 유효한 포인트 정보를 입력해주세요.');
          setSubmitting(false); // 로딩 종료
          return;
        }

        // 각 행을 개별적으로 등록
        for (const row of validRows) {
          const submitData = {
            member_name: row.member_name,
            point_type: row.point_type,
            amount: parseInt(row.amount),
            reason: row.reasons.length > 0 ? row.reasons.join(', ') : '',
            point_date:
              row.point_date || new Date().toISOString().split('T')[0],
            note: row.note,
          };
          await pointAPI.addPoint(submitData);
        }
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
      // 표 초기화
      setPointRows([
        {
          id: 1,
          member_name: '',
          point_type: '',
          amount: '',
          reasons: [],
          point_date: '',
          note: '',
        },
      ]);
      loadPoints();
    } catch (error) {
      console.error('포인트 저장 실패:', error);
      alert(
        '포인트 저장에 실패했습니다: ' +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setSubmitting(false); // 로딩 종료
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
      alert('포인트 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말로 이 포인트를 삭제하시겠습니까?')) {
      setDeleting(true); // 로딩 시작
      try {
        await pointAPI.deletePoint(id);
        loadPoints();
      } catch (error) {
        // 에러 처리
        alert('포인트 삭제에 실패했습니다.');
      } finally {
        setDeleting(false); // 로딩 종료
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
    // 표 초기화
    setPointRows([
      {
        id: 1,
        member_name: '',
        point_type: '',
        amount: '',
        reasons: [],
        point_date: '',
        note: '',
      },
    ]);
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="points-page">
      <div className="page-header">
        <h1>포인트 관리</h1>
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
              {editingPoint ? '포인트 수정' : '포인트 등록'}
            </h3>

            {!editingPoint ? (
              // 표 형식 포인트 등록
              <div className="table-form-container">
                <div className="table-form-header">
                  <div className="header-buttons">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm settings-btn"
                      onClick={openReasonSettings}
                      disabled={submitting}
                    >
                      포인트 설정
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className={`table-form ${submitting ? 'submitting' : ''}`}
                >
                  <div className="table-form-table">
                    <table>
                      <thead>
                        <tr>
                          <th className="col-date">날짜</th>
                          <th className="col-member">회원</th>
                          <th className="col-type">유형</th>
                          <th className="col-amount">금액</th>
                          <th className="col-reason">사유</th>
                          <th className="col-note">비고</th>
                          <th className="col-actions">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pointRows.map((row) => (
                          <tr key={row.id}>
                            <td className="col-date">
                              <input
                                type="date"
                                value={row.point_date}
                                onChange={(e) =>
                                  updatePointRow(
                                    row.id,
                                    'point_date',
                                    e.target.value
                                  )
                                }
                                className={
                                  pointRows[0]?.id === row.id
                                    ? 'master-date-input'
                                    : ''
                                }
                                title={
                                  pointRows[0]?.id === row.id
                                    ? '이 날짜가 모든 행에 적용됩니다'
                                    : ''
                                }
                                disabled={submitting}
                              />
                              {pointRows[0]?.id === row.id &&
                                pointRows.length > 1 && (
                                  <div className="date-sync-indicator">
                                    모든 행에 적용됨
                                  </div>
                                )}
                            </td>
                            <td className="col-member">
                              <select
                                value={row.member_name}
                                onChange={(e) =>
                                  updatePointRow(
                                    row.id,
                                    'member_name',
                                    e.target.value
                                  )
                                }
                                required
                                disabled={submitting}
                              >
                                <option value="">회원 선택</option>
                                {members.map((member) => (
                                  <option key={member.id} value={member.name}>
                                    {member.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="col-type">
                              <select
                                value={row.point_type}
                                onChange={(e) =>
                                  updatePointRow(
                                    row.id,
                                    'point_type',
                                    e.target.value
                                  )
                                }
                                required
                                disabled={submitting}
                              >
                                <option value="">유형 선택</option>
                                <option value="정기전">정기전</option>
                                <option value="사용">사용</option>
                                <option value="기타">기타</option>
                              </select>
                            </td>
                            <td className="col-amount">
                              <input
                                type="number"
                                value={row.amount}
                                readOnly
                                required
                                min="0"
                                step="500"
                                placeholder="자동계산"
                                className={
                                  row.reasons.length > 0
                                    ? 'auto-calculated-amount'
                                    : 'readonly-amount'
                                }
                                title={
                                  row.reasons.length > 0
                                    ? '사유 선택으로 자동 계산된 금액입니다'
                                    : '사유를 선택하면 자동으로 금액이 계산됩니다'
                                }
                                disabled={submitting}
                              />
                            </td>
                            <td className="col-reason">
                              <div className="reason-cell">
                                <div className="reason-options-mini">
                                  {reasonOptions.map((reason) => (
                                    <label
                                      key={reason.name}
                                      className="reason-option-mini"
                                      title={`${reason.name}: ${
                                        reason.amount > 0 ? '+' : ''
                                      }${reason.amount.toLocaleString()}P`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={row.reasons.includes(
                                          reason.name
                                        )}
                                        onChange={() =>
                                          toggleReasonForRow(
                                            row.id,
                                            reason.name
                                          )
                                        }
                                        disabled={submitting}
                                      />
                                      <span>{reason.name}</span>
                                      <span className="reason-amount">
                                        {reason.name === '기타' ? (
                                          <input
                                            type="text"
                                            value={getOtherAmount(row)}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              // 숫자, -, 빈 문자열만 허용
                                              if (
                                                value === '' ||
                                                value === '-' ||
                                                /^-?\d*$/.test(value)
                                              ) {
                                                updateOtherAmount(
                                                  row.id,
                                                  value
                                                );
                                              }
                                            }}
                                            onKeyDown={(e) => {
                                              // 허용할 키들
                                              const allowedKeys = [
                                                'Backspace',
                                                'Delete',
                                                'ArrowLeft',
                                                'ArrowRight',
                                                'ArrowUp',
                                                'ArrowDown',
                                                'Tab',
                                                'Enter',
                                                'Escape',
                                              ];

                                              // 숫자, -, 백스페이스, 삭제, 화살표 키만 허용
                                              if (
                                                !/[\d-]/.test(e.key) &&
                                                !allowedKeys.includes(e.key)
                                              ) {
                                                e.preventDefault();
                                              }
                                            }}
                                            placeholder="금액"
                                            className="other-amount-input"
                                            disabled={submitting}
                                            style={{
                                              width: '60px',
                                              padding: '2px 4px',
                                              fontSize: '0.7rem',
                                              border: '1px solid #ccc',
                                              borderRadius: '3px',
                                              textAlign: 'right',
                                            }}
                                          />
                                        ) : (
                                          `(${
                                            reason.amount > 0 ? '+' : ''
                                          }${reason.amount.toLocaleString()})`
                                        )}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                                {row.reasons.length > 0 && (
                                  <div className="selected-reasons-mini">
                                    <span>{row.reasons.join(', ')}</span>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => clearReasonsForRow(row.id)}
                                      disabled={submitting}
                                    >
                                      해제
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="col-note">
                              <input
                                type="text"
                                value={row.note}
                                onChange={(e) =>
                                  updatePointRow(row.id, 'note', e.target.value)
                                }
                                placeholder="메모"
                                disabled={submitting}
                              />
                            </td>
                            <td className="col-actions">
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => removePointRow(row.id)}
                                disabled={pointRows.length === 1 || submitting}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* 표 하단 고정 "+" 행 추가 버튼 */}
                  <div className="sticky-add-row">
                    <button
                      type="button"
                      className="add-row-btn"
                      onClick={addPointRow}
                      aria-label="행 추가"
                      disabled={submitting}
                      title="행 추가"
                    >
                      +
                    </button>
                  </div>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner"></div>
                          등록 중...
                        </>
                      ) : (
                        `등록 (${pointRows.length}명)`
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={resetForm}
                      disabled={submitting}
                    >
                      취소
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              // 기존 단일 수정 폼
              <form
                onSubmit={handleSubmit}
                className={`point-form ${submitting ? 'submitting' : ''}`}
              >
                <div className="form-row">
                  <div className="form-group">
                    <label>회원 이름 *</label>
                    <select
                      value={formData.member_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          member_name: e.target.value,
                        })
                      }
                      required
                      disabled={submitting}
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
                      disabled={submitting}
                    >
                      <option value="">유형 선택</option>
                      <option value="정기전">정기전</option>
                      <option value="사용">사용</option>
                      <option value="기타">기타</option>
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
                      disabled={submitting}
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
                      disabled={submitting}
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
                      disabled={submitting}
                    >
                      <option value="">사유 선택</option>
                      {reasonOptions.map((reason) => (
                        <option key={reason.name} value={reason.name}>
                          {reason.name}{' '}
                          {`(${
                            reason.amount > 0 ? '+' : ''
                          }${reason.amount.toLocaleString()}P)`}
                        </option>
                      ))}
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
                      disabled={submitting}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <div className="loading-spinner"></div>
                        수정 중...
                      </>
                    ) : (
                      '수정'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetForm}
                    disabled={submitting}
                  >
                    취소
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 사유 설정 모달 */}
      {showReasonSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>포인트 설정</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowReasonSettings(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="reason-settings-grid">
                {editingReasons
                  .filter((reason) => reason.name !== '기타')
                  .map((reason, index) => (
                    <div key={reason.name} className="reason-setting-item">
                      <label className="reason-name">{reason.name}</label>
                      <div className="reason-amount-input">
                        <input
                          type="number"
                          value={
                            typeof reason.amount === 'string'
                              ? reason.amount
                              : Number.isFinite(reason.amount)
                              ? String(reason.amount)
                              : ''
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            // 입력 중 상태 허용: '', '-'
                            if (value === '' || value === '-') {
                              updateEditingReason(index, 'amount', value);
                              return;
                            }
                            const numValue = Number(value);
                            if (!Number.isNaN(numValue)) {
                              updateEditingReason(index, 'amount', numValue);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              const currentAmount =
                                typeof reason.amount === 'number'
                                  ? reason.amount
                                  : 0;
                              updateEditingReason(
                                index,
                                'amount',
                                currentAmount + 500
                              );
                            } else if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              const currentAmount =
                                typeof reason.amount === 'number'
                                  ? reason.amount
                                  : 0;
                              updateEditingReason(
                                index,
                                'amount',
                                currentAmount - 500
                              );
                            } else if (e.key === '-') {
                              // 전체 선택 상태에서 '-' 입력 허용
                              const input = e.target;
                              const start = input.selectionStart;
                              const end = input.selectionEnd;
                              if (start !== end) {
                                e.preventDefault();
                                updateEditingReason(index, 'amount', '-');
                              }
                            }
                          }}
                          onMouseDown={(e) => {
                            // 스피너 버튼 클릭 감지 및 기본 동작 차단
                            const rect = e.target.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top;
                            const width = rect.width;
                            const height = rect.height;

                            if (
                              x > width - 20 &&
                              x < width &&
                              y >= 0 &&
                              y <= height
                            ) {
                              e.preventDefault();
                              e.stopPropagation();

                              const currentAmount =
                                typeof reason.amount === 'number'
                                  ? reason.amount
                                  : 0;
                              if (y < height / 2) {
                                updateEditingReason(
                                  index,
                                  'amount',
                                  currentAmount + 500
                                );
                              } else {
                                updateEditingReason(
                                  index,
                                  'amount',
                                  currentAmount - 500
                                );
                              }
                            }
                          }}
                          step="1"
                          min="-999999"
                          max="999999"
                        />
                        <span className="amount-unit">P</span>
                      </div>
                    </div>
                  ))}
                <div className="reason-setting-item">
                  <label className="reason-name">기타</label>
                  <div className="reason-amount-input">
                    <span className="readonly-note">
                      기타 항목은 각 행에서 직접 입력하세요
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetReasonSettings}
              >
                기본값 복원
              </button>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowReasonSettings(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={saveReasonSettings}
                >
                  저장
                </button>
              </div>
            </div>
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
                <div className="form-group autocomplete-wrapper">
                  <input
                    type="text"
                    value={searchMember}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchMember(value);
                      // 검색어로 회원 필터링
                      const filtered = members.filter((member) =>
                        member.name.toLowerCase().includes(value.toLowerCase())
                      );
                      setFilteredMembers(filtered);
                      setShowDropdown(value.length > 0 && filtered.length > 0);
                    }}
                    onFocus={() => {
                      if (searchMember) {
                        const filtered = members.filter((member) =>
                          member.name
                            .toLowerCase()
                            .includes(searchMember.toLowerCase())
                        );
                        setFilteredMembers(filtered);
                        setShowDropdown(filtered.length > 0);
                      }
                    }}
                    onKeyPress={(e) =>
                      e.key === 'Enter' && handleMemberSearch()
                    }
                    placeholder="회원명을 입력하거나 선택하세요"
                    className="member-search-input"
                  />
                  {showDropdown && (
                    <div className="autocomplete-dropdown">
                      {filteredMembers.map((member) => (
                        <div
                          key={member.id}
                          className="autocomplete-item"
                          onClick={() => {
                            setSearchMember(member.name);
                            setShowDropdown(false);
                          }}
                        >
                          {member.name}
                        </div>
                      ))}
                    </div>
                  )}
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
                                    point.point_type === '사용'
                                      ? 'negative'
                                      : point.point_type === '정기전' ||
                                        point.point_type === '기타'
                                      ? point.amount >= 0
                                        ? 'positive'
                                        : 'negative'
                                      : 'negative'
                                  }`}
                                >
                                  {point.point_type}
                                </span>
                              </td>
                              <td
                                className={
                                  (point.point_type === '적립' ||
                                    point.point_type === '기타') &&
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
                  className="btn btn-outline-primary nav-btn"
                  onClick={() => {
                    const oldestMonth = new Date(
                      Math.min(
                        ...points.map(
                          (p) => new Date(p.point_date || p.created_at)
                        )
                      )
                    );
                    setCurrentMonth(oldestMonth);
                  }}
                  title="첫 번째 월"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M18 17L13 12L18 7M11 17L6 12L11 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  className="btn btn-outline-primary nav-btn"
                  onClick={goToPreviousMonth}
                  title="이전 월"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M15 18L9 12L15 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div className="current-date-info">
                  <span className="date-display">
                    {currentMonth.getFullYear()}-
                    {String(currentMonth.getMonth() + 1).padStart(2, '0')}
                  </span>
                  <div className="date-details">
                    <span className="participant-count">
                      총 {displayPoints.length}건
                    </span>
                  </div>
                </div>
                <button
                  className="btn btn-outline-primary nav-btn"
                  onClick={goToNextMonth}
                  title="다음 월"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 18L15 12L9 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  className="btn btn-outline-primary nav-btn"
                  onClick={goToLatestMonth}
                  title="최신 월"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 17L11 12L6 7M13 17L18 12L13 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
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
                            <option value="정기전">정기전</option>
                            <option value="사용">사용</option>
                            <option value="기타">기타</option>
                          </select>
                        ) : (
                          <span
                            className={`point-type ${
                              point.point_type === '사용'
                                ? 'negative'
                                : point.point_type === '정기전' ||
                                  point.point_type === '기타'
                                ? point.amount >= 0
                                  ? 'positive'
                                  : 'negative'
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
                                point.point_type === '기타') &&
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
                              disabled={deleting}
                            >
                              {deleting ? (
                                <>
                                  <div className="loading-spinner"></div>
                                  삭제 중...
                                </>
                              ) : (
                                '삭제'
                              )}
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
