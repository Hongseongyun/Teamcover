import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import './UserManagement.css';

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      console.error('사용자 목록 로드 실패:', error);
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
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      setError('역할 변경에 실패했습니다.');
      console.error('역할 변경 실패:', error);
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
      console.error('상태 변경 실패:', error);
    }
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      user: '일반 사용자',
      admin: '운영진',
      super_admin: '슈퍼 관리자',
    };
    return roleNames[role] || role;
  };

  const getRoleBadgeClass = (role) => {
    const roleClasses = {
      user: 'role-user',
      admin: 'role-admin',
      super_admin: 'role-super-admin',
    };
    return roleClasses[role] || 'role-default';
  };

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
            {users.map((user) => (
              <tr key={user.id}>
                <td className="user-name">
                  <div className="user-avatar">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  {user.name}
                </td>
                <td className="user-email">{user.email}</td>
                <td>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className={`role-select ${getRoleBadgeClass(user.role)}`}
                    disabled={user.id === currentUser?.id} // 자신의 역할은 변경 불가
                  >
                    <option value="user">일반 사용자</option>
                    <option value="admin">운영진</option>
                    <option value="super_admin">슈퍼 관리자</option>
                  </select>
                </td>
                <td>
                  <label className="status-toggle">
                    <input
                      type="checkbox"
                      checked={user.is_active}
                      onChange={(e) =>
                        handleStatusChange(user.id, e.target.checked)
                      }
                      disabled={user.id === currentUser?.id} // 자신의 상태는 변경 불가
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
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString('ko-KR')
                    : '-'}
                </td>
                <td className="date-cell">
                  {user.last_login
                    ? new Date(user.last_login).toLocaleDateString('ko-KR')
                    : '-'}
                </td>
                <td className="actions-cell">
                  {user.id === currentUser?.id && (
                    <span className="current-user-badge">현재 사용자</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </div>
  );
};

export default UserManagement;
