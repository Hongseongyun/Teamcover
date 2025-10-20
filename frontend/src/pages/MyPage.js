import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import './MyPage.css';

const MyPage = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);

  // 각 섹션별 메시지 상태
  const [nameMessage, setNameMessage] = useState({ type: '', text: '' });
  const [passwordMessage, setPasswordMessage] = useState({
    type: '',
    text: '',
  });
  const [deleteMessage, setDeleteMessage] = useState({ type: '', text: '' });

  // 이름 변경 관련 상태
  const [nameForm, setNameForm] = useState({
    currentName: '',
    newName: '',
  });

  // 비밀번호 변경 관련 상태
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 회원탈퇴 관련 상태
  const [deleteForm, setDeleteForm] = useState({
    password: '',
    confirmText: '',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (user) {
      setNameForm({
        currentName: user.name || '',
        newName: user.name || '',
      });
    }
  }, [user]);

  // 이름 변경
  const handleNameChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setNameMessage({ type: '', text: '' });

    try {
      if (!nameForm.newName.trim()) {
        setNameMessage({ type: 'error', text: '새 이름을 입력해주세요.' });
        return;
      }

      if (nameForm.newName === nameForm.currentName) {
        setNameMessage({ type: 'error', text: '현재 이름과 동일합니다.' });
        return;
      }

      const response = await authAPI.updateName({ name: nameForm.newName });

      if (response.data.success) {
        setNameMessage({
          type: 'success',
          text: '이름이 성공적으로 변경되었습니다.',
        });
        updateUser({ ...user, name: nameForm.newName });
        setNameForm({
          currentName: nameForm.newName,
          newName: nameForm.newName,
        });
      } else {
        setNameMessage({
          type: 'error',
          text: response.data.message || '이름 변경에 실패했습니다.',
        });
      }
    } catch (error) {
      console.error('이름 변경 오류:', error);
      setNameMessage({
        type: 'error',
        text:
          error.response?.data?.message || '이름 변경 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  // 비밀번호 변경
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPasswordMessage({ type: '', text: '' });

    try {
      if (
        !passwordForm.currentPassword ||
        !passwordForm.newPassword ||
        !passwordForm.confirmPassword
      ) {
        setPasswordMessage({
          type: 'error',
          text: '모든 필드를 입력해주세요.',
        });
        return;
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setPasswordMessage({
          type: 'error',
          text: '새 비밀번호와 확인 비밀번호가 일치하지 않습니다.',
        });
        return;
      }

      if (passwordForm.newPassword.length < 8) {
        setPasswordMessage({
          type: 'error',
          text: '새 비밀번호는 8자 이상이어야 합니다.',
        });
        return;
      }

      const response = await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (response.data.success) {
        setPasswordMessage({
          type: 'success',
          text: '비밀번호가 성공적으로 변경되었습니다.',
        });
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        setPasswordMessage({
          type: 'error',
          text: response.data.message || '비밀번호 변경에 실패했습니다.',
        });
      }
    } catch (error) {
      console.error('비밀번호 변경 오류:', error);
      setPasswordMessage({
        type: 'error',
        text:
          error.response?.data?.message ||
          '비밀번호 변경 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  // 회원탈퇴
  const handleAccountDeletion = async (e) => {
    e.preventDefault();
    setLoading(true);
    setDeleteMessage({ type: '', text: '' });

    try {
      if (deleteForm.confirmText !== '탈퇴하겠습니다') {
        setDeleteMessage({
          type: 'error',
          text: '확인 텍스트를 정확히 입력해주세요.',
        });
        return;
      }

      const response = await authAPI.deleteAccount({
        password: deleteForm.password,
      });

      if (response.data.success) {
        setDeleteMessage({
          type: 'success',
          text: '회원탈퇴가 완료되었습니다.',
        });
        // 로그아웃 처리
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setDeleteMessage({
          type: 'error',
          text: response.data.message || '회원탈퇴에 실패했습니다.',
        });
      }
    } catch (error) {
      console.error('회원탈퇴 오류:', error);
      setDeleteMessage({
        type: 'error',
        text:
          error.response?.data?.message || '회원탈퇴 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="mypage-container">
        <div className="mypage-header">
          <h1>마이페이지</h1>
        </div>
        <div className="mypage-content">
          <p>로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mypage-container">
      <div className="mypage-header">
        <h1>마이페이지</h1>
        <p className="mypage-subtitle">계정 정보를 관리하세요</p>
      </div>

      <div className="mypage-content">
        {/* 사용자 정보 카드 */}
        <div className="info-card">
          <h2>기본 정보</h2>
          <div className="user-info">
            <div className="user-avatar-large">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="user-details">
              <h3>{user.name}</h3>
              <p className="user-email">{user.email}</p>
              <p className="user-role">
                {user.role === 'super_admin'
                  ? '슈퍼관리자'
                  : user.role === 'admin'
                  ? '관리자'
                  : '일반사용자'}
              </p>
            </div>
          </div>
        </div>

        {/* 이름 변경 */}
        <div className="info-card">
          <h2>이름 변경</h2>
          <form onSubmit={handleNameChange}>
            <div className="form-group">
              <label>새 이름</label>
              <input
                type="text"
                value={nameForm.newName}
                onChange={(e) =>
                  setNameForm({ ...nameForm, newName: e.target.value })
                }
                placeholder="새 이름을 입력하세요"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || nameForm.newName === nameForm.currentName}
            >
              {loading ? '변경 중...' : '이름 변경'}
            </button>
          </form>
          {/* 이름 변경 알림 메시지 */}
          {nameMessage.text && (
            <div className={`alert alert-${nameMessage.type}`}>
              {nameMessage.text}
            </div>
          )}
        </div>

        {/* 비밀번호 변경 - 일반 로그인 사용자만 표시 */}
        {!user.google_id && (
          <div className="info-card">
            <h2>비밀번호 변경</h2>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>현재 비밀번호</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                  placeholder="현재 비밀번호를 입력하세요"
                  required
                />
              </div>
              <div className="form-group">
                <label>새 비밀번호</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  placeholder="새 비밀번호를 입력하세요 (8자 이상)"
                  required
                />
              </div>
              <div className="form-group">
                <label>새 비밀번호 확인</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="새 비밀번호를 다시 입력하세요"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
            {/* 비밀번호 변경 알림 메시지 */}
            {passwordMessage.text && (
              <div className={`alert alert-${passwordMessage.type}`}>
                {passwordMessage.text}
              </div>
            )}
          </div>
        )}

        {/* 회원탈퇴 */}
        <div className="info-card danger-card">
          <h2>회원탈퇴</h2>
          <p className="danger-text">
            회원탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
          </p>

          {!showDeleteConfirm ? (
            <button
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              회원탈퇴
            </button>
          ) : (
            <form onSubmit={handleAccountDeletion}>
              <div className="form-group">
                <label>현재 비밀번호</label>
                <input
                  type="password"
                  value={deleteForm.password}
                  onChange={(e) =>
                    setDeleteForm({ ...deleteForm, password: e.target.value })
                  }
                  placeholder="현재 비밀번호를 입력하세요"
                  required
                />
              </div>
              <div className="form-group">
                <label>확인</label>
                <input
                  type="text"
                  value={deleteForm.confirmText}
                  onChange={(e) =>
                    setDeleteForm({
                      ...deleteForm,
                      confirmText: e.target.value,
                    })
                  }
                  placeholder="'탈퇴하겠습니다'를 입력하세요"
                  required
                />
                <small>
                  정말 탈퇴하시려면 "탈퇴하겠습니다"를 정확히 입력해주세요.
                </small>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteForm({ password: '', confirmText: '' });
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={loading}
                >
                  {loading ? '탈퇴 중...' : '정말 탈퇴하기'}
                </button>
              </div>
            </form>
          )}
          {/* 회원탈퇴 알림 메시지 */}
          {deleteMessage.text && (
            <div className={`alert alert-${deleteMessage.type}`}>
              {deleteMessage.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyPage;
