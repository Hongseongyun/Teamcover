import React, { useState, useEffect } from 'react';
import { memberAPI, sheetsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
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
  const isSuperAdmin = user && user.role === 'super_admin';

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
  const [deleting, setDeleting] = useState(false); // 회원 삭제 중 로딩 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    email: '',
    note: '',
  });

  // 인라인 편집 상태
  const [inlineEditingId, setInlineEditingId] = useState(null);
  const [inlineEditData, setInlineEditData] = useState({
    name: '',
    phone: '',
    gender: '',
    email: '',
    note: '',
  });

  // 구글시트 가져오기 관련 상태
  const [showImportForm, setShowImportForm] = useState(false);
  const [importFormData, setImportFormData] = useState({
    spreadsheetUrl: '',
    worksheetName: '',
  });

  useEffect(() => {
    loadMembers();
    checkPasswordStatus();
    checkPrivacyStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 개인정보 보호 상태가 변경될 때마다 회원 목록 다시 로드
  useEffect(() => {
    sessionStorage.setItem('privacyUnlocked', privacyUnlocked.toString());
    if (privacyUnlocked) {
      loadMembers();
    }
  }, [privacyUnlocked]);

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

  const maskEmail = (email) => {
    if (!email) return '-';
    return email;
  };

  // 개인정보 클릭 핸들러
  const handlePrivacyClick = (e) => {
    e.preventDefault();
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
      setDeleting(true); // 로딩 시작
      try {
        await memberAPI.deleteMember(id);
        loadMembers();
      } catch (error) {
        // 에러 처리
        alert('회원 삭제에 실패했습니다.');
      } finally {
        setDeleting(false); // 로딩 종료
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      gender: '',
      email: '',
      note: '',
    });
    setEditingMember(null);
    setShowAddForm(false);
  };

  // 구글시트 가져오기
  const handleImportFromSheets = async (e) => {
    e.preventDefault();

    if (!importFormData.spreadsheetUrl.trim()) {
      alert('구글 시트 URL을 입력해주세요.');
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
      email: member.email || '',
      note: member.note || '',
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
    });
  };

  // 인라인 편집 저장
  const saveInlineEdit = async (memberId) => {
    try {
      const response = await memberAPI.updateMember(memberId, inlineEditData);

      if (response.data && !response.data.success) {
        alert(response.data.message || '회원 수정에 실패했습니다.');
        return;
      }

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
              }
            : m
        )
      );

      alert('회원 정보가 수정되었습니다.');
      cancelInlineEdit();
    } catch (error) {
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
        <div className="form-section">
          <div className="section-card">
            <h3 className="section-title">구글시트에서 회원 가져오기</h3>
            <form onSubmit={handleImportFromSheets} className="member-form">
              <div className="form-row">
                <div className="form-group full-width">
                  <label>구글 시트 URL *</label>
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
              </div>
              <div className="form-row">
                <div className="form-group full-width">
                  <label>워크시트 이름 (선택사항)</label>
                  <input
                    type="text"
                    value={importFormData.worksheetName}
                    onChange={(e) =>
                      setImportFormData({
                        ...importFormData,
                        worksheetName: e.target.value,
                      })
                    }
                    placeholder="워크시트 이름을 입력하세요 (비워두면 첫 번째 시트 사용)"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  가져오기
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
                <div className="form-group">
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
                <div className="form-group">
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
              </div>
              <div className="form-row">
                <div className="form-group">
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
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>이메일</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    disabled={submitting}
                  />
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
                  <th>이름</th>
                  <th>전화번호</th>
                  <th>성별</th>
                  <th>티어</th>
                  <th>이메일</th>
                  <th>등록일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
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
                          <input
                            className="inline-input"
                            type="email"
                            value={inlineEditData.email}
                            onChange={(e) =>
                              setInlineEditData((prev) => ({
                                ...prev,
                                email: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td>
                          {new Date(member.created_at)
                            .toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            })
                            .replace(/\./g, '.')
                            .replace(/\s/g, '')}
                        </td>
                        <td className="inline-actions">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => saveInlineEdit(member.id)}
                          >
                            완료
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={cancelInlineEdit}
                          >
                            취소
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
                        <td className="privacy-cell-wrapper">
                          <span className="privacy-text">
                            {maskEmail(member.email)}
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
                        <td>
                          {new Date(member.created_at)
                            .toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            })
                            .replace(/\./g, '.')
                            .replace(/\s/g, '')}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => startInlineEdit(member)}
                          >
                            수정
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(member.id)}
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
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 개인정보 보호 비밀번호 입력 모달 */}
      {showPasswordModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowPasswordModal(false)}
        >
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
        <div
          className="modal-overlay"
          onClick={() => setShowPasswordSetting(false)}
        >
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
    </div>
  );
};

export default Members;
