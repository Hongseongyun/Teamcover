import React, { useState, useEffect } from 'react';
import { memberAPI } from '../services/api';
import './Members.css';

const Members = () => {
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: '',
    level: '',
    email: '',
    note: '',
  });

  // 인라인 편집 상태
  const [inlineEditingId, setInlineEditingId] = useState(null);
  const [inlineEditData, setInlineEditData] = useState({
    name: '',
    phone: '',
    gender: '',
    level: '',
    email: '',
    note: '',
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setLoading(true);
      console.log('회원 목록 로드 시작');
      const response = await memberAPI.getMembers();
      console.log('회원 목록 응답:', response);
      if (response.data.success) {
        setMembers(response.data.members);
        setStats(response.data.stats);
        console.log('회원 목록 로드 성공:', response.data.members.length, '명');
      } else {
        console.error('회원 목록 로드 실패:', response.data.message);
      }
    } catch (error) {
      console.error('회원 목록 로드 실패:', error);
      console.error('에러 상세:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('회원 추가 시도:', formData);

    try {
      if (editingMember) {
        console.log('회원 수정 모드');
        const response = await memberAPI.updateMember(
          editingMember.id,
          formData
        );
        console.log('수정 응답:', response);
      } else {
        console.log('회원 추가 모드');
        console.log('전송할 데이터:', JSON.stringify(formData, null, 2));
        const response = await memberAPI.addMember(formData);
        console.log('추가 응답 전체:', response);
        console.log('응답 데이터:', response.data);
        console.log('응답 상태:', response.status);

        if (response.data && !response.data.success) {
          alert(response.data.message || '회원 추가에 실패했습니다.');
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
        level: '',
        email: '',
        note: '',
      });
      loadMembers();
    } catch (error) {
      console.error('회원 저장 실패:', error);
      console.error('에러 상세:', error.response?.data);
      alert(error.response?.data?.message || '회원 저장에 실패했습니다.');
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
      try {
        await memberAPI.deleteMember(id);
        loadMembers();
      } catch (error) {
        console.error('회원 삭제 실패:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      gender: '',
      level: '',
      email: '',
      note: '',
    });
    setEditingMember(null);
    setShowAddForm(false);
  };

  // 인라인 편집 시작
  const startInlineEdit = (member) => {
    setInlineEditingId(member.id);
    setInlineEditData({
      name: member.name,
      phone: member.phone || '',
      gender: member.gender || '',
      level: member.level || '',
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
      level: '',
      email: '',
      note: '',
    });
  };

  // 인라인 편집 저장
  const saveInlineEdit = async (memberId) => {
    try {
      console.log('회원 인라인 수정 시도:', inlineEditData);
      console.log('수정할 회원 ID:', memberId);

      const response = await memberAPI.updateMember(memberId, inlineEditData);
      console.log('인라인 수정 응답:', response);
      console.log('응답 상태:', response.status);
      console.log('응답 데이터:', response.data);

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
                level: inlineEditData.level,
                email: inlineEditData.email,
                note: inlineEditData.note,
              }
            : m
        )
      );

      alert('회원 정보가 수정되었습니다.');
      cancelInlineEdit();
    } catch (error) {
      console.error('인라인 수정 실패:', error);
      console.error('에러 타입:', error.name);
      console.error('에러 메시지:', error.message);
      console.error('에러 코드:', error.code);
      console.error('에러 상세:', error.response?.data);
      console.error('요청 URL:', error.config?.url);
      console.error('요청 메서드:', error.config?.method);

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
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(true)}
        >
          회원 추가
        </button>
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
            <div className="stat-label">신규 회원 (30일)</div>
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

      {/* 회원 추가/수정 폼 */}
      {showAddForm && (
        <div className="form-section">
          <div className="section-card">
            <h3 className="section-title">
              {editingMember ? '회원 정보 수정' : '새 회원 등록'}
            </h3>
            <form onSubmit={handleSubmit} className="member-form">
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
                  >
                    <option value="">선택</option>
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>레벨</label>
                  <select
                    value={formData.level}
                    onChange={(e) =>
                      setFormData({ ...formData, level: e.target.value })
                    }
                  >
                    <option value="">선택</option>
                    <option value="초급">초급</option>
                    <option value="중급">중급</option>
                    <option value="고급">고급</option>
                    <option value="프로">프로</option>
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
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingMember ? '수정' : '등록'}
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
                  <th>레벨</th>
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
                          <select
                            className="inline-select"
                            value={inlineEditData.level}
                            onChange={(e) =>
                              setInlineEditData((prev) => ({
                                ...prev,
                                level: e.target.value,
                              }))
                            }
                          >
                            <option value="">선택</option>
                            <option value="초급">초급</option>
                            <option value="중급">중급</option>
                            <option value="고급">고급</option>
                            <option value="프로">프로</option>
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
                        <td>{member.phone || '-'}</td>
                        <td>{member.gender || '-'}</td>
                        <td>{member.level || '-'}</td>
                        <td>{member.email || '-'}</td>
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
                          >
                            삭제
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
    </div>
  );
};

export default Members;
