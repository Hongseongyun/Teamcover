import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { inquiryAPI } from '../services/api';
import './Inquiry.css';

const Inquiry = () => {
  const { user } = useAuth();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_private: true,
  });

  useEffect(() => {
    if (user && (user.role === 'user' || user.role === 'admin')) {
      fetchInquiries();
    }
  }, [user]);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const response = await inquiryAPI.getInquiries();
      if (response.data.success) {
        setInquiries(response.data.inquiries);
      } else {
        setError('문의 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('문의 목록 조회 오류:', error);
      setError('문의 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInquiry = () => {
    setEditingInquiry(null);
    setFormData({
      title: '',
      content: '',
      is_private: true,
    });
    setShowForm(true);
  };

  const handleEditInquiry = (inquiry) => {
    setEditingInquiry(inquiry);
    setFormData({
      title: inquiry.title,
      content: inquiry.content,
      is_private: inquiry.is_private,
    });
    setSelectedInquiry(null);
    setShowForm(true);
  };

  const handleViewInquiry = async (inquiryId) => {
    try {
      const response = await inquiryAPI.getInquiry(inquiryId);
      if (response.data.success) {
        setSelectedInquiry(response.data.inquiry);
        setShowForm(false);
      } else {
        alert(response.data.message || '문의를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('문의 조회 오류:', error);
      alert('문의를 불러오는데 실패했습니다.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 유효성 검사
    if (!formData.title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    if (formData.title.length > 30) {
      alert('제목은 30자 이내로 입력해주세요.');
      return;
    }

    if (!formData.content.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    if (formData.content.length > 200) {
      alert('내용은 200자 이내로 입력해주세요.');
      return;
    }

    try {
      if (editingInquiry) {
        // 수정
        const response = await inquiryAPI.updateInquiry(editingInquiry.id, formData);
        if (response.data.success) {
          alert('문의가 수정되었습니다.');
          setShowForm(false);
          fetchInquiries();
        } else {
          alert(response.data.message || '문의 수정에 실패했습니다.');
        }
      } else {
        // 생성
        const response = await inquiryAPI.createInquiry(formData);
        if (response.data.success) {
          alert('문의가 등록되었습니다.');
          setShowForm(false);
          fetchInquiries();
        } else {
          alert(response.data.message || '문의 등록에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('문의 등록/수정 오류:', error);
      alert('문의 등록/수정에 실패했습니다.');
    }
  };

  const handleDeleteInquiry = async (inquiryId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await inquiryAPI.deleteInquiry(inquiryId);
      if (response.data.success) {
        alert('문의가 삭제되었습니다.');
        if (selectedInquiry && selectedInquiry.id === inquiryId) {
          setSelectedInquiry(null);
        }
        fetchInquiries();
      } else {
        alert(response.data.message || '문의 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('문의 삭제 오류:', error);
      alert('문의 삭제에 실패했습니다.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // 권한 확인
  if (!user || (user.role !== 'user' && user.role !== 'admin')) {
    return (
      <div className="inquiry-page">
        <div className="inquiry-container">
          <div className="inquiry-error">
            <p>접근 권한이 없습니다.</p>
            <p>일반 회원 및 운영진만 문의하기를 사용할 수 있습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="inquiry-page">
        <div className="inquiry-container">
          <div className="inquiry-loading">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (selectedInquiry) {
    return (
      <div className="inquiry-page">
        <div className="inquiry-container">
          <div className="inquiry-header">
            <h1>문의하기</h1>
            <button
              className="inquiry-back-button"
              onClick={() => setSelectedInquiry(null)}
            >
              목록으로
            </button>
          </div>
          <div className="inquiry-detail">
            <div className="inquiry-detail-header">
              <h2>{selectedInquiry.title}</h2>
              <div className="inquiry-detail-meta">
                <span className="inquiry-date">
                  {formatDate(selectedInquiry.created_at)}
                </span>
                {selectedInquiry.is_private && (
                  <span className="inquiry-private-badge">비공개</span>
                )}
              </div>
            </div>
            <div className="inquiry-detail-content">{selectedInquiry.content}</div>
            <div className="inquiry-detail-actions">
              <button
                className="inquiry-edit-button"
                onClick={() => handleEditInquiry(selectedInquiry)}
              >
                수정
              </button>
              <button
                className="inquiry-delete-button"
                onClick={() => handleDeleteInquiry(selectedInquiry.id)}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="inquiry-page">
        <div className="inquiry-container">
          <div className="inquiry-header">
            <h1>{editingInquiry ? '문의 수정' : '문의 작성'}</h1>
            <button
              className="inquiry-back-button"
              onClick={() => {
                setShowForm(false);
                setEditingInquiry(null);
              }}
            >
              취소
            </button>
          </div>
          <form className="inquiry-form" onSubmit={handleSubmit}>
            <div className="inquiry-form-group">
              <label htmlFor="title">제목 (30자 이내)</label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                maxLength={30}
                required
                placeholder="제목을 입력하세요"
              />
              <div className="inquiry-char-count">
                {formData.title.length}/30
              </div>
            </div>
            <div className="inquiry-form-group">
              <label htmlFor="content">내용 (200자 이내)</label>
              <textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                maxLength={200}
                required
                rows={8}
                placeholder="문의 내용을 입력하세요"
              />
              <div className="inquiry-char-count">
                {formData.content.length}/200
              </div>
            </div>
            <div className="inquiry-form-group">
              <label className="inquiry-checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.is_private}
                  onChange={(e) => setFormData({ ...formData, is_private: e.target.checked })}
                />
                <span>비공개 (자신만 열람 가능)</span>
              </label>
            </div>
            <div className="inquiry-form-actions">
              <button type="submit" className="inquiry-submit-button">
                {editingInquiry ? '수정하기' : '등록하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="inquiry-page">
      <div className="inquiry-container">
        <div className="inquiry-header">
          <h1>문의하기</h1>
          <button className="inquiry-create-button" onClick={handleCreateInquiry}>
            문의 작성
          </button>
        </div>
        {error && <div className="inquiry-error">{error}</div>}
        {inquiries.length === 0 ? (
          <div className="inquiry-empty">
            <p>등록된 문의가 없습니다.</p>
            <button className="inquiry-create-button" onClick={handleCreateInquiry}>
              첫 문의 작성하기
            </button>
          </div>
        ) : (
          <div className="inquiry-list">
            {inquiries.map((inquiry) => (
              <div
                key={inquiry.id}
                className="inquiry-item"
                onClick={() => handleViewInquiry(inquiry.id)}
              >
                <div className="inquiry-item-header">
                  <h3>{inquiry.title}</h3>
                  {inquiry.is_private && (
                    <span className="inquiry-private-badge">비공개</span>
                  )}
                </div>
                <div className="inquiry-item-content">
                  {inquiry.content.length > 50
                    ? `${inquiry.content.substring(0, 50)}...`
                    : inquiry.content}
                </div>
                <div className="inquiry-item-footer">
                  <span className="inquiry-date">
                    {formatDate(inquiry.created_at)}
                  </span>
                  <div className="inquiry-item-actions">
                    <button
                      className="inquiry-edit-button-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditInquiry(inquiry);
                      }}
                    >
                      수정
                    </button>
                    <button
                      className="inquiry-delete-button-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteInquiry(inquiry.id);
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inquiry;

