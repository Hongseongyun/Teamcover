import React, { useState, useEffect, useCallback } from 'react';
import { paymentAPI, memberAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Payments.css';

// 정기전 게임비 날짜별 그룹 컴포넌트
const GamePaymentsByDate = ({
  payments,
  onEdit,
  onDelete,
  onToggle,
  isAdmin,
  deleting,
  formatNumber,
}) => {
  // 날짜별로 그룹화
  const groupByDate = payments.reduce((acc, payment) => {
    const date = payment.payment_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(payment);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupByDate).sort((a, b) =>
    b.localeCompare(a)
  );

  return (
    <div className="game-payments-cards">
      {sortedDates.map((date) => (
        <div key={date} className="game-date-card">
          <div className="game-date-header">
            <h4>{date}</h4>
            {isAdmin && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => onEdit(groupByDate[date][0])}
                title="편집"
              >
                편집
              </button>
            )}
          </div>
          <div className="game-payments-grid">
            {groupByDate[date].map((payment) => (
              <div
                key={payment.id}
                className="game-payment-card"
                onClick={() => isAdmin && onToggle && onToggle(payment)}
                style={{ cursor: isAdmin ? 'pointer' : 'default' }}
              >
                <div className="game-card-header">
                  <span className="game-member-name">
                    {payment.member_name}
                  </span>
                </div>
                <div className="game-card-body">
                  <div
                    className={`game-card-status ${
                      payment.is_paid ? 'status-paid' : 'status-unpaid'
                    }`}
                  >
                    {payment.is_paid ? '납입완료' : '미납'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const Payments = () => {
  const { user } = useAuth();
  const isAdmin =
    user && (user.role === 'admin' || user.role === 'super_admin');

  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 뷰 모드 (list: 목록, calendar: 월별 표)
  const [viewMode, setViewMode] = useState('calendar');

  // 연도 선택
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [showAddForm, setShowAddForm] = useState(false);

  // 정기전 게임비 관리 상태
  const [showGamePaymentModal, setShowGamePaymentModal] = useState(false);
  const [gamePaymentDate, setGamePaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [gamePaymentMembers, setGamePaymentMembers] = useState([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [availableMembers, setAvailableMembers] = useState([]);

  // 임시 상태 관리 (여러 개 수정 후 일괄 저장)
  const [tempPaymentStates, setTempPaymentStates] = useState({});
  // 임시 납입 추가 (아직 저장 안 됨)
  const [tempNewPayments, setTempNewPayments] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    member_id: '',
    payment_type: 'monthly',
    amount: '',
    payment_date: '',
    is_paid: true,
    note: '',
  });

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);

      const response = await paymentAPI.getPayments();
      if (response.data.success) {
        setPayments(response.data.payments);

        // 디버깅: 면제 상태가 있는 납입 확인
        const exemptPayments = response.data.payments.filter(
          (p) => p.is_exempt
        );
        if (exemptPayments.length > 0) {
          console.log('면제 상태 납입 로드:', exemptPayments);
        }
      }
    } catch (error) {
      console.error('납입 내역 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
    loadMembers();
  }, [loadPayments]);

  const loadMembers = async () => {
    try {
      const response = await memberAPI.getMembers();
      if (response.data.success) {
        setMembers(response.data.members);
        setAvailableMembers(response.data.members);
      }
    } catch (error) {
      console.error('회원 목록 로드 실패:', error);
    }
  };

  // 정기전 게임비 관리 함수들
  const openGamePaymentModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setShowGamePaymentModal(true);
    setGamePaymentDate(today);
    setGamePaymentMembers([]);
    setMemberSearchQuery('');
    setAvailableMembers(members); // 회원 목록 초기화
    // 해당 날짜의 기존 게임비 내역 불러오기
    loadGamePaymentsForDate(today);
  };

  const closeGamePaymentModal = () => {
    setShowGamePaymentModal(false);
    setGamePaymentMembers([]);
  };

  const loadGamePaymentsForDate = (date) => {
    // payments가 로드된 후에만 실행
    if (payments && payments.length > 0) {
      const gamePayments = payments.filter(
        (p) => p.payment_type === 'game' && p.payment_date === date
      );

      const memberPayments = gamePayments.map((payment) => ({
        member_id: payment.member_id,
        member_name: payment.member_name,
        is_paid: payment.is_paid,
        payment_id: payment.id,
      }));

      setGamePaymentMembers(memberPayments);
    }
  };

  const handleDateChange = (date) => {
    setGamePaymentDate(date);
    loadGamePaymentsForDate(date);
  };

  const handleSearchMembers = (query) => {
    setMemberSearchQuery(query);
    // members 전체 목록에서 검색
    if (query.trim()) {
      const filtered = members.filter((member) =>
        member.name.toLowerCase().includes(query.toLowerCase())
      );
      setAvailableMembers(filtered);
    } else {
      setAvailableMembers(members);
    }
  };

  const addMemberToGamePayment = (member) => {
    // 이미 추가된 회원인지 확인
    const exists = gamePaymentMembers.find((m) => m.member_id === member.id);
    if (!exists) {
      setGamePaymentMembers((prev) => [
        ...prev,
        {
          member_id: member.id,
          member_name: member.name,
          is_paid: false,
          payment_id: null, // 새로 추가된 회원
        },
      ]);
    }
    setMemberSearchQuery('');
    // 불필요한 전체 회원 목록 재로드 제거 (성능 향상)
  };

  const removeMemberFromGamePayment = (memberId) => {
    setGamePaymentMembers((prev) =>
      prev.filter((m) => m.member_id !== memberId)
    );
  };

  const toggleGamePaymentStatus = (memberId) => {
    setGamePaymentMembers((prev) =>
      prev.map((m) =>
        m.member_id === memberId ? { ...m, is_paid: !m.is_paid } : m
      )
    );
  };

  // 정기전 게임비 카드에서 직접 토글
  const toggleGamePaymentCard = async (payment) => {
    try {
      await paymentAPI.updatePayment(payment.id, {
        is_paid: !payment.is_paid,
      });
      loadPayments(); // 목록 새로고침
    } catch (error) {
      console.error('납입 상태 변경 실패:', error);
      alert('납입 상태 변경에 실패했습니다.');
    }
  };

  const saveGamePayments = async () => {
    if (gamePaymentMembers.length === 0) {
      alert('추가된 회원이 없습니다.');
      return;
    }

    setSubmitting(true);

    try {
      const promises = [];

      // 기존 게임비 목록에서 해당 날짜의 모든 납입 가져오기
      const existingPayments = payments.filter(
        (p) => p.payment_type === 'game' && p.payment_date === gamePaymentDate
      );

      // 현재 모달에 있는 회원 목록
      const currentMemberIds = gamePaymentMembers.map((m) => m.member_id);

      // 삭제해야 할 납입 (모달에 없는데 DB에 있음)
      for (const existingPayment of existingPayments) {
        if (!currentMemberIds.includes(existingPayment.member_id)) {
          promises.push(paymentAPI.deletePayment(existingPayment.id));
        }
      }

      // 추가/수정해야 할 납입
      for (const memberPayment of gamePaymentMembers) {
        const paymentData = {
          member_id: memberPayment.member_id,
          payment_type: 'game',
          amount: 14000,
          payment_date: gamePaymentDate,
          is_paid: memberPayment.is_paid,
          note: '',
        };

        if (memberPayment.payment_id) {
          // 기존 납입 수정
          promises.push(
            paymentAPI.updatePayment(memberPayment.payment_id, paymentData)
          );
        } else {
          // 새 납입 추가
          promises.push(paymentAPI.addPayment(paymentData));
        }
      }

      await Promise.all(promises);
      await loadPayments();
      closeGamePaymentModal();
      alert('정기전 게임비가 저장되었습니다.');
    } catch (error) {
      console.error('정기전 게임비 저장 실패:', error);
      alert('정기전 게임비 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingId) {
        await paymentAPI.updatePayment(editingId, formData);
        alert('납입 내역이 수정되었습니다.');
      } else {
        await paymentAPI.addPayment(formData);
        alert('납입 내역이 추가되었습니다.');
      }

      setShowAddForm(false);
      setEditingId(null);
      resetForm();
      loadPayments();
    } catch (error) {
      alert(error.response?.data?.message || '납입 내역 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말로 이 납입 내역을 삭제하시겠습니까?')) {
      setDeleting(true);
      try {
        await paymentAPI.deletePayment(id);
        loadPayments();
      } catch (error) {
        alert('납입 내역 삭제에 실패했습니다.');
      } finally {
        setDeleting(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      member_id: '',
      payment_type: 'monthly',
      amount: '',
      payment_date: '',
      is_paid: true,
      note: '',
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const startEdit = (payment) => {
    // 정기전 게임비인 경우 날짜별 모달로 열기
    if (payment.payment_type === 'game') {
      const paymentDate = payment.payment_date;
      setGamePaymentDate(paymentDate);
      setShowGamePaymentModal(true);
      setMemberSearchQuery('');
      setAvailableMembers(members);
      // 해당 날짜의 게임비 내역 불러오기
      loadGamePaymentsForDate(paymentDate);
    } else {
      // 기존 납입 추가/수정 폼 사용
      setEditingId(payment.id);
      setFormData({
        member_id: payment.member_id,
        payment_type: payment.payment_type,
        amount: payment.amount,
        payment_date: payment.payment_date,
        is_paid: payment.is_paid,
        note: payment.note || '',
      });
      setShowAddForm(true);
    }
  };

  const formatNumber = (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const formatPaymentType = (type) => {
    return type === 'monthly' ? '월회비' : '정기전 게임비';
  };

  // 월 표시 형식 변환 (YYYY-MM -> M월)
  const formatMonth = (monthStr) => {
    const month = parseInt(monthStr.split('-')[1]);
    return `${month}월`;
  };

  // 월 목록 생성 (선택된 연도의 1-12월)
  const generateMonths = (year) => {
    const months = [];
    for (let month = 1; month <= 12; month++) {
      const monthStr = String(month).padStart(2, '0');
      months.push(`${year}-${monthStr}`); // YYYY-MM 형식
    }
    return months;
  };

  const months = generateMonths(selectedYear);

  // 연도 선택 핸들러
  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
  };

  // 이전 연도
  const goToPreviousYear = () => {
    setSelectedYear(selectedYear - 1);
  };

  // 다음 연도
  const goToNextYear = () => {
    setSelectedYear(selectedYear + 1);
  };

  // 회원별 월별 납입 현황 구성
  const getPaymentStatus = (memberId, month, paymentType) => {
    // 먼저 임시 새 납입 확인
    const tempPayment = tempNewPayments.find(
      (p) =>
        p.member_id === memberId &&
        p.month === month &&
        p.payment_type === paymentType
    );
    if (tempPayment) return tempPayment;

    // 실제 납입 확인
    const payment = payments.find(
      (p) =>
        p.member_id === memberId &&
        p.month === month &&
        p.payment_type === paymentType
    );
    return payment;
  };

  // 빠른 납입 추가 (임시 상태로만 표시)
  const handleQuickAdd = (memberId, month, paymentType, amount) => {
    // 임시 납입 추가
    const tempId = `temp_${memberId}_${month}_${Date.now()}`;
    const newPayment = {
      id: tempId,
      member_id: memberId,
      month: month,
      payment_type: paymentType,
      amount: amount,
      is_paid: true,
      is_exempt: false,
      member_name: members.find((m) => m.id === memberId)?.name || '',
    };

    setTempNewPayments((prev) => [...prev, newPayment]);
  };

  // 임시 납입 제거
  const removeTempPayment = (tempId) => {
    setTempNewPayments((prev) => prev.filter((p) => p.id !== tempId));
  };

  // 면제 상태를 관리하기 위한 별도 state
  const [tempExemptStates, setTempExemptStates] = useState({});
  const [tempDeletePayments, setTempDeletePayments] = useState([]);

  // 면제 상태 가져오기
  const getTempExemptState = (paymentId, originalExemptState) => {
    if (tempExemptStates[paymentId] !== undefined) {
      return tempExemptStates[paymentId];
    }
    return originalExemptState;
  };

  // 납입 상태 순환 함수
  const togglePaymentCycle = (payment) => {
    const paymentId = payment.id;
    const isTemp = paymentId.toString().startsWith('temp_');

    // 임시 새 납입인 경우
    if (isTemp) {
      // 현재 임시 납입 상태 확인
      const tempPayment = tempNewPayments.find((p) => p.id === paymentId);
      if (!tempPayment) return;

      // 상태 순환: 체크 -> 면제 -> x -> 삭제
      const currentIsExempt = tempPayment.is_exempt || false;
      const currentIsPaid = tempPayment.is_paid || false;

      // 면제 상태인 경우 → 미납으로 변경
      if (currentIsExempt) {
        setTempNewPayments((prev) =>
          prev.map((p) =>
            p.id === paymentId ? { ...p, is_exempt: false, is_paid: false } : p
          )
        );
        return;
      }

      // 납입완료 상태인 경우 → 면제로 변경
      if (currentIsPaid) {
        setTempNewPayments((prev) =>
          prev.map((p) =>
            p.id === paymentId ? { ...p, is_paid: false, is_exempt: true } : p
          )
        );
        return;
      }

      // 미납 상태인 경우 → 삭제
      removeTempPayment(paymentId);
      return;
    }

    // 기존 납입인 경우
    const currentIsExempt = getTempExemptState(paymentId, payment.is_exempt);
    const currentIsPaid = getTempPaymentState(paymentId, payment.is_paid);

    // 1. 면제 상태인 경우 → 미납(x)으로 변경
    if (currentIsExempt) {
      setTempExemptStates((prev) => ({
        ...prev,
        [paymentId]: false,
      }));
      setTempPaymentStates((prev) => ({
        ...prev,
        [paymentId]: false,
      }));
      return;
    }

    // 2. 납입완료 상태인 경우 → 면제로 변경
    if (currentIsPaid) {
      setTempExemptStates((prev) => ({
        ...prev,
        [paymentId]: true,
      }));
      setTempPaymentStates((prev) => ({
        ...prev,
        [paymentId]: false,
      }));
      return;
    }

    // 3. 미납 상태인 경우 → 삭제
    setTempDeletePayments((prev) => [...prev, paymentId]);
  };

  // 일괄 저장
  const savePaymentStates = async () => {
    setSubmitting(true);

    try {
      // 삭제할 납입들
      const deletePromises = tempDeletePayments.map((paymentId) =>
        paymentAPI.deletePayment(paymentId)
      );

      // 기존 납입 상태 업데이트
      const updates = [];

      // 면제 상태가 변경된 납입들
      for (const [paymentId, isExempt] of Object.entries(tempExemptStates)) {
        const payment = payments.find((p) => p.id === parseInt(paymentId));
        if (!payment) continue;

        const updateData = {
          is_paid:
            tempPaymentStates[paymentId] !== undefined
              ? tempPaymentStates[paymentId]
              : payment.is_paid,
          is_exempt: isExempt,
        };

        // 디버깅 로그
        console.log('면제 상태 저장:', {
          paymentId,
          updateData,
          original: {
            is_paid: payment.is_paid,
            is_exempt: payment.is_exempt,
          },
        });

        updates.push(paymentAPI.updatePayment(payment.id, updateData));
      }

      // is_paid만 변경된 납입들 (면제 상태는 그대로)
      for (const [paymentId, isPaid] of Object.entries(tempPaymentStates)) {
        // 면제 상태도 변경된 경우는 이미 위에서 처리
        if (tempExemptStates[paymentId] !== undefined) continue;

        const payment = payments.find((p) => p.id === parseInt(paymentId));
        if (!payment) continue;

        // 삭제 예정이 아닌 경우만 업데이트
        if (!tempDeletePayments.includes(parseInt(paymentId))) {
          updates.push(
            paymentAPI.updatePayment(payment.id, {
              is_paid: isPaid,
            })
          );
        }
      }

      // 새로운 납입 추가
      const newPayments = await Promise.all(
        tempNewPayments.map((tempPayment) => {
          const paymentDate = `${tempPayment.month}-01`;
          return paymentAPI.addPayment({
            member_id: tempPayment.member_id,
            payment_type: tempPayment.payment_type,
            amount: tempPayment.amount,
            payment_date: paymentDate,
            is_paid: tempPayment.is_paid,
            is_exempt: tempPayment.is_exempt || false,
            note: '',
          });
        })
      );

      await Promise.all([...deletePromises, ...updates, ...newPayments]);
      setTempPaymentStates({});
      setTempExemptStates({});
      setTempDeletePayments([]);
      setTempNewPayments([]);
      await loadPayments();
      alert('납입 상태가 저장되었습니다.');
    } catch (error) {
      alert('납입 상태 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 취소
  const cancelTempChanges = () => {
    setTempPaymentStates({});
    setTempExemptStates({});
    setTempDeletePayments([]);
    setTempNewPayments([]);
  };

  // 임시 상태 가져오기
  const getTempPaymentState = (paymentId, originalState) => {
    if (tempPaymentStates[paymentId] !== undefined) {
      return tempPaymentStates[paymentId];
    }
    return originalState;
  };

  // 변경사항이 있는지 확인
  const hasTempChanges =
    Object.keys(tempPaymentStates).length > 0 ||
    tempNewPayments.length > 0 ||
    Object.keys(tempExemptStates).length > 0 ||
    tempDeletePayments.length > 0;

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="payments-page">
      <div className="page-header">
        <h1>회비관리</h1>
      </div>

      {/* 납입 추가/수정 폼 */}
      {isAdmin && showAddForm && (
        <div className="form-section">
          <div className="section-card">
            <h3 className="section-title">
              {editingId ? '납입 내역 수정' : '납입 내역 추가'}
            </h3>
            <form onSubmit={handleSubmit} className="payment-form">
              <div className="form-row">
                <div className="form-group">
                  <label>회원 *</label>
                  <select
                    value={formData.member_id}
                    onChange={(e) =>
                      setFormData({ ...formData, member_id: e.target.value })
                    }
                    required
                    disabled={submitting}
                  >
                    <option value="">회원 선택</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>납입 유형 *</label>
                  <select
                    value={formData.payment_type}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_type: e.target.value })
                    }
                    required
                    disabled={submitting}
                  >
                    <option value="monthly">월회비</option>
                    <option value="game">정기전 게임비</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>금액 *</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    required
                    min="0"
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label>납입일 *</label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_date: e.target.value })
                    }
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>납입 여부</label>
                  <select
                    value={formData.is_paid}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_paid: e.target.value === 'true',
                      })
                    }
                    disabled={submitting}
                  >
                    <option value="true">납입 완료</option>
                    <option value="false">미납</option>
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
                    placeholder="추가 정보"
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
                      {editingId ? '수정 중...' : '등록 중...'}
                    </>
                  ) : editingId ? (
                    '수정'
                  ) : (
                    '등록'
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
        </div>
      )}

      {/* 뷰 모드 전환 */}
      <div className="view-toggle-section">
        <div className="view-toggle">
          <button
            className={`btn btn-sm ${
              viewMode === 'calendar' ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={() => setViewMode('calendar')}
          >
            월별 표
          </button>
          <button
            className={`btn btn-sm ${
              viewMode === 'list' ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={() => setViewMode('list')}
          >
            목록 보기
          </button>
        </div>
      </div>

      {/* 월별 표 형식 뷰 */}
      {viewMode === 'calendar' && (
        <div className="payments-section">
          {/* 일괄 저장 버튼 */}
          {hasTempChanges && (
            <div className="batch-actions">
              <div className="section-card">
                <div className="batch-actions-content">
                  <span className="batch-info">
                    {Object.keys(tempPaymentStates).length +
                      tempNewPayments.length +
                      Object.keys(tempExemptStates).length +
                      tempDeletePayments.length}
                    개의 변경사항이 있습니다.
                  </span>
                  <div className="batch-buttons">
                    <button
                      className="btn btn-secondary"
                      onClick={cancelTempChanges}
                      disabled={submitting}
                    >
                      취소
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={savePaymentStates}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner"></div>
                          저장 중...
                        </>
                      ) : (
                        '저장'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 연도 네비게이션 */}
          <div className="year-navigation-section">
            <div className="section-card">
              <div className="year-navigation">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={goToPreviousYear}
                >
                  ◀
                </button>
                <div className="year-display">
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(e) =>
                      handleYearChange(
                        parseInt(e.target.value) || new Date().getFullYear()
                      )
                    }
                    className="year-input"
                    min="2000"
                    max="2100"
                  />
                  <span className="year-label">년</span>
                </div>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={goToNextYear}
                >
                  ▶
                </button>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h3 className="section-title">월별 납입 현황 (월회비)</h3>
            <div className="monthly-calendar-table">
              <table>
                <thead>
                  <tr>
                    <th className="member-col">회원</th>
                    {months.map((month) => (
                      <th key={month} className="month-col">
                        {formatMonth(month)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="member-name">{member.name}</td>
                      {months.map((month) => {
                        // 운영진 회원은 면제 표시
                        if (member.is_staff) {
                          return (
                            <td key={month} className="status-cell">
                              <span
                                className="payment-status exempt"
                                title="운영진 회원은 회비 면제"
                              >
                                면제
                              </span>
                            </td>
                          );
                        }

                        // 가입일 기준 비활성화 체크
                        const isBeforeJoinDate = (() => {
                          if (!member.join_date) return false;

                          const joinDate = new Date(member.join_date);
                          const year = joinDate.getFullYear();
                          const monthIndex = joinDate.getMonth(); // 0-11
                          const day = joinDate.getDate();

                          const targetMonth = new Date(month + '-01');
                          const targetYear = targetMonth.getFullYear();
                          const targetMonthIndex = targetMonth.getMonth(); // 0-11

                          // 가입월보다 이전인 경우 비활성화
                          if (
                            year < targetYear ||
                            (year === targetYear &&
                              monthIndex < targetMonthIndex)
                          ) {
                            return false; // 가입 후 월이므로 활성화
                          }

                          // 가입월보다 이후인 경우 비활성화
                          if (
                            year > targetYear ||
                            (year === targetYear &&
                              monthIndex > targetMonthIndex)
                          ) {
                            return true; // 가입 전 월이므로 비활성화
                          }

                          // 같은 년도, 같은 월인 경우
                          // 15일 이전에 가입했으면 그 달부터 활성화, 15일 이후에 가입했으면 그 달은 비활성화
                          return day > 15;
                        })();

                        const payment = getPaymentStatus(
                          member.id,
                          month,
                          'monthly'
                        );
                        return (
                          <td key={month} className="status-cell">
                            {isBeforeJoinDate ? (
                              <span
                                className="payment-status disabled"
                                title="가입일 이전입니다"
                              >
                                -
                              </span>
                            ) : payment ? (
                              (() => {
                                const paymentId = payment.id;

                                // 삭제 예정인 경우 빈 상태(+) 표시
                                if (tempDeletePayments.includes(paymentId)) {
                                  return (
                                    <button
                                      className="btn btn-xs btn-add"
                                      onClick={() =>
                                        handleQuickAdd(
                                          member.id,
                                          month,
                                          'monthly',
                                          5000
                                        )
                                      }
                                      disabled={submitting}
                                      title="납입 추가"
                                    >
                                      +
                                    </button>
                                  );
                                }

                                const isTemp = paymentId
                                  .toString()
                                  .startsWith('temp_');
                                let isPaid, isExempt;

                                if (isTemp) {
                                  // 임시 새 납입인 경우
                                  const tempPayment = tempNewPayments.find(
                                    (p) => p.id === paymentId
                                  );
                                  isPaid = tempPayment?.is_paid || false;
                                  isExempt = tempPayment?.is_exempt || false;
                                } else {
                                  // 기존 납입인 경우
                                  const currentPaidState =
                                    tempPaymentStates[paymentId];
                                  isPaid =
                                    currentPaidState !== undefined
                                      ? currentPaidState
                                      : payment.is_paid;
                                  // 면제 상태는 원본 또는 임시 상태 확인
                                  const tempExemptState = getTempExemptState(
                                    paymentId,
                                    payment.is_exempt
                                  );
                                  isExempt = tempExemptState;

                                  // 디버깅용 로그
                                  if (payment.is_exempt) {
                                    console.log('면제 상태 확인:', {
                                      paymentId,
                                      payment_is_exempt: payment.is_exempt,
                                      tempExemptState,
                                      isExempt,
                                    });
                                  }
                                }

                                // 면제 상태
                                if (isExempt) {
                                  return (
                                    <button
                                      className="payment-status exempt"
                                      title="클릭하여 미납으로 변경"
                                      onClick={() =>
                                        togglePaymentCycle(payment)
                                      }
                                      disabled={submitting}
                                    >
                                      면제
                                    </button>
                                  );
                                }

                                // 납입 완료 상태
                                if (isPaid) {
                                  return (
                                    <button
                                      className="payment-status paid"
                                      title="클릭하여 면제로 변경"
                                      onClick={() =>
                                        togglePaymentCycle(payment)
                                      }
                                      disabled={submitting}
                                    >
                                      ✓
                                    </button>
                                  );
                                }

                                // 미납 상태
                                return (
                                  <button
                                    className="payment-status unpaid"
                                    title="클릭하여 삭제"
                                    onClick={() => togglePaymentCycle(payment)}
                                    disabled={submitting}
                                  >
                                    ✗
                                  </button>
                                );
                              })()
                            ) : (
                              <button
                                className="btn btn-xs btn-add"
                                onClick={() =>
                                  handleQuickAdd(
                                    member.id,
                                    month,
                                    'monthly',
                                    5000
                                  )
                                }
                                disabled={submitting}
                                title="납입 추가"
                              >
                                +
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 정기전 게임비 관리 섹션 (날짜별) */}
      <div className="payments-section">
        <div className="section-card">
          <div className="game-payment-header">
            <h3 className="section-title">정기전 게임비 관리 (날짜별)</h3>
            {isAdmin && (
              <button
                className="btn btn-primary"
                onClick={openGamePaymentModal}
              >
                정기전 추가
              </button>
            )}
          </div>

          {/* 게임비 내역 (날짜별 그룹화) */}
          <div className="game-payments-list">
            {payments.filter((p) => p.payment_type === 'game').length === 0 ? (
              <p className="no-data">정기전 게임비 내역이 없습니다.</p>
            ) : (
              <GamePaymentsByDate
                payments={payments.filter((p) => p.payment_type === 'game')}
                onEdit={startEdit}
                onDelete={handleDelete}
                onToggle={toggleGamePaymentCard}
                isAdmin={isAdmin}
                deleting={deleting}
                formatNumber={formatNumber}
              />
            )}
          </div>
        </div>
      </div>

      {/* 목록 형식 뷰 */}
      {viewMode === 'list' && (
        <div className="payments-section">
          <div className="section-card">
            <h3 className="section-title">납입 내역</h3>
            <div className="payments-table">
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>회원</th>
                    <th>유형</th>
                    <th>금액</th>
                    <th>납입 여부</th>
                    <th>비고</th>
                    {isAdmin && <th>작업</th>}
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="no-data">
                        납입 내역이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.payment_date}</td>
                        <td>{payment.member_name}</td>
                        <td>
                          <span
                            className={`payment-type ${payment.payment_type}`}
                          >
                            {formatPaymentType(payment.payment_type)}
                          </span>
                        </td>
                        <td>{formatNumber(payment.amount)}원</td>
                        <td>
                          <span
                            className={
                              payment.is_paid ? 'status-paid' : 'status-unpaid'
                            }
                          >
                            {payment.is_paid ? '완료' : '미납'}
                          </span>
                        </td>
                        <td>{payment.note || '-'}</td>
                        {isAdmin && (
                          <td>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => startEdit(payment)}
                            >
                              수정
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDelete(payment.id)}
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
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* 목록 형식 뷰 종료 */}
        </div>
      )}

      {/* 정기전 게임비 모달 */}
      {showGamePaymentModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeGamePaymentModal();
          }}
        >
          <div className="modal-content game-payment-modal">
            <div className="modal-header">
              <h3>정기전 게임비 관리</h3>
              <button
                className="btn btn-sm btn-secondary"
                onClick={closeGamePaymentModal}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* 날짜 선택 */}
              <div className="form-group">
                <label>게임 날짜 *</label>
                <input
                  type="date"
                  value={gamePaymentDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="form-control"
                />
              </div>

              {/* 회원 검색 및 추가 */}
              <div className="form-group">
                <label>회원 검색</label>
                <div className="search-member-wrapper">
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => handleSearchMembers(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && availableMembers.length > 0) {
                        e.preventDefault();
                        // 첫 번째 결과 자동 추가
                        const firstMember = availableMembers[0];
                        const isAdded = gamePaymentMembers.find(
                          (m) => m.member_id === firstMember.id
                        );
                        if (!isAdded) {
                          addMemberToGamePayment(firstMember);
                        }
                      }
                    }}
                    placeholder="회원 이름을 입력하세요"
                    className="form-control"
                  />
                  {memberSearchQuery && availableMembers.length > 0 && (
                    <div className="search-results">
                      <ul className="member-list">
                        {availableMembers.map((member) => {
                          const isAdded = gamePaymentMembers.find(
                            (m) => m.member_id === member.id
                          );
                          return (
                            <li
                              key={member.id}
                              className={`member-item ${
                                isAdded ? 'added' : ''
                              }`}
                              onClick={() =>
                                !isAdded && addMemberToGamePayment(member)
                              }
                            >
                              <span>{member.name}</span>
                              {isAdded && <span className="badge">추가됨</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* 추가된 회원 목록 */}
              {gamePaymentMembers.length > 0 && (
                <div className="added-members-list">
                  <h4>참가 회원 ({gamePaymentMembers.length}명)</h4>
                  <table className="game-payment-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>납입 여부</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gamePaymentMembers.map((memberPayment) => (
                        <tr key={memberPayment.member_id}>
                          <td>{memberPayment.member_name}</td>
                          <td>
                            <button
                              className={`btn btn-sm ${
                                memberPayment.is_paid
                                  ? 'btn-success'
                                  : 'btn-outline-danger'
                              }`}
                              onClick={() =>
                                toggleGamePaymentStatus(memberPayment.member_id)
                              }
                              disabled={submitting}
                            >
                              {memberPayment.is_paid ? '✓ 납입완료' : '✗ 미납'}
                            </button>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() =>
                                removeMemberFromGamePayment(
                                  memberPayment.member_id
                                )
                              }
                              disabled={submitting}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={closeGamePaymentModal}
                disabled={submitting}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={saveGamePayments}
                disabled={submitting || gamePaymentMembers.length === 0}
              >
                {submitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
