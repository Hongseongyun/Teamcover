import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { paymentAPI, memberAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Payments.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

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
  // 정기전 게임비 임시 상태 관리 (일괄 저장용)
  const [tempGamePaymentStates, setTempGamePaymentStates] = useState({});

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

  // 목록 인라인 수정 상태
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineForm, setInlineForm] = useState({
    amount: '',
    payment_date: '',
    is_paid: true,
    note: '',
  });

  // 선입 메뉴 표시 대상 셀 (memberId + month)
  const [prepayTarget, setPrepayTarget] = useState(null);
  const [prepayMonths, setPrepayMonths] = useState(1);
  const [prepayStatus, setPrepayStatus] = useState('paid');
  const [showPrepayModal, setShowPrepayModal] = useState(false);

  // 상단 대시보드: 잔액 및 그래프
  const [currentBalance, setCurrentBalance] = useState(1540000);
  const [startMonth] = useState(null);
  const [balanceSeries, setBalanceSeries] = useState({ labels: [], data: [] });
  // 장부 관리 상태
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerItems, setLedgerItems] = useState([]);
  const [displayedLedgerCount, setDisplayedLedgerCount] = useState(10); // 표시할 장부 항목 수
  const [selectedLedgerMonth, setSelectedLedgerMonth] = useState(''); // 선택된 월 (YYYY-MM 형식, 빈 문자열이면 전체)
  const [ledgerForm, setLedgerForm] = useState({
    event_date: new Date().toISOString().split('T')[0],
    entry_type: 'credit',
    amount: '',
    note: '',
  });
  // 금액 스피너를 위한 이전 값 추적
  const prevAmountRef = useRef(null);
  // 납입 내역 페이지네이션 및 월 필터
  const [displayedPaymentCount, setDisplayedPaymentCount] = useState(10);
  const [selectedPaymentMonth, setSelectedPaymentMonth] = useState(''); // 목록 보기 월 필터(YYYY-MM)

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);

      const response = await paymentAPI.getPayments();
      if (response.data.success) {
        setPayments(response.data.payments);
      }
    } catch (error) {
      console.error('납입 내역 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 데이터 초기 로드
  useEffect(() => {
    loadPayments();
    loadMembers();
  }, [loadPayments]);

  // 장부 데이터를 기반으로 잔액 및 그래프 계산
  const calculateBalanceAndChart = useCallback(() => {
    if (!ledgerItems || ledgerItems.length === 0) {
      setBalanceSeries({ labels: [], data: [] });
      return;
    }

    // 장부 항목을 날짜순으로 정렬
    const sortedItems = [...ledgerItems].sort((a, b) => {
      const dateA = new Date(a.event_date);
      const dateB = new Date(b.event_date);
      return dateA - dateB;
    });

    // 월별로 그룹화하여 처리
    const monthlyData = {};
    sortedItems.forEach((item) => {
      const date = new Date(item.event_date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { credit: 0, debit: 0 };
      }

      if (item.entry_type === 'credit') {
        monthlyData[monthKey].credit += parseInt(item.amount) || 0;
      } else if (item.entry_type === 'debit') {
        monthlyData[monthKey].debit += parseInt(item.amount) || 0;
      }
    });

    // 그래프 시작 월의 시작 잔액 계산
    // 첫 번째 월의 첫 항목이 "수기"이고 "잔여 회비"인 경우, 그 금액을 시작 잔액으로 사용
    const firstMonth = Object.keys(monthlyData).sort()[0];
    const firstMonthItems = sortedItems.filter((item) => {
      const date = new Date(item.event_date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      return monthKey === firstMonth;
    });

    // 첫 달의 첫 항목이 "수기"이고 "잔여 회비"인 경우, 그 금액을 시작 잔액으로 사용
    let initialBalance = 0;
    if (firstMonthItems.length > 0) {
      const firstItem = firstMonthItems[0];
      if (
        firstItem.source === '수기' &&
        (firstItem.note === '잔여 회비' || firstItem.note?.includes('잔여'))
      ) {
        // 첫 항목이 잔여 회비인 경우, 그 금액을 시작 잔액으로 설정
        initialBalance = parseInt(firstItem.amount) || 0;
        // 첫 달의 잔여 회비는 초기 잔액이므로 첫 달 계산에서 제외
        if (firstItem.entry_type === 'credit') {
          monthlyData[firstMonth].credit -= initialBalance;
        } else if (firstItem.entry_type === 'debit') {
          monthlyData[firstMonth].debit -= initialBalance;
        }
      }
    }

    // 그래프 데이터 생성
    const labels = [];
    const data = [];
    let runningBalance = initialBalance;

    // 월별로 순회하며 그래프 데이터 생성
    const sortedMonths = Object.keys(monthlyData).sort();

    sortedMonths.forEach((monthKey) => {
      const monthData = monthlyData[monthKey];
      const netChange = monthData.credit - monthData.debit;

      // 첫 달: 초기 잔액을 표시 (잔여 회비가 있는 경우 이미 initialBalance에 설정됨)
      // 그 다음 변경사항을 더함
      runningBalance += netChange;
      labels.push(monthKey);
      data.push(runningBalance);
    });

    setBalanceSeries({ labels, data });

    // 현재 잔액 계산 (최종 runningBalance 사용)
    setCurrentBalance(runningBalance);
  }, [ledgerItems]);

  // 장부 로드
  const loadFundLedger = useCallback(async () => {
    try {
      setLedgerLoading(true);
      // 수기 항목은 항상 조회되도록 from_month 필터 제거
      const res = await paymentAPI.getFundLedger({});
      if (res.data?.success) {
        setLedgerItems(res.data.items || []);
      } else {
        console.error('장부 조회 실패:', res.data?.message);
      }
    } catch (e) {
      console.error('장부 조회 오류:', e);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  // 장부 데이터가 변경되면 잔액 및 그래프 재계산
  useEffect(() => {
    if (ledgerItems.length > 0) {
      calculateBalanceAndChart();
    }
  }, [ledgerItems, calculateBalanceAndChart]);

  const handleLedgerSubmit = async (e) => {
    e.preventDefault();
    if (!ledgerForm.amount || parseInt(ledgerForm.amount, 10) === 0) {
      alert('금액을 입력하세요');
      return;
    }
    try {
      setLedgerLoading(true);
      const response = await paymentAPI.addFundLedger({
        event_date: ledgerForm.event_date,
        entry_type: ledgerForm.entry_type,
        amount: parseInt(ledgerForm.amount, 10),
        source: 'manual',
        note: ledgerForm.note || '',
      });

      if (response.data && !response.data.success) {
        alert(response.data.message || '장부 저장 실패');
        return;
      }

      setLedgerForm({
        event_date: new Date().toISOString().split('T')[0],
        entry_type: 'credit',
        amount: '',
        note: '',
      });
      // 새 항목 추가 후 목록 초기화
      setDisplayedLedgerCount(10);
      await loadFundLedger();
    } catch (e) {
      console.error('장부 저장 오류:', e);
      const errorMessage =
        e.response?.data?.message || e.message || '장부 저장 실패';
      alert(errorMessage);
    } finally {
      setLedgerLoading(false);
    }
  };

  // 장부 데이터 초기 로드 (잔액/그래프는 장부 데이터 기반으로 계산)
  useEffect(() => {
    loadFundLedger();
  }, [loadFundLedger]);

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
        paid_with_points: payment.paid_with_points || false,
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
          paid_with_points: false,
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
      prev.map((m) => {
        if (m.member_id !== memberId) return m;
        // 상태 순환: 미납 -> 납입완료 -> 포인트납부 -> 미납
        if (!m.is_paid && !m.paid_with_points) {
          return { ...m, is_paid: true, paid_with_points: false };
        }
        if (m.is_paid && !m.paid_with_points) {
          return { ...m, is_paid: true, paid_with_points: true };
        }
        return { ...m, is_paid: false, paid_with_points: false };
      })
    );
  };

  // 정기전 게임비 카드에서 임시 상태 토글 (3단계 순환: 미납 -> 납입 -> 포인트납부 -> 미납)
  const toggleGamePaymentCard = (payment) => {
    const currentState = tempGamePaymentStates[payment.id] || {
      is_paid: payment.is_paid,
      paid_with_points: payment.paid_with_points || false,
    };

    let newState;
    // 상태 순환: 미납 -> 납입 -> 포인트납부 -> 미납
    if (!currentState.is_paid && !currentState.paid_with_points) {
      // 미납 -> 납입
      newState = { is_paid: true, paid_with_points: false };
    } else if (currentState.is_paid && !currentState.paid_with_points) {
      // 납입 -> 포인트납부
      newState = { is_paid: true, paid_with_points: true };
    } else {
      // 포인트납부 -> 미납
      newState = { is_paid: false, paid_with_points: false };
    }

    // 임시 상태에 저장
    setTempGamePaymentStates((prev) => ({
      ...prev,
      [payment.id]: newState,
    }));
  };

  // 정기전 게임비 일괄 저장
  const saveGamePaymentCardStates = async () => {
    setSubmitting(true);
    try {
      const promises = Object.entries(tempGamePaymentStates).map(
        ([paymentId, newState]) => {
          return paymentAPI.updatePayment(parseInt(paymentId, 10), newState);
        }
      );

      await Promise.all(promises);
      setTempGamePaymentStates({});
      await loadPayments();
      alert('정기전 게임비 상태가 저장되었습니다.');
    } catch (error) {
      console.error('정기전 게임비 상태 저장 실패:', error);
      alert('정기전 게임비 상태 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 정기전 게임비 임시 상태 취소
  const cancelGamePaymentCardStates = () => {
    setTempGamePaymentStates({});
  };

  const saveGamePayments = async () => {
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

      // 모두 삭제 케이스: 모달에 0명 -> 해당 날짜 전체 삭제
      if (gamePaymentMembers.length === 0) {
        await Promise.all(promises);
        await loadPayments();
        closeGamePaymentModal();
        alert('해당 날짜의 정기전 게임비 내역이 삭제되었습니다.');
        return;
      }

      // 추가/수정해야 할 납입
      for (const memberPayment of gamePaymentMembers) {
        const paymentData = {
          member_id: memberPayment.member_id,
          payment_type: 'game',
          amount: 14000,
          payment_date: gamePaymentDate,
          is_paid: memberPayment.is_paid,
          paid_with_points: !!memberPayment.paid_with_points,
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

  // 인라인 수정 핸들러
  const handleInlineEdit = (payment) => {
    setInlineEditId(payment.id);
    setInlineForm({
      amount: payment.amount,
      payment_date: payment.payment_date,
      is_paid: payment.is_paid,
      note: payment.note || '',
    });
  };

  const handleInlineCancel = () => {
    setInlineEditId(null);
    setInlineForm({ amount: '', payment_date: '', is_paid: true, note: '' });
  };

  const handleInlineSave = async (paymentId) => {
    try {
      setSubmitting(true);
      await paymentAPI.updatePayment(paymentId, {
        amount: parseInt(inlineForm.amount, 10),
        payment_date: inlineForm.payment_date,
        is_paid: !!inlineForm.is_paid,
        note: inlineForm.note || '',
      });
      setInlineEditId(null);
      await loadPayments();
    } catch (e) {
      alert('수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
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
    if (payment) return payment;

    // 선납인 경우 해당 월 범위에 납입이 있는 것으로 표시
    if (paymentType === 'monthly') {
      const [year, currentMonthNum] = month
        .split('-')
        .map((v) => parseInt(v, 10));

      // 현재 확인하는 월이 1월~12월 범위 안인지 확인
      if (currentMonthNum >= 1 && currentMonthNum <= 12) {
        // 같은 연도의 모든 선납 납입 확인 (payment_date를 기준으로 찾음)
        const prepayPayments = payments.filter(
          (p) =>
            p.member_id === memberId &&
            p.payment_type === paymentType &&
            p.is_paid &&
            !p.is_exempt &&
            p.note?.includes('개월 선납') &&
            p.payment_date?.startsWith(`${year}-`)
        );

        for (const prepayPayment of prepayPayments) {
          // note에서 선납 정보 파싱: "2025년 1월 12개월 선납" 또는 "2025년 3월 6개월 선납"
          const noteMatch = prepayPayment.note.match(
            /(\d{4})년\s*(\d+)월\s*(\d+)개월 선납/
          );
          if (noteMatch) {
            const [, noteYear, noteMonth, monthsCount] = noteMatch;
            const startMonthNum = parseInt(noteMonth, 10);
            const count = parseInt(monthsCount, 10);

            // 현재 월이 선납 범위 안에 있는지 확인
            if (
              parseInt(noteYear, 10) === year &&
              currentMonthNum >= startMonthNum &&
              currentMonthNum < startMonthNum + count
            ) {
              // 선납 정보를 복사해서 현재 월 정보로 반환
              return {
                ...prepayPayment,
                month: month,
                payment_date: `${month}-01`,
                amount: 5000, // 각 월별로 5000원 표시
              };
            }
          }
        }
      }
    }

    return null;
  };

  // YYYY-MM 다음 달 계산
  const getNextMonth = (monthStr) => {
    try {
      const [y, m] = monthStr.split('-').map((v) => parseInt(v, 10));
      const next = new Date(y, m, 1); // JS month는 0-11이므로 m 그대로 넣으면 +1달 효과
      const ny = next.getFullYear();
      const nm = String(next.getMonth() + 1).padStart(2, '0');
      return `${ny}-${nm}`;
    } catch (e) {
      return monthStr;
    }
  };

  // 선입 임시 납입 생성 (연속 월, 중복/기존 납입 건너뛰기)
  const handlePrepay = (
    memberId,
    startMonth,
    monthsCount,
    amountPerMonth = 5000,
    status = 'paid'
  ) => {
    let monthCursor = startMonth;
    const toAdd = [];

    // 모든 선납에 그룹 ID 생성 (통합 저장용)
    const prepayGroupId = `prepay_${memberId}_${startMonth}_${monthsCount}_${Date.now()}`;

    for (let i = 0; i < monthsCount; i++) {
      const exists = getPaymentStatus(memberId, monthCursor, 'monthly');
      const alreadyTemp = tempNewPayments.find(
        (p) =>
          p.member_id === memberId &&
          p.month === monthCursor &&
          p.payment_type === 'monthly'
      );
      if (!exists && !alreadyTemp) {
        const tempId = `temp_${memberId}_${monthCursor}_${Date.now()}_${i}`;
        const isPaid = status === 'paid';
        const isExempt = status === 'exempt';

        // 월별 납입 현황에서는 항상 정상 금액으로 표시 (5000원)
        // 저장 시에만 1월 할인을 적용
        toAdd.push({
          id: tempId,
          member_id: memberId,
          month: monthCursor,
          payment_type: 'monthly',
          amount: amountPerMonth, // 표시용으로는 항상 정상 금액
          is_paid: isPaid,
          is_exempt: isExempt,
          member_name: members.find((m) => m.id === memberId)?.name || '',
          // 1월에 12개월 선납인 경우 그룹 ID
          prepayGroupId: prepayGroupId,
        });
      }
      monthCursor = getNextMonth(monthCursor);
    }

    if (toAdd.length > 0) {
      setTempNewPayments((prev) => [...prev, ...toAdd]);
    }
    setPrepayTarget(null);
    setShowPrepayModal(false);
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
    // paymentId를 문자열과 숫자 모두 확인
    const idStr = String(paymentId);
    const idNum =
      typeof paymentId === 'string' ? parseInt(paymentId, 10) : paymentId;

    if (tempExemptStates[paymentId] !== undefined) {
      return tempExemptStates[paymentId];
    }
    if (tempExemptStates[idStr] !== undefined) {
      return tempExemptStates[idStr];
    }
    if (tempExemptStates[idNum] !== undefined) {
      return tempExemptStates[idNum];
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

      // 상태 순환: 납입완료 → 면제 → 미납 → 삭제
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
    // 삭제 예정인 경우 먼저 처리
    // paymentId를 숫자로 통일하여 비교
    const id =
      typeof paymentId === 'string' ? parseInt(paymentId, 10) : paymentId;
    const isInDeleteList = tempDeletePayments.some((pId) => {
      const pIdNum = typeof pId === 'string' ? parseInt(pId, 10) : pId;
      return pIdNum === id;
    });

    if (isInDeleteList) {
      // 삭제 예정 상태(초기화)에서 클릭 → 납입완료로 전환 (순환 완성)
      // 초기화(+) → 납입완료(✓) → 면제 → 미납(✗) → 초기화(+) → ...
      // 원래 상태와 관계없이 항상 납입완료로 전환하여 순환 완성
      setTempExemptStates((prev) => {
        const newExempt = { ...prev };
        delete newExempt[id];
        delete newExempt[String(id)];
        return newExempt;
      });
      setTempPaymentStates((prev) => ({
        ...prev,
        [id]: true,
      }));
      setTempDeletePayments((prev) =>
        prev.filter((pId) => {
          const pIdNum = typeof pId === 'string' ? parseInt(pId, 10) : pId;
          return pIdNum !== id;
        })
      );
      return;
    }

    // 현재 상태 확인 (임시 상태가 있으면 그것을 사용, 없으면 원본 상태 사용)
    const currentIsPaid = getTempPaymentState(paymentId, payment.is_paid);
    const currentIsExempt = getTempExemptState(paymentId, payment.is_exempt);

    // 상태 순환: 납입완료(✓) → 면제 → 미납(✗) → 초기화(삭제) → 납입완료(✓) → ...

    // 1. 납입완료 상태인 경우 → 면제로 변경 (면제보다 먼저 확인)
    if (currentIsPaid === true && currentIsExempt !== true) {
      // 면제로 설정하고 납입 완료 해제
      // paymentId를 숫자로 통일하여 저장
      const paidId =
        typeof paymentId === 'string' ? parseInt(paymentId, 10) : paymentId;
      setTempExemptStates((prev) => ({
        ...prev,
        [paidId]: true,
      }));
      setTempPaymentStates((prev) => ({
        ...prev,
        [paidId]: false,
      }));
      // 삭제 목록에서 제거 (이미 삭제 예정이었던 경우 취소)
      setTempDeletePayments((prev) =>
        prev.filter((pId) => {
          const pIdNum = typeof pId === 'string' ? parseInt(pId, 10) : pId;
          return pIdNum !== paidId;
        })
      );
      return;
    }

    // 2. 면제 상태인 경우 → 미납(x)으로 변경
    if (currentIsExempt === true) {
      // 면제 해제하고 미납으로 설정
      // paymentId를 숫자로 통일하여 저장
      const id =
        typeof paymentId === 'string' ? parseInt(paymentId, 10) : paymentId;
      setTempExemptStates((prev) => ({
        ...prev,
        [id]: false,
      }));
      setTempPaymentStates((prev) => ({
        ...prev,
        [id]: false,
      }));
      // 삭제 목록에서 제거 (이미 삭제 예정이었던 경우 취소)
      setTempDeletePayments((prev) =>
        prev.filter((pId) => {
          const pIdNum = typeof pId === 'string' ? parseInt(pId, 10) : pId;
          return pIdNum !== id;
        })
      );
      return;
    }

    // 3. 미납 상태인 경우 → 초기화(삭제)로 변경
    // 삭제 목록에 추가
    // paymentId를 숫자로 통일하여 저장
    const unpaidId =
      typeof paymentId === 'string' ? parseInt(paymentId, 10) : paymentId;
    setTempDeletePayments((prev) => {
      // 이미 존재하는지 확인 (중복 방지)
      const exists = prev.some((pId) => {
        const pIdNum = typeof pId === 'string' ? parseInt(pId, 10) : pId;
        return pIdNum === unpaidId;
      });
      if (exists) return prev;
      return [...prev, unpaidId];
    });
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
      // 모든 선납을 하나의 레코드로 통합 저장
      const prepayGroups = {};
      const otherPayments = [];

      tempNewPayments.forEach((tempPayment) => {
        if (tempPayment.prepayGroupId) {
          // 선납인 경우 그룹화
          const groupId = tempPayment.prepayGroupId;
          if (!prepayGroups[groupId]) {
            prepayGroups[groupId] = {
              member_id: tempPayment.member_id,
              payment_type: tempPayment.payment_type,
              months: [],
              is_paid: tempPayment.is_paid,
              is_exempt: tempPayment.is_exempt || false,
            };
          }
          prepayGroups[groupId].months.push(tempPayment.month);
        } else {
          otherPayments.push(tempPayment);
        }
      });

      // 선납 그룹을 하나의 레코드로 저장
      const prepayGroupPayments = Object.values(prepayGroups).map((group) => {
        const sortedMonths = group.months.sort();
        const firstMonth = sortedMonths[0]; // 시작 월
        const monthsCount = sortedMonths.length;
        const isJanuary12Months =
          firstMonth.endsWith('-01') && monthsCount === 12;

        // 1월에 12개월 선납인 경우만 할인 적용, 나머지는 총합
        const totalAmount = isJanuary12Months
          ? monthsCount * 5000 - 5000 // 할인 적용
          : monthsCount * 5000; // 할인 없음

        // 첫 번째 월의 payment_date 사용
        const paymentDate = `${firstMonth}-01`;

        // 월 표시 형식: "2025-01" -> "2025년 1월"
        const [year, month] = firstMonth.split('-');
        const monthNum = parseInt(month, 10);
        const monthDisplay = `${year}년 ${monthNum}월`;

        // 1개월인 경우 선납 표시 없음, 2개월 이상인 경우만 선납 표시
        const note =
          monthsCount === 1 ? '' : `${monthDisplay} ${monthsCount}개월 선납`;

        return paymentAPI.addPayment({
          member_id: group.member_id,
          payment_type: group.payment_type,
          amount: totalAmount,
          payment_date: paymentDate,
          is_paid: group.is_paid,
          is_exempt: group.is_exempt || false,
          note: note,
        });
      });

      // 나머지 납입들 저장 (개별 납입)
      const otherNewPayments = otherPayments.map((tempPayment) => {
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
      });

      const newPayments = await Promise.all([
        ...prepayGroupPayments,
        ...otherNewPayments,
      ]);

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
    // paymentId를 문자열과 숫자 모두 확인
    const idStr = String(paymentId);
    const idNum =
      typeof paymentId === 'string' ? parseInt(paymentId, 10) : paymentId;

    if (tempPaymentStates[paymentId] !== undefined) {
      return tempPaymentStates[paymentId];
    }
    if (tempPaymentStates[idStr] !== undefined) {
      return tempPaymentStates[idStr];
    }
    if (tempPaymentStates[idNum] !== undefined) {
      return tempPaymentStates[idNum];
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

      {/* 상단 대시보드: 잔액/월별 적립·소비 및 그래프 */}
      <div className="payments-section">
        <div className="section-card balance-dashboard">
          <div className="balance-top">
            <div className="balance-summary">
              <div className="balance-row">
                <span className="label">현재 잔액</span>
                <span className="value">{formatNumber(currentBalance)}원</span>
              </div>
              {(() => {
                const today = new Date();
                const cy = today.getFullYear();
                const cm = today.getMonth() + 1;
                const ym = `${cy}-${String(cm).padStart(2, '0')}`;

                // 현재 월의 장부 항목에서 적립/소비 계산
                const currentMonthItems = ledgerItems.filter((item) => {
                  const date = new Date(item.event_date);
                  const year = date.getFullYear();
                  const month = date.getMonth() + 1;
                  const itemMonthKey = `${year}-${String(month).padStart(
                    2,
                    '0'
                  )}`;
                  return itemMonthKey === ym;
                });

                const income = currentMonthItems
                  .filter((item) => item.entry_type === 'credit')
                  .reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);

                const expense = currentMonthItems
                  .filter((item) => item.entry_type === 'debit')
                  .reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);

                const net = income - expense;
                return (
                  <div className="balance-month">
                    <div className="item">
                      <span className="label">이번달 적립</span>
                      <span className="value plus">
                        {formatNumber(income)}원
                      </span>
                    </div>
                    <div className="item">
                      <span className="label">이번달 소비</span>
                      <span className="value minus">
                        {formatNumber(expense)}원
                      </span>
                    </div>
                    <div className="item">
                      <span className="label">순증감</span>
                      <span className={`value ${net >= 0 ? 'plus' : 'minus'}`}>
                        {formatNumber(net)}원
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="balance-chart">
              {ledgerLoading || balanceSeries.labels.length === 0 ? (
                <div className="chart-loading">그래프 준비 중...</div>
              ) : (
                <Line
                  data={{
                    labels: balanceSeries.labels,
                    datasets: [
                      {
                        label: '잔액',
                        data: balanceSeries.data,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.15)',
                        tension: 0.3,
                        fill: true,
                        pointRadius: 2,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false } },
                      y: {
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: {
                          stepSize: 100000, // 10만원 단위
                          callback: function (value) {
                            return (value / 10000).toFixed(0) + '만';
                          },
                        },
                      },
                    },
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 장부 관리(수기 조정) */}
      {isAdmin && (
        <div className="payments-section">
          <div className="section-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <h3 className="section-title">장부 관리</h3>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <label
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  월별 보기:
                </label>
                <select
                  value={selectedLedgerMonth}
                  onChange={(e) => {
                    setSelectedLedgerMonth(e.target.value);
                    setDisplayedLedgerCount(10); // 월 변경 시 목록 초기화
                  }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--toss-gray-300)',
                    borderRadius: 'var(--toss-radius)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    maxWidth: '150px',
                    minWidth: '100px',
                  }}
                >
                  <option value="">전체</option>
                  {(() => {
                    // 장부 항목에서 고유한 월 목록 추출
                    const months = new Set();
                    ledgerItems.forEach((item) => {
                      if (item.event_date) {
                        const date = new Date(item.event_date);
                        const monthKey = `${date.getFullYear()}-${String(
                          date.getMonth() + 1
                        ).padStart(2, '0')}`;
                        months.add(monthKey);
                      }
                    });
                    return Array.from(months).sort().reverse(); // 최신순
                  })().map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <form className="payment-form" onSubmit={handleLedgerSubmit}>
              <div className="form-row">
                <div className="form-group" style={{ flex: '0 0 140px' }}>
                  <label>날짜</label>
                  <input
                    type="date"
                    value={ledgerForm.event_date}
                    onChange={(e) =>
                      setLedgerForm({
                        ...ledgerForm,
                        event_date: e.target.value,
                      })
                    }
                    disabled={ledgerLoading}
                  />
                </div>
                <div className="form-group" style={{ flex: '0 0 130px' }}>
                  <label>유형</label>
                  <select
                    value={ledgerForm.entry_type}
                    onChange={(e) =>
                      setLedgerForm({
                        ...ledgerForm,
                        entry_type: e.target.value,
                      })
                    }
                    disabled={ledgerLoading}
                  >
                    <option value="credit">입금(credit)</option>
                    <option value="debit">출금(debit)</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: '0 0 120px' }}>
                  <label>금액</label>
                  <input
                    type="number"
                    step="500"
                    value={ledgerForm.amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      // 숫자, -, 빈 문자열만 허용
                      if (
                        value === '' ||
                        value === '-' ||
                        /^-?\d*$/.test(value)
                      ) {
                        setLedgerForm({ ...ledgerForm, amount: value });
                        prevAmountRef.current = value;
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

                      // ArrowUp/Down은 커스텀 처리
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const currentValue =
                          parseInt(ledgerForm.amount, 10) || 0;
                        const prevValue = prevAmountRef.current
                          ? parseInt(prevAmountRef.current, 10)
                          : null;
                        const increment =
                          prevValue === null || prevValue === currentValue
                            ? 1
                            : 500;
                        const newValue = currentValue + increment;
                        setLedgerForm({
                          ...ledgerForm,
                          amount: newValue.toString(),
                        });
                        prevAmountRef.current = newValue.toString();
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const currentValue =
                          parseInt(ledgerForm.amount, 10) || 0;
                        const prevValue = prevAmountRef.current
                          ? parseInt(prevAmountRef.current, 10)
                          : null;
                        const increment =
                          prevValue === null || prevValue === currentValue
                            ? 1
                            : 500;
                        const newValue = currentValue - increment;
                        setLedgerForm({
                          ...ledgerForm,
                          amount: newValue.toString(),
                        });
                        prevAmountRef.current = newValue.toString();
                      }

                      // 숫자, -, 백스페이스, 삭제, 화살표 키만 허용
                      if (
                        !/[\d-]/.test(e.key) &&
                        !allowedKeys.includes(e.key)
                      ) {
                        e.preventDefault();
                      }
                    }}
                    onBlur={() => {
                      // 포커스를 잃을 때 이전 값 추적 리셋 (다음 스피너 조작 시 첫 번째로 인식)
                      prevAmountRef.current = null;
                    }}
                    disabled={ledgerLoading}
                  />
                </div>
                <div className="form-group" style={{ flex: '1 1 150px' }}>
                  <label>비고</label>
                  <input
                    type="text"
                    value={ledgerForm.note}
                    onChange={(e) =>
                      setLedgerForm({ ...ledgerForm, note: e.target.value })
                    }
                    disabled={ledgerLoading}
                    placeholder="메모"
                  />
                </div>
                <div
                  className="form-group"
                  style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}
                >
                  <label>&nbsp;</label>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={ledgerLoading}
                  >
                    {ledgerLoading ? '저장 중...' : '추가'}
                  </button>
                </div>
              </div>
            </form>

            <div className="payments-table" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>유형</th>
                    <th>금액</th>
                    <th>출처</th>
                    <th>회원</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerLoading ? (
                    <tr>
                      <td colSpan="6" className="no-data">
                        불러오는 중...
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      // 납입 내역과 동일하게 연속된 개월 납입 처리
                      const processedLedgerItems = [];
                      const hiddenLedgerIds = new Set();

                      // 모든 납입 내역을 payment_id로 매핑 (월회비 + 정기전 게임비)
                      const paymentsByPaymentId = {};
                      payments
                        .filter((p) => p.is_paid && !p.is_exempt)
                        .forEach((payment) => {
                          paymentsByPaymentId[payment.id] = payment;
                        });

                      // 월회비 관련 장부 항목만 처리 (payment_id가 있고 source가 'monthly')
                      const monthlyLedgerItems = ledgerItems.filter(
                        (item) =>
                          item.payment_id &&
                          item.source === 'monthly' &&
                          item.entry_type === 'credit'
                      );
                      const otherLedgerItems = ledgerItems.filter(
                        (item) =>
                          !item.payment_id ||
                          item.source !== 'monthly' ||
                          item.entry_type !== 'credit'
                      );

                      // 선납과 일반 납입 분리
                      const prepayLedgerItems = [];
                      const regularLedgerItems = [];

                      monthlyLedgerItems.forEach((ledgerItem) => {
                        const payment =
                          paymentsByPaymentId[ledgerItem.payment_id];
                        if (!payment) return;

                        if (payment.note?.includes('개월 선납')) {
                          // 선납은 그대로 추가 (이미 하나의 레코드로 저장됨)
                          prepayLedgerItems.push(ledgerItem);
                        } else {
                          regularLedgerItems.push({ ledgerItem, payment });
                        }
                      });

                      // 선납은 그대로 추가
                      processedLedgerItems.push(...prepayLedgerItems);

                      // 일반 납입도 각각 개별적으로 표시 (날짜별로 입금될 때마다 표시)
                      regularLedgerItems.forEach(({ ledgerItem }) => {
                        processedLedgerItems.push(ledgerItem);
                      });

                      // 최종 목록: 처리된 월회비 장부 항목 + 기타 장부 항목
                      // DB에서 가져온 실제 장부 항목만 사용 (하드코딩된 항목 제거)
                      let finalLedgerItems = [
                        ...processedLedgerItems,
                        ...otherLedgerItems,
                      ].filter((item) => !hiddenLedgerIds.has(item.id));

                      // 10월 31일 이후 기록만 표시 (2024-10-31 포함)
                      finalLedgerItems = finalLedgerItems.filter((item) => {
                        if (!item.event_date) return false;
                        // 날짜 문자열 비교 (YYYY-MM-DD 형식)
                        return item.event_date >= '2024-10-31';
                      });

                      // 월별 필터 적용
                      if (selectedLedgerMonth) {
                        finalLedgerItems = finalLedgerItems.filter((item) => {
                          if (!item.event_date) return false;
                          const date = new Date(item.event_date);
                          const monthKey = `${date.getFullYear()}-${String(
                            date.getMonth() + 1
                          ).padStart(2, '0')}`;
                          return monthKey === selectedLedgerMonth;
                        });
                      }

                      // 최근 날짜순으로 정렬 (내림차순)
                      finalLedgerItems.sort((a, b) =>
                        b.event_date.localeCompare(a.event_date)
                      );

                      if (finalLedgerItems.length === 0) {
                        return (
                          <tr>
                            <td colSpan="6" className="no-data">
                              장부 항목이 없습니다.
                            </td>
                          </tr>
                        );
                      }

                      // 출처를 한글로 변환하는 함수
                      const formatSource = (source) => {
                        if (source === 'monthly') return '월회비';
                        if (source === 'game') return '정기전 게임비';
                        if (source === 'manual') return '수기';
                        return source || '-';
                      };

                      // 표시할 항목 (10개씩)
                      const displayedItems = finalLedgerItems.slice(
                        0,
                        displayedLedgerCount
                      );
                      const hasMore =
                        finalLedgerItems.length > displayedLedgerCount;

                      return (
                        <>
                          {displayedItems.map((item) => {
                            const payment =
                              paymentsByPaymentId[item.payment_id];
                            const memberName = payment
                              ? payment.member_name
                              : '-';

                            return (
                              <tr key={item.id}>
                                <td>{item.event_date}</td>
                                <td>
                                  {item.entry_type === 'credit'
                                    ? '입금'
                                    : '출금'}
                                </td>
                                <td>{formatNumber(item.amount)}원</td>
                                <td>{formatSource(item.source)}</td>
                                <td>{memberName}</td>
                                <td>{item.note || '-'}</td>
                              </tr>
                            );
                          })}
                          {hasMore && (
                            <tr>
                              <td
                                colSpan="6"
                                style={{ textAlign: 'center', padding: '1rem' }}
                              >
                                <button
                                  type="button"
                                  className="btn-more"
                                  onClick={() =>
                                    setDisplayedLedgerCount(
                                      displayedLedgerCount + 10
                                    )
                                  }
                                >
                                  더보기 (
                                  {finalLedgerItems.length -
                                    displayedLedgerCount}
                                  개 더)
                                </button>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
          {/* 일괄 저장 버튼 - 월별 납입 현황 섹션 아래로 이동 */}

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
            <h3 className="section-title">월회비 납입 현황</h3>
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
                        // 실제 납입 데이터 확인
                        const paymentStatus = getPaymentStatus(
                          member.id,
                          month,
                          'monthly'
                        );

                        // 면제 상태를 먼저 확인하는 로직 제거
                        // 아래에서 납입완료 상태를 먼저 확인한 후 면제 상태를 확인하도록 변경

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
                                // 클릭 시 원래 상태로 복귀
                                // paymentId 타입을 일관되게 확인
                                const checkId =
                                  typeof paymentId === 'string'
                                    ? parseInt(paymentId, 10)
                                    : paymentId;
                                const isInDeleteList = tempDeletePayments.some(
                                  (pId) => {
                                    const pIdNum =
                                      typeof pId === 'string'
                                        ? parseInt(pId, 10)
                                        : pId;
                                    return pIdNum === checkId;
                                  }
                                );

                                if (isInDeleteList) {
                                  return (
                                    <button
                                      className="btn btn-xs btn-add"
                                      onClick={() =>
                                        togglePaymentCycle(payment)
                                      }
                                      disabled={submitting}
                                      title="클릭하여 원래 상태로 복귀"
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
                                  // 임시 상태를 가져올 때 getTempPaymentState 함수 사용 (타입 일관성)
                                  isPaid = getTempPaymentState(
                                    paymentId,
                                    payment.is_paid
                                  );
                                  // 면제 상태는 원본 또는 임시 상태 확인
                                  isExempt = getTempExemptState(
                                    paymentId,
                                    payment.is_exempt
                                  );
                                }

                                // 납입 완료 상태 (면제보다 먼저 확인)
                                if (isPaid === true) {
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

                                // 면제 상태 (납입완료가 아닐 때만)
                                if (isExempt === true) {
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

                                // 임시 납입인 경우 미납 상태로 바로 표시
                                if (isTemp && !isPaid && !isExempt) {
                                  return (
                                    <button
                                      className="payment-status unpaid"
                                      title="클릭하여 삭제"
                                      onClick={() =>
                                        togglePaymentCycle(payment)
                                      }
                                      disabled={submitting}
                                    >
                                      ✗
                                    </button>
                                  );
                                }

                                // 면제가 해제된 경우 (is_exempt = false, is_paid = false)는 빈 상태로 표시
                                // 원본 payment의 is_exempt가 false이고, 임시 상태 변경도 없는 경우
                                // 단, 임시 납입이 아니고, 저장된 납입이 아닌 경우에만 적용
                                // (저장된 납입은 미납 상태로 표시해야 함)
                                if (!isTemp) {
                                  const originalIsExempt =
                                    payment.is_exempt === false;
                                  const noTempExemptChange =
                                    getTempExemptState(
                                      paymentId,
                                      payment.is_exempt
                                    ) === payment.is_exempt;

                                  // 저장된 납입인지 확인 (임시 ID가 아닌 경우)
                                  const isStoredPayment = !paymentId
                                    .toString()
                                    .startsWith('temp_');

                                  // 저장되지 않은 경우에만 빈 상태로 표시
                                  // 저장된 미납 납입은 X 표시를 해야 함
                                  if (
                                    !isStoredPayment &&
                                    originalIsExempt &&
                                    noTempExemptChange &&
                                    !isPaid
                                  ) {
                                    // 빈 상태로 표시 (납입 내역이 없는 것처럼)
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
                                }

                                // 미납 상태 (저장된 납입 또는 임시 납입)
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
                                onClick={() => {
                                  setPrepayMonths(1);
                                  setPrepayStatus('paid');
                                  setPrepayTarget({
                                    memberId: member.id,
                                    month,
                                  });
                                  setShowPrepayModal(true);
                                }}
                                disabled={submitting}
                                title="선입 추가"
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

          {/* 월별 납입 현황 저장 버튼 */}
          {hasTempChanges && (
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
          )}

          {/* 정기전 게임비 관리 섹션 */}
          {isAdmin && (
            <div className="section-card">
              <div className="game-payment-header">
                <h3 className="section-title">정기전 게임비 관리</h3>
                <button
                  className="btn btn-primary"
                  onClick={openGamePaymentModal}
                >
                  정기전 게임비 관리
                </button>
              </div>

              {/* 날짜별 정기전 게임비 내역 */}
              <div className="payments-table">
                {(() => {
                  // 정기전 게임비만 필터링 (미납 포함, 면제 제외)
                  const gamePayments = payments.filter(
                    (p) => p.payment_type === 'game' && !p.is_exempt
                  );

                  // 날짜별로 그룹화
                  const paymentsByDate = {};
                  gamePayments.forEach((payment) => {
                    const date = payment.payment_date;
                    if (!paymentsByDate[date]) {
                      paymentsByDate[date] = [];
                    }
                    paymentsByDate[date].push(payment);
                  });

                  // 날짜순 정렬 (최신순)
                  const sortedDates = Object.keys(paymentsByDate).sort(
                    (a, b) => new Date(b) - new Date(a)
                  );

                  if (sortedDates.length === 0) {
                    return (
                      <div
                        style={{
                          padding: '1rem',
                          textAlign: 'center',
                          color: '#666',
                        }}
                      >
                        등록된 정기전 게임비 내역이 없습니다.
                      </div>
                    );
                  }

                  return (
                    <div className="game-payment-cards-container">
                      {sortedDates.map((date) => {
                        const datePayments = paymentsByDate[date];
                        // 회원명으로 정렬
                        const sortedPayments = [...datePayments].sort((a, b) =>
                          a.member_name.localeCompare(b.member_name)
                        );

                        return (
                          <div key={date} className="game-payment-date-section">
                            <h4 className="game-payment-date-title">{date}</h4>
                            <div className="game-payment-cards-grid">
                              {sortedPayments.map((payment) => {
                                // 임시 상태가 있으면 임시 상태 사용, 없으면 원본 상태 사용
                                const tempState =
                                  tempGamePaymentStates[payment.id];
                                const currentState = tempState || {
                                  is_paid: payment.is_paid,
                                  paid_with_points:
                                    payment.paid_with_points || false,
                                };

                                // 납입 상태 결정
                                let statusText = '';
                                let statusClass = '';
                                let cardClass = '';
                                if (currentState.paid_with_points) {
                                  statusText = '포인트납부';
                                  statusClass = 'status-point';
                                  cardClass = 'game-payment-card point';
                                } else if (currentState.is_paid) {
                                  statusText = '납입';
                                  statusClass = 'status-paid';
                                  cardClass = 'game-payment-card paid';
                                } else {
                                  statusText = '미납';
                                  statusClass = 'status-unpaid';
                                  cardClass = 'game-payment-card unpaid';
                                }

                                return (
                                  <div
                                    key={payment.id}
                                    className={cardClass}
                                    onClick={() =>
                                      toggleGamePaymentCard(payment)
                                    }
                                    style={{
                                      cursor: 'pointer',
                                      padding: '0.75rem',
                                      borderRadius: '8px',
                                      border: '1px solid #e0e0e0',
                                      backgroundColor: '#fff',
                                      transition: 'all 0.2s',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '0.5rem',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform =
                                        'translateY(-2px)';
                                      e.currentTarget.style.boxShadow =
                                        '0 4px 8px rgba(0,0,0,0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform =
                                        'translateY(0)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        textAlign: 'center',
                                      }}
                                    >
                                      {payment.member_name}
                                    </div>
                                    <div
                                      className={statusClass}
                                      style={{
                                        fontSize: '0.75rem',
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '12px',
                                        backgroundColor:
                                          currentState.paid_with_points
                                            ? 'rgba(59, 130, 246, 0.1)'
                                            : currentState.is_paid
                                            ? 'rgba(16, 185, 129, 0.1)'
                                            : 'rgba(239, 68, 68, 0.1)',
                                      }}
                                    >
                                      {statusText}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* 일괄 저장 버튼 */}
              {Object.keys(tempGamePaymentStates).length > 0 && (
                <div className="section-card" style={{ marginTop: '1rem' }}>
                  <div className="batch-actions-content">
                    <span className="batch-info">
                      {Object.keys(tempGamePaymentStates).length}개의 변경사항이
                      있습니다.
                    </span>
                    <div className="batch-buttons">
                      <button
                        className="btn btn-secondary"
                        onClick={cancelGamePaymentCardStates}
                        disabled={submitting}
                      >
                        취소
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={saveGamePaymentCardStates}
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
              )}
            </div>
          )}
        </div>
      )}

      {/* 목록 형식 뷰 */}
      {viewMode === 'list' && (
        <div className="payments-section">
          <div className="section-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <h3 className="section-title" style={{ marginBottom: 0 }}>
                납입 내역
              </h3>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <label
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  월별 보기:
                </label>
                <select
                  value={selectedPaymentMonth}
                  onChange={(e) => {
                    setSelectedPaymentMonth(e.target.value);
                    setDisplayedPaymentCount(10);
                  }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--toss-gray-300)',
                    borderRadius: 'var(--toss-radius)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    maxWidth: '150px',
                    minWidth: '100px',
                  }}
                >
                  <option value="">전체</option>
                  {(() => {
                    // 납입 완료이고 면제가 아닌 내역이 존재하는 달만 표시
                    const months = new Set();
                    payments
                      .filter(
                        (p) => p.is_paid && !p.is_exempt && p.payment_date
                      )
                      .forEach((p) => {
                        const d = new Date(p.payment_date);
                        const key = `${d.getFullYear()}-${String(
                          d.getMonth() + 1
                        ).padStart(2, '0')}`;
                        months.add(key);
                      });
                    return Array.from(months).sort().reverse();
                  })().map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
                  {(() => {
                    // 면제 상태 및 미납 상태인 납입 내역은 목록에서 제외 (납입 완료된 항목만 표시)
                    let filteredPayments = payments.filter(
                      (p) => !p.is_exempt && p.is_paid
                    );

                    // 같은 회원의 연속된 개월 납입을 그룹화
                    const processedPayments = [];
                    const hiddenPaymentIds = new Set();

                    // 월회비만 처리 (정기전 게임비는 그대로)
                    const monthlyPayments = filteredPayments.filter(
                      (p) => p.payment_type === 'monthly'
                    );
                    const nonMonthlyPayments = filteredPayments.filter(
                      (p) => p.payment_type !== 'monthly'
                    );

                    // 선납과 일반 납입 분리
                    const prepayPayments = monthlyPayments.filter((p) =>
                      p.note?.includes('개월 선납')
                    );
                    const regularPayments = monthlyPayments.filter(
                      (p) => !p.note?.includes('개월 선납')
                    );

                    // 선납은 그대로 추가 (이미 하나의 레코드로 저장됨)
                    processedPayments.push(...prepayPayments);

                    // 회원별로 그룹화 (일반 납입만)
                    const groupedByMember = {};
                    regularPayments.forEach((payment) => {
                      const key = payment.member_id;
                      if (!groupedByMember[key]) {
                        groupedByMember[key] = [];
                      }
                      groupedByMember[key].push(payment);
                    });

                    // 각 회원별로 연속된 개월 납입 찾기 (일반 납입만)
                    Object.keys(groupedByMember).forEach((memberId) => {
                      const memberPayments = groupedByMember[memberId];

                      // 날짜로 정렬
                      memberPayments.sort((a, b) =>
                        a.payment_date.localeCompare(b.payment_date)
                      );

                      // 연속된 개월 납입 그룹 찾기
                      let i = 0;
                      while (i < memberPayments.length) {
                        const consecutiveGroup = [memberPayments[i]];
                        let j = i + 1;

                        // 연속된 개월인지 확인하며 그룹 만들기
                        while (j < memberPayments.length) {
                          const prevDate = new Date(
                            consecutiveGroup[
                              consecutiveGroup.length - 1
                            ].payment_date
                          );
                          const currDate = new Date(
                            memberPayments[j].payment_date
                          );

                          // 예상 다음 달 계산
                          const expectedDate = new Date(prevDate);
                          expectedDate.setMonth(expectedDate.getMonth() + 1);

                          // 실제 날짜가 예상 날짜와 같은 달인지 확인
                          if (
                            expectedDate.getFullYear() ===
                              currDate.getFullYear() &&
                            expectedDate.getMonth() === currDate.getMonth()
                          ) {
                            consecutiveGroup.push(memberPayments[j]);
                            j++;
                          } else {
                            break;
                          }
                        }

                        if (consecutiveGroup.length > 1) {
                          // 연속된 개월이 2개 이상인 경우 첫 달에 금액 합산
                          const firstPayment = { ...consecutiveGroup[0] };
                          firstPayment.amount = consecutiveGroup.reduce(
                            (sum, p) => sum + (parseInt(p.amount) || 0),
                            0
                          );
                          processedPayments.push(firstPayment);

                          // 나머지 달 납입은 숨기기
                          for (let k = 1; k < consecutiveGroup.length; k++) {
                            hiddenPaymentIds.add(consecutiveGroup[k].id);
                          }
                        } else {
                          // 연속이 아니면 그대로 추가
                          processedPayments.push(consecutiveGroup[0]);
                        }

                        i = j;
                      }
                    });

                    // 최종 목록: 처리된 월회비 + 정기전 게임비
                    let finalPayments = [
                      ...processedPayments,
                      ...nonMonthlyPayments,
                    ].filter((p) => !hiddenPaymentIds.has(p.id));

                    // 월별 필터 적용 (선택 시 해당 월만 표시)
                    if (selectedPaymentMonth) {
                      finalPayments = finalPayments.filter((p) => {
                        const d = new Date(p.payment_date);
                        const key = `${d.getFullYear()}-${String(
                          d.getMonth() + 1
                        ).padStart(2, '0')}`;
                        return key === selectedPaymentMonth;
                      });
                    }

                    // 날짜 최신순 정렬 (내림차순)
                    finalPayments.sort((a, b) => {
                      const dateA = new Date(a.payment_date);
                      const dateB = new Date(b.payment_date);
                      return dateB - dateA; // 최신이 위로
                    });

                    const totalPayments = finalPayments.length;
                    const visiblePayments = finalPayments.slice(
                      0,
                      displayedPaymentCount
                    );
                    const hasMore = totalPayments > displayedPaymentCount;

                    return (
                      <>
                        {totalPayments === 0 ? (
                          <tr>
                            <td colSpan={isAdmin ? 7 : 6} className="no-data">
                              납입 내역이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {visiblePayments.map((payment) => (
                              <tr key={payment.id}>
                                <td>
                                  {inlineEditId === payment.id ? (
                                    <input
                                      type="date"
                                      value={inlineForm.payment_date}
                                      onChange={(e) =>
                                        setInlineForm({
                                          ...inlineForm,
                                          payment_date: e.target.value,
                                        })
                                      }
                                      disabled={submitting}
                                    />
                                  ) : (
                                    payment.payment_date
                                  )}
                                </td>
                                <td>{payment.member_name}</td>
                                <td>
                                  <span
                                    className={`payment-type ${payment.payment_type}`}
                                  >
                                    {formatPaymentType(payment.payment_type)}
                                  </span>
                                </td>
                                <td>
                                  {inlineEditId === payment.id ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={inlineForm.amount}
                                      onChange={(e) =>
                                        setInlineForm({
                                          ...inlineForm,
                                          amount: e.target.value,
                                        })
                                      }
                                      disabled={submitting}
                                      style={{ width: 100 }}
                                    />
                                  ) : (
                                    `${formatNumber(payment.amount)}원`
                                  )}
                                </td>
                                <td>
                                  {inlineEditId === payment.id ? (
                                    <select
                                      value={inlineForm.is_paid}
                                      onChange={(e) =>
                                        setInlineForm({
                                          ...inlineForm,
                                          is_paid: e.target.value === 'true',
                                        })
                                      }
                                      disabled={submitting}
                                    >
                                      <option value="true">완료</option>
                                      <option value="false">미납</option>
                                    </select>
                                  ) : (
                                    <span
                                      className={
                                        payment.is_paid
                                          ? 'status-paid'
                                          : 'status-unpaid'
                                      }
                                    >
                                      {payment.is_paid ? '완료' : '미납'}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {inlineEditId === payment.id ? (
                                    <input
                                      type="text"
                                      value={inlineForm.note}
                                      onChange={(e) =>
                                        setInlineForm({
                                          ...inlineForm,
                                          note: e.target.value,
                                        })
                                      }
                                      disabled={submitting}
                                      placeholder="비고"
                                    />
                                  ) : (
                                    payment.note || '-'
                                  )}
                                </td>
                                {isAdmin && (
                                  <td>
                                    {inlineEditId === payment.id ? (
                                      <div className="inline-actions">
                                        <button
                                          className="btn btn-sm btn-primary"
                                          onClick={() =>
                                            handleInlineSave(payment.id)
                                          }
                                          disabled={submitting}
                                        >
                                          완료
                                        </button>
                                        <button
                                          className="btn btn-sm btn-secondary"
                                          onClick={handleInlineCancel}
                                          disabled={submitting}
                                        >
                                          취소
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <button
                                          className="btn btn-sm btn-edit"
                                          onClick={() =>
                                            handleInlineEdit(payment)
                                          }
                                        >
                                          수정
                                        </button>
                                        <button
                                          className="btn btn-sm btn-delete"
                                          onClick={() =>
                                            handleDelete(payment.id)
                                          }
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
                                      </>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                            {hasMore && (
                              <tr>
                                <td
                                  colSpan={isAdmin ? 7 : 6}
                                  style={{
                                    textAlign: 'center',
                                    padding: '1rem',
                                  }}
                                >
                                  <button
                                    className="btn-more"
                                    onClick={() =>
                                      setDisplayedPaymentCount(
                                        (prev) => prev + 10
                                      )
                                    }
                                  >
                                    더보기 (
                                    {totalPayments - displayedPaymentCount}개
                                    더)
                                  </button>
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </>
                    );
                  })()}
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
                                memberPayment.paid_with_points
                                  ? 'btn-info'
                                  : memberPayment.is_paid
                                  ? 'btn-success'
                                  : 'btn-outline-danger'
                              }`}
                              onClick={() =>
                                toggleGamePaymentStatus(memberPayment.member_id)
                              }
                              disabled={submitting}
                            >
                              {memberPayment.paid_with_points
                                ? 'P 포인트납부'
                                : memberPayment.is_paid
                                ? '✓ 납입완료'
                                : '✗ 미납'}
                            </button>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-delete"
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
                disabled={submitting}
              >
                {submitting
                  ? '저장 중...'
                  : gamePaymentMembers.length === 0
                  ? '저장'
                  : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 선입 추가 모달 */}
      {showPrepayModal && prepayTarget && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPrepayModal(false);
              setPrepayTarget(null);
            }
          }}
        >
          <div className="modal-content prepay-modal">
            <div className="modal-header">
              <h3>선입 납입 추가</h3>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setShowPrepayModal(false);
                  setPrepayTarget(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {(() => {
                // 선택한 월부터 12월까지의 남은 개월 수 계산
                const monthStr = prepayTarget.month; // YYYY-MM 형식
                const monthNum = parseInt(monthStr.split('-')[1], 10); // MM 추출
                const maxMonths = 13 - monthNum; // 선택한 월 포함해서 12월까지
                const maxMonthsLimited = Math.max(1, Math.min(maxMonths, 12)); // 최소 1개월, 최대 12개월

                // 현재 선택된 개월 수가 최대값을 초과하면 최대값으로 조정
                const validPrepayMonths = Math.min(
                  prepayMonths,
                  maxMonthsLimited
                );
                if (prepayMonths > maxMonthsLimited) {
                  setPrepayMonths(maxMonthsLimited);
                }

                const selectedMember = members.find(
                  (m) => m.id === prepayTarget.memberId
                );

                return (
                  <>
                    <div className="form-group">
                      <label>회원</label>
                      <input
                        type="text"
                        value={selectedMember?.name || ''}
                        className="form-control"
                        disabled
                      />
                    </div>
                    <div className="form-group">
                      <label>시작 월</label>
                      <input
                        type="text"
                        value={prepayTarget.month}
                        className="form-control"
                        disabled
                      />
                    </div>
                    <div className="form-group">
                      <label>선입 개월 수</label>
                      <select
                        className="form-control"
                        value={validPrepayMonths}
                        onChange={(e) =>
                          setPrepayMonths(parseInt(e.target.value, 10))
                        }
                        disabled={submitting}
                      >
                        {Array.from(
                          { length: maxMonthsLimited },
                          (_, i) => i + 1
                        ).map((m) => (
                          <option key={m} value={m}>
                            {`${m}개월`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>상태 선택</label>
                      <select
                        className="form-control"
                        value={prepayStatus}
                        onChange={(e) => setPrepayStatus(e.target.value)}
                        disabled={submitting}
                      >
                        <option value="paid">납입</option>
                        <option value="exempt">면제</option>
                        <option value="unpaid">미납</option>
                      </select>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPrepayModal(false);
                  setPrepayTarget(null);
                }}
                disabled={submitting}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (prepayTarget) {
                    handlePrepay(
                      prepayTarget.memberId,
                      prepayTarget.month,
                      prepayMonths,
                      5000,
                      prepayStatus
                    );
                  }
                }}
                disabled={submitting}
              >
                {submitting ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
