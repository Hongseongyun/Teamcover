import React, { useState, useEffect, useMemo } from 'react';
import { memberAPI, sheetsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import api from '../services/api';
import LoadingModal from '../components/LoadingModal';
import './Members.css';

// 티어 표시 컴포넌트
const TierBadge = ({ tier, size = 'normal' }) => {
  const getTierClass = (tier) => {
    if (!tier) return 'tier-unranked';

    const tierMap = {
      배치: 'tier-unranked',
      아이언: 'tier-iron',
      브론즈: 'tier-bronze',
      실버: 'tier-silver',
      골드: 'tier-gold',
      플레티넘: 'tier-platinum',
      다이아: 'tier-diamond',
      마스터: 'tier-master',
      챌린저: 'tier-challenger',
    };

    return tierMap[tier] || 'tier-unranked';
  };

  const getDisplayTier = (tier) => {
    const tierMap = {
      배치: 'UNRANKED',
      아이언: 'IRON',
      브론즈: 'BRONZE',
      실버: 'SILVER',
      골드: 'GOLD',
      플레티넘: 'PLATINUM',
      다이아: 'DIAMOND',
      마스터: 'MASTER',
      챌린저: 'CHALLENGER',
    };
    return tierMap[tier] || 'UNRANKED';
  };

  const displayTier = getDisplayTier(tier);
  const tierClass = getTierClass(tier);
  const badgeClass =
    size === 'small' ? 'tier-badge tier-badge-sm' : 'tier-badge';

  return (
    <div className={`${badgeClass} ${tierClass}`}>
      <span>{displayTier}</span>
    </div>
  );
};

const Members = () => {
  const { user } = useAuth();
  const { currentClub, loading: clubLoading, isAdmin: clubIsAdmin } = useClub();
  const isSuperAdmin = user && user.role === 'super_admin';
  // 클럽별 운영 권한: 현재 클럽의 운영진이거나 슈퍼관리자일 때만 true
  const isAdmin = isSuperAdmin || clubIsAdmin;

  // 개인정보 보호 상태
  const [privacyUnlocked, setPrivacyUnlocked] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [privacyPassword, setPrivacyPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPasswordSetting, setShowPasswordSetting] = useState(false);
  const [newPrivacyPassword, setNewPrivacyPassword] = useState('');
  const [passwordSetStatus, setPasswordSetStatus] = useState(false);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false); // 회원 등록 중 로딩 상태
  const [deletingMemberId, setDeletingMemberId] = useState(null); // 삭제 중인 회원 ID
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    note: '',
    is_staff: false,
  });

  // 인라인 편집 상태
  const [inlineEditingId, setInlineEditingId] = useState(null);
  const [inlineEditData, setInlineEditData] = useState({
    name: '',
    phone: '',
    gender: '',
    note: '',
    is_staff: false,
    join_date: '',
  });
  const [savingInlineEdit, setSavingInlineEdit] = useState(false); // 인라인 편집 저장 중 로딩 상태
  const [openMenuId, setOpenMenuId] = useState(null); // 열려있는 메뉴 ID

  // 구글시트 가져오기 관련 상태
  const [showImportForm, setShowImportForm] = useState(false);
  const [importFormData, setImportFormData] = useState({
    spreadsheetUrl: '',
    worksheetName: '',
    confirmDelete: false,
  });

  // 정렬 상태
  const [sortField, setSortField] = useState('name'); // name, tier, join_date
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc

  // 정렬 함수
  const handleSort = (field) => {
    if (sortField === field) {
      // 같은 필드를 클릭하면 순서 변경
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // 다른 필드를 클릭하면 필드 변경하고 오름차순으로
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 정렬된 회원 목록 (메모이제이션)
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
    let valueA, valueB;

    switch (sortField) {
      case 'name':
        valueA = a.name || '';
        valueB = b.name || '';
        break;
      case 'tier':
        // 티어별 우선순위 정의
        const tierOrder = {
          챌린저: 0,
          마스터: 1,
          다이아: 2,
          다이아몬드: 2,
          플레티넘: 3,
          플래티넘: 3,
          골드: 4,
          실버: 5,
          브론즈: 6,
          아이언: 7,
          배치: 8,
          언랭크: 8,
          '': 9,
        };
        valueA = tierOrder[a.tier] !== undefined ? tierOrder[a.tier] : 9;
        valueB = tierOrder[b.tier] !== undefined ? tierOrder[b.tier] : 9;
        break;
      case 'join_date':
        valueA = a.join_date || a.created_at || '';
        valueB = b.join_date || b.created_at || '';
        break;
      default:
        return 0;
    }

    // 날짜 비교
    if (sortField === 'join_date') {
      const dateA = valueA ? new Date(valueA) : new Date(0);
      const dateB = valueB ? new Date(valueB) : new Date(0);
      if (sortOrder === 'asc') {
        return dateA - dateB;
      } else {
        return dateB - dateA;
      }
    }

    // 티어는 숫자 비교
    if (sortField === 'tier') {
      if (sortOrder === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    }

    // 문자열 비교
    if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
    });
  }, [members, sortField, sortOrder]);

  useEffect(() => {
    // 클럽이 선택될 때까지 대기 (슈퍼관리자는 클럽 선택 없이도 접근 가능)
    console.log('Members: useEffect', {
      clubLoading,
      currentClub: currentClub?.name,
      isSuperAdmin,
      shouldLoad: !clubLoading && (currentClub || isSuperAdmin),
    });

    if (!clubLoading && (currentClub || isSuperAdmin)) {
      loadMembers();
      checkPasswordStatus();
      checkPrivacyStatus();
    }
  }, [clubLoading, currentClub, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // 개인정보 보호 상태가 변경될 때마다 회원 목록 다시 로드
  useEffect(() => {
    sessionStorage.setItem('privacyUnlocked', privacyUnlocked.toString());
    if (privacyUnlocked) {
      loadMembers();
    }
  }, [privacyUnlocked]);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && !event.target.closest('.action-menu-container')) {
        // 모든 menu-active 클래스 제거
        document
          .querySelectorAll('.action-menu-container.menu-active')
          .forEach((container) => {
            container.classList.remove('menu-active');
          });
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    } else {
      // 메뉴가 닫힐 때 모든 menu-active 클래스 제거
      document
        .querySelectorAll('.action-menu-container.menu-active')
        .forEach((container) => {
          container.classList.remove('menu-active');
        });
    }
  }, [openMenuId]);

  // 드롭다운이 열릴 때 위치 재계산
  useEffect(() => {
    if (openMenuId) {
      // 마지막 두 항목인지 확인
      const sortedMembers = [...members].sort((a, b) => {
        let valueA, valueB;

        switch (sortField) {
          case 'name':
            valueA = a.name || '';
            valueB = b.name || '';
            break;
          case 'tier':
            const tierOrder = {
              배치: 0,
              아이언: 1,
              브론즈: 2,
              실버: 3,
              골드: 4,
              플레티넘: 5,
              다이아: 6,
              마스터: 7,
              챌린저: 8,
            };
            valueA = tierOrder[a.tier] ?? -1;
            valueB = tierOrder[b.tier] ?? -1;
            break;
          case 'join_date':
            valueA = a.join_date
              ? new Date(a.join_date).getTime()
              : a.created_at
              ? new Date(a.created_at).getTime()
              : 0;
            valueB = b.join_date
              ? new Date(b.join_date).getTime()
              : b.created_at
              ? new Date(b.created_at).getTime()
              : 0;
            break;
          default:
            valueA = a.name || '';
            valueB = b.name || '';
        }

        if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
      const memberIndex = sortedMembers.findIndex((m) => m.id === openMenuId);
      const isLastTwo = memberIndex >= sortedMembers.length - 2;

      // requestAnimationFrame을 사용하여 렌더링 완료 후 계산
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const container = document.querySelector(
            `.action-menu-container[data-member-id="${openMenuId}"]`
          );
          if (container) {
            const button = container.querySelector('.btn-menu-toggle');
            const dropdown = container.querySelector('.action-menu-dropdown');

            if (button && dropdown) {
              const buttonRect = button.getBoundingClientRect();
              const dropdownRect = dropdown.getBoundingClientRect();
              const viewportHeight = window.innerHeight;

              // 버튼의 화면 하단까지의 거리
              const spaceBelow = viewportHeight - buttonRect.bottom;
              // 드롭다운의 실제 높이 (여유있게 10px 추가)
              const dropdownHeight = dropdownRect.height + 10;

              // 마지막 두 항목이거나 아래 공간이 부족하면 위로 열기
              if (isLastTwo || spaceBelow < dropdownHeight) {
                container.classList.add('menu-open-up');
              } else {
                container.classList.remove('menu-open-up');
              }
            }
          }
        });
      });
    } else {
      // 메뉴가 닫힐 때 모든 컨테이너에서 클래스 제거
      document
        .querySelectorAll('.action-menu-container')
        .forEach((container) => {
          container.classList.remove('menu-open-up');
        });
    }
  }, [openMenuId, members, sortField, sortOrder]);

  // 비밀번호 설정 여부 확인
  const checkPasswordStatus = async () => {
    try {
      const response = await api.get('/api/auth/check-privacy-password-status');
      if (response.data.success) {
        setPasswordSetStatus(response.data.password_set);
      }
    } catch (error) {
      // 에러 처리
    }
  };

  // 개인정보 보호 상태 확인
  const checkPrivacyStatus = async () => {
    try {
      const response = await memberAPI.checkPrivacyStatus();
      if (response.data.success) {
        setPrivacyUnlocked(response.data.privacy_unlocked);
        // 개인정보가 잠금 해제된 경우 회원 목록 다시 로드
        if (response.data.privacy_unlocked) {
          loadMembers();
        }
      }
    } catch (error) {
      console.error('개인정보 상태 확인 오류:', error);
    }
  };

  // 개인정보 마스킹 (백엔드에서 처리하므로 프론트엔드에서는 단순 표시)
  const maskPhone = (phone) => {
    if (!phone) return '-';
    return phone;
  };

  // 개인정보 클릭 핸들러
  const handlePrivacyClick = (e) => {
    e.preventDefault();
    // 운영진이든 일반 사용자든 비밀번호 입력 모달 표시
    if (!privacyUnlocked) {
      setShowPasswordModal(true);
    }
  };

  // 비밀번호 검증
  const handleVerifyPassword = async () => {
    try {
      setPasswordError('');
      const response = await memberAPI.verifyPrivacyAccess(privacyPassword);

      if (response.data.success && response.data.privacy_token) {
        // 개인정보 접근 토큰을 localStorage에 저장
        localStorage.setItem('privacy_token', response.data.privacy_token);
        setPrivacyUnlocked(true);
        setShowPasswordModal(false);
        setPrivacyPassword('');

        // 개인정보 상태 확인 후 회원 목록 다시 로드
        await checkPrivacyStatus();
        // 토큰이 저장된 후 회원 목록 다시 로드 (토큰이 헤더에 포함되도록)
        await loadMembers();
      } else {
        setPasswordError(response.data.message);
      }
    } catch (error) {
      setPasswordError(
        error.response?.data?.message || '비밀번호 검증에 실패했습니다.'
      );
    }
  };

  // 개인정보 접근 토큰 초기화 (사용하지 않음 - 향후 필요시 사용)
  // const resetPrivacyToken = () => {
  //   localStorage.removeItem('privacy_token');
  //   setPrivacyUnlocked(false);
  // };

  // 비밀번호 설정
  const handleSetPassword = async () => {
    try {
      if (newPrivacyPassword.length < 4) {
        alert('비밀번호는 4자리 이상이어야 합니다.');
        return;
      }

      const response = await api.post('/api/auth/set-privacy-password', {
        password: newPrivacyPassword,
      });

      if (response.data.success) {
        alert(response.data.message);
        setShowPasswordSetting(false);
        setNewPrivacyPassword('');
        setPasswordSetStatus(true);
      } else {
        alert(response.data.message);
      }
    } catch (error) {
      alert(error.response?.data?.message || '비밀번호 설정에 실패했습니다.');
    }
  };

  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await memberAPI.getMembers();
      if (response.data.success) {
        setMembers(response.data.members);
        setStats(response.data.stats);
      }
    } catch (error) {
      // 에러 처리
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); // 로딩 시작

    try {
      if (editingMember) {
        await memberAPI.updateMember(editingMember.id, formData);
      } else {
        const response = await memberAPI.addMember(formData);

        if (response.data && !response.data.success) {
          alert(response.data.message || '회원 추가에 실패했습니다.');
          setSubmitting(false); // 로딩 종료
          return;
        }
      }

      alert(
        editingMember ? '회원 정보가 수정되었습니다.' : '회원이 추가되었습니다.'
      );

      setShowAddForm(false);
      setEditingMember(null);
      setFormData({
        name: '',
        phone: '',
        gender: '',
        email: '',
        note: '',
        is_staff: false,
      });
      loadMembers();
    } catch (error) {
      alert(error.response?.data?.message || '회원 저장에 실패했습니다.');
    } finally {
      setSubmitting(false); // 로딩 종료
    }
  };

  // const handleEdit = (member) => {
  //   setEditingMember(member);
  //   setFormData({
  //     name: member.name,
  //     phone: member.phone || '',
  //     gender: member.gender || '',
  //     level: member.level || '',
  //     email: member.email || '',
  //     note: member.note || '',
  //   });
  //   setShowAddForm(true);
  // };

  const handleDelete = async (id) => {
    if (window.confirm('정말로 이 회원을 삭제하시겠습니까?')) {
      setDeletingMemberId(id); // 삭제 중인 회원 ID 설정
      try {
        const response = await memberAPI.deleteMember(id);
        if (response.data && response.data.success) {
          // 삭제 성공
          await loadMembers();
        } else {
          // 삭제 실패
          alert(response.data?.message || '회원 삭제에 실패했습니다.');
        }
      } catch (error) {
        // 에러 처리
        console.error('회원 삭제 오류:', error);
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          '회원 삭제에 실패했습니다.';
        alert(errorMessage);
      } finally {
        setDeletingMemberId(null); // 로딩 종료
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      gender: '',
      note: '',
      is_staff: false,
    });
    setEditingMember(null);
    setShowAddForm(false);
  };

  // 구글시트 가져오기 섹션으로 스크롤
  const scrollToImportSection = () => {
    setShowImportForm(true);
    setTimeout(() => {
      const element = document.getElementById('sheet-import-section');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 120);
  };

  // 구글시트 가져오기
  const handleImportFromSheets = async (e) => {
    e.preventDefault();

    if (!importFormData.spreadsheetUrl.trim()) {
      alert('구글 시트 URL을 입력해주세요.');
      return;
    }

    if (!importFormData.confirmDelete) {
      alert('경고사항을 확인하고 체크박스를 선택해주세요.');
      return;
    }

    try {
      const response = await sheetsAPI.importMembers(importFormData);
      const { success, message, error_type } = response?.data || {};

      if (success) {
        alert('구글시트에서 회원을 성공적으로 가져왔습니다.');
        setShowImportForm(false);
        setImportFormData({
          spreadsheetUrl: '',
          worksheetName: '',
          confirmDelete: false,
        });
        loadMembers();
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

  // 인라인 편집 시작
  const startInlineEdit = (member) => {
    setInlineEditingId(member.id);
    setInlineEditData({
      name: member.name,
      phone: member.phone || '',
      gender: member.gender || '',
      note: member.note || '',
      is_staff: member.is_staff || false,
      join_date: member.join_date || '',
    });
  };

  // 인라인 편집 취소
  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditData({
      name: '',
      phone: '',
      gender: '',
      email: '',
      note: '',
      is_staff: false,
    });
  };

  // 인라인 편집 저장
  const saveInlineEdit = async (memberId) => {
    try {
      setSavingInlineEdit(true); // 로딩 시작
      
      // 잠금 상태이거나 마스킹 값이면 해당 필드는 전송하지 않도록 정제
      const payload = { ...inlineEditData };
      if (!privacyUnlocked || (payload.phone && payload.phone.includes('*'))) {
        delete payload.phone;
      }
      if (payload.email && payload.email.includes('***')) {
        delete payload.email;
      }

      const response = await memberAPI.updateMember(memberId, payload);

      if (response.data && !response.data.success) {
        alert(response.data.message || '회원 수정에 실패했습니다.');
        setSavingInlineEdit(false); // 로딩 종료
        return;
      }

      console.log('서버 응답:', response.data);

      // 서버 응답 데이터로 상태 갱신
      if (response.data && response.data.member) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? response.data.member : m))
        );
      } else {
        // 전체 새로고침 없이 상태 갱신
        setMembers((prev) =>
          prev.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  name: inlineEditData.name,
                  phone: inlineEditData.phone,
                  gender: inlineEditData.gender,
                  email: inlineEditData.email,
                  note: inlineEditData.note,
                  is_staff: inlineEditData.is_staff,
                }
              : m
          )
        );
      }

      alert('회원 정보가 수정되었습니다.');
      cancelInlineEdit();

      // 데이터베이스와 동기화를 위해 다시 로드
      loadMembers();
      
      setSavingInlineEdit(false); // 로딩 종료
    } catch (error) {
      setSavingInlineEdit(false); // 로딩 종료
      if (error.code === 'ERR_NETWORK') {
        alert(
          '서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.'
        );
      } else if (error.response?.status === 500) {
        alert('서버 내부 오류가 발생했습니다. 백엔드 로그를 확인해주세요.');
      } else {
        alert(error.response?.data?.message || '회원 수정에 실패했습니다.');
      }
    }
  };

  // 클럽이 로드 중이거나 선택되지 않았으면 대기 (슈퍼관리자는 클럽 선택 없이도 접근 가능)
  console.log('Members: Render check', {
    clubLoading,
    currentClub: currentClub?.name,
    isSuperAdmin,
    shouldShow: !clubLoading && (currentClub || isSuperAdmin),
  });

  if (clubLoading || (!currentClub && !isSuperAdmin)) {
    return <div className="loading">클럽 정보를 불러오는 중...</div>;
  }

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="members-page">
      <div className="page-header">
        <h1>팀커버 회원 관리</h1>
        <div className="header-actions">
          {isSuperAdmin && (
            <button
              className="btn btn-info"
              onClick={() => setShowPasswordSetting(true)}
              title="개인정보 보호 비밀번호 설정 (슈퍼관리자 전용)"
            >
              🔒 비밀번호 설정
            </button>
          )}
          <button className="btn btn-info" onClick={scrollToImportSection}>
            구글시트 가져오기
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            회원 추가
          </button>
        </div>
      </div>

      {/* 통계 섹션 */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card stat-primary">
            <div className="stat-number">{stats.total_members || 0}</div>
            <div className="stat-label">전체 회원</div>
          </div>
          <div className="stat-card stat-success">
            <div className="stat-number">{stats.new_members || 0}</div>
            <div className="stat-label">신규 회원</div>
          </div>
          <div className="stat-card stat-info">
            <div className="stat-number">{stats.male_count || 0}</div>
            <div className="stat-label">남성 회원</div>
          </div>
          <div className="stat-card stat-warning">
            <div className="stat-number">{stats.female_count || 0}</div>
            <div className="stat-label">여성 회원</div>
          </div>
        </div>
      </div>

      {/* 구글시트 가져오기 폼 */}
      {showImportForm && (
        <div id="sheet-import-section" className="import-section">
          <div className="section-card">
            <h3 className="section-title">구글시트에서 회원 가져오기</h3>
            <div className="alert alert-warning import-alert">
              <strong>주의:</strong> 기존 회원 모두 삭제 후 가져오기 (기존
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
              <div className="form-group import-confirm">
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
              <div className="form-actions import-actions">
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

      {/* 회원 추가/수정 폼 */}
      {showAddForm && (
        <div className="form-section">
          <div className="section-card">
            <h3 className="section-title">
              {editingMember ? '회원 정보 수정' : '새 회원 등록'}
            </h3>
            <form
              onSubmit={handleSubmit}
              className={`member-form ${submitting ? 'submitting' : ''}`}
            >
              <div className="form-row">
                <div className="form-group form-group-name">
                  <label>이름 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-group form-group-phone">
                  <label>전화번호</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    disabled={submitting}
                  />
                </div>
                <div className="form-group form-group-gender">
                  <label>성별</label>
                  <select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value })
                    }
                    disabled={submitting}
                  >
                    <option value="">선택</option>
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                </div>
                <div className="form-group form-group-note">
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
                {isAdmin && (
                  <div className="form-group form-group-staff">
                    <input
                      type="checkbox"
                      checked={formData.is_staff}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_staff: e.target.checked,
                        })
                      }
                      disabled={submitting}
                    />
                    <label>운영진</label>
                  </div>
                )}
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
                      {editingMember ? '수정 중...' : '등록 중...'}
                    </>
                  ) : editingMember ? (
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

      {/* 회원 목록 */}
      <div className="members-section">
        <div className="section-card">
          <h3 className="section-title">회원 목록</h3>
          <div className="members-table">
            <table>
              <thead>
                <tr>
                  <th
                    className="sortable"
                    onClick={() => handleSort('name')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    이름{' '}
                    {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>전화번호</th>
                  <th>성별</th>
                  <th
                    className="sortable"
                    onClick={() => handleSort('tier')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    티어{' '}
                    {sortField === 'tier' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>운영진</th>
                  <th
                    className="sortable"
                    onClick={() => handleSort('join_date')}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    가입일{' '}
                    {sortField === 'join_date' &&
                      (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>설정</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((member, index) => {
                  const isLastTwo = index >= sortedMembers.length - 2;
                  return (
                    <tr key={member.id}>
                      {inlineEditingId === member.id ? (
                        <>
                          <td>
                            <input
                              className="inline-input"
                              type="text"
                              value={inlineEditData.name}
                              onChange={(e) =>
                                setInlineEditData((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                              required
                            />
                          </td>
                          <td>
                            <input
                              className="inline-input"
                              type="tel"
                              value={inlineEditData.phone}
                              onChange={(e) =>
                                setInlineEditData((prev) => ({
                                  ...prev,
                                  phone: e.target.value,
                                }))
                              }
                              disabled={!privacyUnlocked}
                              placeholder={
                                !privacyUnlocked
                                  ? '잠금 해제 후 편집 가능'
                                  : undefined
                              }
                            />
                          </td>
                          <td>
                            <select
                              className="inline-select"
                              value={inlineEditData.gender}
                              onChange={(e) =>
                                setInlineEditData((prev) => ({
                                  ...prev,
                                  gender: e.target.value,
                                }))
                              }
                            >
                              <option value="">선택</option>
                              <option value="남">남</option>
                              <option value="여">여</option>
                            </select>
                          </td>
                          <td>
                            <TierBadge tier={member.tier} size="small" />
                          </td>
                          <td>
                            {isAdmin ? (
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={inlineEditData.is_staff || false}
                                  onChange={(e) =>
                                    setInlineEditData((prev) => ({
                                      ...prev,
                                      is_staff: e.target.checked,
                                    }))
                                  }
                                />
                                운영진
                              </label>
                            ) : member.is_staff ? (
                              <span className="badge badge-info">운영진</span>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                          <td>
                            <input
                              className="inline-input"
                              type="date"
                              value={
                                inlineEditData.join_date ||
                                (member.created_at
                                  ? new Date(member.created_at)
                                      .toISOString()
                                      .split('T')[0]
                                  : '')
                              }
                              onChange={(e) =>
                                setInlineEditData((prev) => ({
                                  ...prev,
                                  join_date: e.target.value,
                                }))
                              }
                            />
                          </td>
                          <td className="inline-actions">
                            <button
                              className="btn-inline-complete"
                              onClick={() => saveInlineEdit(member.id)}
                              title="완료"
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M16.667 5L7.5 14.167 3.333 10"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              className="btn-inline-cancel"
                              onClick={cancelInlineEdit}
                              title="취소"
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M5 5L15 15M15 5L5 15"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{member.name}</td>
                          <td className="privacy-cell-wrapper">
                            <span className="privacy-text">
                              {maskPhone(member.phone)}
                            </span>
                            {!privacyUnlocked && (
                              <button
                                className="privacy-lock-btn"
                                onClick={handlePrivacyClick}
                                title="클릭하여 개인정보 보기"
                              >
                                <span className="lock-icon">🔒</span>
                                <span className="unlock-icon">🔓</span>
                              </button>
                            )}
                          </td>
                          <td>{member.gender || '-'}</td>
                          <td>
                            <TierBadge tier={member.tier} size="small" />
                          </td>
                          <td>
                            {member.is_staff ? (
                              <span
                                style={{
                                  padding: '2px 6px',
                                  backgroundColor: '#e7f3ff',
                                  color: '#0066cc',
                                  borderRadius: '3px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                }}
                              >
                                운영진
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td>
                            {member.join_date || member.created_at
                              ? new Date(member.join_date || member.created_at)
                                  .toLocaleDateString('ko-KR', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                  })
                                  .replace(/\./g, '.')
                                  .replace(/\s/g, '')
                              : '-'}
                          </td>
                          <td>
                            <div
                              className={`action-menu-container ${
                                isLastTwo ? 'menu-open-up' : ''
                              }`}
                              data-member-id={member.id}
                            >
                              <button
                                className="btn btn-sm btn-menu-toggle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const button = e.currentTarget;
                                  const container = button.closest(
                                    '.action-menu-container'
                                  );
                                  const rect = button.getBoundingClientRect();
                                  const viewportHeight = window.innerHeight;
                                  const dropdownHeight = 100; // 드롭다운 예상 높이 (여유있게)
                                  const spaceBelow =
                                    viewportHeight - rect.bottom;

                                  // 마지막 두 항목이거나 아래 공간이 부족하면 위로 열기
                                  const shouldOpenUp =
                                    isLastTwo || spaceBelow < dropdownHeight;

                                  if (shouldOpenUp) {
                                    container.classList.add('menu-open-up');
                                  } else {
                                    container.classList.remove('menu-open-up');
                                  }

                                  // 활성 상태 클래스 추가/제거
                                  if (openMenuId === member.id) {
                                    container.classList.remove('menu-active');
                                  } else {
                                    container.classList.add('menu-active');
                                  }

                                  setOpenMenuId(
                                    openMenuId === member.id ? null : member.id
                                  );
                                }}
                              >
                                <span className="menu-dots">
                                  <span className="menu-dot"></span>
                                  <span className="menu-dot"></span>
                                  <span className="menu-dot"></span>
                                </span>
                              </button>
                              {openMenuId === member.id && (
                                <div className="action-menu-dropdown">
                                  <button
                                    className="action-menu-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startInlineEdit(member);
                                      setOpenMenuId(null);
                                    }}
                                  >
                                    수정
                                  </button>
                                  <button
                                    className="action-menu-item action-menu-item-danger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(member.id);
                                      setOpenMenuId(null);
                                    }}
                                    disabled={deletingMemberId !== null}
                                  >
                                    삭제
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 개인정보 보호 비밀번호 입력 모달 */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🔒 개인정보 보호</h3>
            <p>전화번호와 이메일을 보려면 비밀번호를 입력하세요.</p>

            {passwordError && (
              <div className="error-message">{passwordError}</div>
            )}

            <div className="form-group">
              <label>비밀번호</label>
              <input
                type="password"
                value={privacyPassword}
                onChange={(e) => setPrivacyPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleVerifyPassword()}
                placeholder="비밀번호 입력"
                autoFocus
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleVerifyPassword}
              >
                확인
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPrivacyPassword('');
                  setPasswordError('');
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 설정 모달 */}
      {showPasswordSetting && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🔒 개인정보 보호 비밀번호 설정</h3>
            <p>
              {passwordSetStatus
                ? '비밀번호를 변경하려면 새 비밀번호를 입력하세요.'
                : '개인정보(전화번호, 이메일) 열람 시 필요한 비밀번호를 설정하세요.'}
            </p>

            <div className="form-group">
              <label>비밀번호 (4자리 이상)</label>
              <input
                type="password"
                value={newPrivacyPassword}
                onChange={(e) => setNewPrivacyPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSetPassword()}
                placeholder="비밀번호 입력"
                autoFocus
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleSetPassword}>
                저장
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPasswordSetting(false);
                  setNewPrivacyPassword('');
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <LoadingModal isOpen={submitting} message="회원 저장 중..." />
      <LoadingModal
        isOpen={Boolean(deletingMemberId)}
        message="회원 삭제 중..."
      />
      <LoadingModal
        isOpen={savingInlineEdit}
        message="설정변경중.."
      />
    </div>
  );
};

export default Members;
