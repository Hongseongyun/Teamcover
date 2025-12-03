import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, clubAPI } from '../services/api';
import './UserManagement.css';

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, user: null });
  const [clubDeletingId, setClubDeletingId] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getUsers();
      if (response.data.success) {
        setUsers(response.data.users);
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await authAPI.updateUserRole(userId, { role: newRole });
      if (response.data.success) {
        setUsers(
          users.map((user) =>
            user.id === userId ? { ...user, role: newRole } : user
          )
        );
        setError(''); // 성공 시 에러 메시지 초기화
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError('역할 변경에 실패했습니다.');
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      const response = await authAPI.updateUserStatus(userId, {
        is_active: isActive,
      });
      if (response.data.success) {
        setUsers(
          users.map((user) =>
            user.id === userId ? { ...user, is_active: isActive } : user
          )
        );
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError('상태 변경에 실패했습니다.');
    }
  };

  const handleDeleteClick = (user) => {
    setDeleteModal({ isOpen: true, user });
  };

  const handleDeleteConfirm = async () => {
    try {
      const response = await authAPI.deleteUser(deleteModal.user.id);
      if (response.data.success) {
        setUsers(users.filter((user) => user.id !== deleteModal.user.id));
        setDeleteModal({ isOpen: false, user: null });
        setError(''); // 성공 시 에러 메시지 초기화
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError('사용자 삭제에 실패했습니다.');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModal({ isOpen: false, user: null });
  };

  // 클럽 삭제 (슈퍼관리자 전용)
  const handleDeleteClub = async (club) => {
    if (
      !window.confirm(
        `클럽 "${club.name}"을(를) 삭제하면 이 클럽의 회원, 점수, 포인트, 회비, 게시글, 기금 데이터가 모두 삭제됩니다.\n정말 삭제하시겠습니까?`
      )
    ) {
      return;
    }

    try {
      setClubDeletingId(club.id);
      const response = await clubAPI.deleteClub(club.id);
      if (response.data.success) {
        // 클럽 삭제 후 사용자 목록 다시 로드
        await loadUsers();
        setError('');
      } else {
        setError(response.data.message || '클럽 삭제에 실패했습니다.');
      }
    } catch (e) {
      console.error('클럽 삭제 오류:', e);
      setError('클럽 삭제 중 오류가 발생했습니다.');
    } finally {
      setClubDeletingId(null);
    }
  };

  const getRoleBadgeClass = (role) => {
    const roleClasses = {
      user: 'role-user',
      admin: 'role-admin',
      super_admin: 'role-super-admin',
    };
    return roleClasses[role] || 'role-default';
  };

  // 클럽별로 사용자 그룹화
  const groupUsersByClub = () => {
    const clubGroups = {};
    const noClubUsers = [];
    const superAdmins = []; // 모든 슈퍼관리자 (클럽 소속 여부와 관계없이)

    users.forEach((user) => {
      // 슈퍼관리자는 항상 별도 섹션에 표시
      if (user.role === 'super_admin') {
        superAdmins.push(user);
      } else {
        // 일반 사용자만 클럽별로 그룹화
        if (!user.clubs || user.clubs.length === 0) {
          noClubUsers.push(user);
        } else {
          user.clubs.forEach((club) => {
            if (!clubGroups[club.id]) {
              clubGroups[club.id] = {
                club: club,
                users: [],
              };
            }
            // 중복 방지: 이미 추가된 사용자인지 확인
            if (!clubGroups[club.id].users.find((u) => u.id === user.id)) {
              clubGroups[club.id].users.push(user);
            }
          });
        }
      }
    });

    return { clubGroups, noClubUsers, superAdminsNoClub: superAdmins };
  };

  const { clubGroups, noClubUsers, superAdminsNoClub } = groupUsersByClub();
  const clubIds = Object.keys(clubGroups).sort((a, b) => {
    const clubA = clubGroups[a].club;
    const clubB = clubGroups[b].club;
    return clubA.name.localeCompare(clubB.name);
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="page-header">
        <h1>사용자 관리</h1>
        <p>시스템 사용자들의 역할과 상태를 관리할 수 있습니다.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* 클럽별로 사용자 목록 표시 */}
      {clubIds.map((clubId) => {
        const { club, users: clubUsers } = clubGroups[clubId];
        const colorIndex = club.name.charCodeAt(0) % 8;

        return (
          <div key={club.id} className="club-section">
            <div className="club-section-header">
              <span className={`club-section-badge club-color-${colorIndex}`}>
                {club.name}
              </span>
              <span className="club-section-count">({clubUsers.length}명)</span>
              {currentUser?.role === 'super_admin' && club.id !== 1 && (
                <button
                  type="button"
                  className="club-delete-btn"
                  onClick={() => handleDeleteClub(club)}
                  disabled={clubDeletingId === club.id}
                >
                  {clubDeletingId === club.id ? '삭제 중...' : '클럽 삭제'}
                </button>
              )}
            </div>
            <div className="users-table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>역할</th>
                    <th>상태</th>
                    <th>가입일</th>
                    <th>마지막 로그인</th>
                    <th>작업</th>
                  </tr>
                </thead>
                <tbody>
                  {clubUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="user-name-cell">
                        <div className="user-name-content">
                          <div className="user-avatar">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="user-name-text">{user.name}</span>
                        </div>
                      </td>
                      <td className="user-email-cell">
                        <span className="user-email-text">{user.email}</span>
                      </td>
                      <td className="role-cell">
                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value)
                          }
                          className={`role-select ${getRoleBadgeClass(
                            user.role
                          )}`}
                          disabled={
                            user.id === currentUser?.id ||
                            user.email === 'syun4224@naver.com'
                          }
                        >
                          <option value="user">일반 사용자</option>
                          <option value="admin">운영진</option>
                          {user.email === 'syun4224@naver.com' && (
                            <option value="super_admin">슈퍼 관리자</option>
                          )}
                        </select>
                      </td>
                      <td className="status-cell">
                        <label className="status-toggle">
                          <input
                            type="checkbox"
                            checked={user.is_active}
                            onChange={(e) =>
                              handleStatusChange(user.id, e.target.checked)
                            }
                            disabled={user.id === currentUser?.id}
                          />
                          <span
                            className={`status-indicator ${
                              user.is_active ? 'active' : 'inactive'
                            }`}
                          >
                            {user.is_active ? '활성' : '비활성'}
                          </span>
                        </label>
                      </td>
                      <td className="date-cell">
                        <span className="date-text">
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString(
                                'ko-KR'
                              )
                            : '-'}
                        </span>
                      </td>
                      <td className="date-cell">
                        <span className="date-text">
                          {user.last_login
                            ? new Date(user.last_login).toLocaleDateString(
                                'ko-KR'
                              )
                            : '-'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        {user.id === currentUser?.id ? (
                          <span className="current-user-badge">
                            현재 사용자
                          </span>
                        ) : user.email === 'syun4224@naver.com' ? (
                          <span className="protected-user-badge">
                            보호된 계정
                          </span>
                        ) : (
                          <button
                            className="delete-user-btn"
                            onClick={() => handleDeleteClick(user)}
                            title="사용자 삭제"
                          >
                            삭제
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* 슈퍼관리자 (클럽 소속 없음) 섹션 */}
      {superAdminsNoClub.length > 0 && (
        <div className="club-section">
          <div className="club-section-header">
            <span className="club-section-badge super-admin-badge">
              슈퍼관리자
            </span>
            <span className="club-section-count">
              ({superAdminsNoClub.length}명)
            </span>
          </div>
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>역할</th>
                  <th>상태</th>
                  <th>가입일</th>
                  <th>마지막 로그인</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {superAdminsNoClub.map((user) => (
                  <tr key={user.id}>
                    <td className="user-name-cell">
                      <div className="user-name-content">
                        <div className="user-avatar">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="user-name-text">{user.name}</span>
                      </div>
                    </td>
                    <td className="user-email-cell">
                      <span className="user-email-text">{user.email}</span>
                    </td>
                    <td className="role-cell">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value)
                        }
                        className={`role-select ${getRoleBadgeClass(
                          user.role
                        )}`}
                        disabled={
                          user.id === currentUser?.id ||
                          user.email === 'syun4224@naver.com'
                        }
                      >
                        <option value="user">일반 사용자</option>
                        <option value="admin">운영진</option>
                        {user.email === 'syun4224@naver.com' && (
                          <option value="super_admin">슈퍼 관리자</option>
                        )}
                      </select>
                    </td>
                    <td className="status-cell">
                      <label className="status-toggle">
                        <input
                          type="checkbox"
                          checked={user.is_active}
                          onChange={(e) =>
                            handleStatusChange(user.id, e.target.checked)
                          }
                          disabled={user.id === currentUser?.id}
                        />
                        <span
                          className={`status-indicator ${
                            user.is_active ? 'active' : 'inactive'
                          }`}
                        >
                          {user.is_active ? '활성' : '비활성'}
                        </span>
                      </label>
                    </td>
                    <td className="date-cell">
                      <span className="date-text">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString(
                              'ko-KR'
                            )
                          : '-'}
                      </span>
                    </td>
                    <td className="date-cell">
                      <span className="date-text">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString(
                              'ko-KR'
                            )
                          : '-'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      {user.id === currentUser?.id ? (
                        <span className="current-user-badge">현재 사용자</span>
                      ) : user.email === 'syun4224@naver.com' ? (
                        <span className="protected-user-badge">
                          보호된 계정
                        </span>
                      ) : (
                        <button
                          className="delete-user-btn"
                          onClick={() => handleDeleteClick(user)}
                          title="사용자 삭제"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 클럽이 없는 사용자 섹션 */}
      {noClubUsers.length > 0 && (
        <div className="club-section">
          <div className="club-section-header">
            <span className="club-section-badge no-club-badge">클럽 없음</span>
            <span className="club-section-count">({noClubUsers.length}명)</span>
          </div>
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>클럽</th>
                  <th>역할</th>
                  <th>상태</th>
                  <th>가입일</th>
                  <th>마지막 로그인</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {noClubUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="user-name-cell">
                      <div className="user-name-content">
                        <div className="user-avatar">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="user-name-text">{user.name}</span>
                      </div>
                    </td>
                    <td className="user-email-cell">
                      <span className="user-email-text">{user.email}</span>
                    </td>
                    <td className="role-cell">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value)
                        }
                        className={`role-select ${getRoleBadgeClass(
                          user.role
                        )}`}
                        disabled={
                          user.id === currentUser?.id ||
                          user.email === 'syun4224@naver.com'
                        }
                      >
                        <option value="user">일반 사용자</option>
                        <option value="admin">운영진</option>
                        {user.email === 'syun4224@naver.com' && (
                          <option value="super_admin">슈퍼 관리자</option>
                        )}
                      </select>
                    </td>
                    <td className="status-cell">
                      <label className="status-toggle">
                        <input
                          type="checkbox"
                          checked={user.is_active}
                          onChange={(e) =>
                            handleStatusChange(user.id, e.target.checked)
                          }
                          disabled={user.id === currentUser?.id}
                        />
                        <span
                          className={`status-indicator ${
                            user.is_active ? 'active' : 'inactive'
                          }`}
                        >
                          {user.is_active ? '활성' : '비활성'}
                        </span>
                      </label>
                    </td>
                    <td className="date-cell">
                      <span className="date-text">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString(
                              'ko-KR'
                            )
                          : '-'}
                      </span>
                    </td>
                    <td className="date-cell">
                      <span className="date-text">
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString(
                              'ko-KR'
                            )
                          : '-'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      {user.id === currentUser?.id ? (
                        <span className="current-user-badge">현재 사용자</span>
                      ) : user.email === 'syun4224@naver.com' ? (
                        <span className="protected-user-badge">
                          보호된 계정
                        </span>
                      ) : (
                        <button
                          className="delete-user-btn"
                          onClick={() => handleDeleteClick(user)}
                          title="사용자 삭제"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="user-stats">
        <div className="stat-card">
          <div className="stat-number">{users.length}</div>
          <div className="stat-label">총 사용자</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">
            {users.filter((u) => u.is_active).length}
          </div>
          <div className="stat-label">활성 사용자</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">
            {
              users.filter(
                (u) => u.role === 'admin' || u.role === 'super_admin'
              ).length
            }
          </div>
          <div className="stat-label">관리자</div>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>사용자 삭제 확인</h3>
            </div>
            <div className="modal-body">
              <p>
                <strong>{deleteModal.user?.name}</strong>(
                {deleteModal.user?.email}) 사용자를 삭제하시겠습니까?
              </p>
              <p className="warning-text">
                ⚠️ 이 작업은 되돌릴 수 없습니다. 모든 사용자 데이터가 영구적으로
                삭제됩니다.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="modal-btn modal-btn-cancel"
                onClick={handleDeleteCancel}
              >
                취소
              </button>
              <button
                className="modal-btn modal-btn-danger"
                onClick={handleDeleteConfirm}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
