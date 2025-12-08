import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { inquiryAPI } from '../services/api';
import './Inquiry.css';

const Inquiry = () => {
  const { user } = useAuth();
  const { isAdmin: clubIsAdmin } = useClub();
  const isSuperAdmin = user && user.role === 'super_admin';
  const canReply = isSuperAdmin || clubIsAdmin;

  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [editingReply, setEditingReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replyComments, setReplyComments] = useState([]);
  const [commentContent, setCommentContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_private: true,
  });

  useEffect(() => {
    if (
      user &&
      (user.role === 'user' ||
        user.role === 'admin' ||
        user.role === 'super_admin')
    ) {
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
        // 운영진/슈퍼관리자는 답변이 없을 때만 답변 작성 폼 자동 표시
        if (canReply && !response.data.inquiry.reply) {
          setShowReplyForm(true);
          setEditingReply(false);
          setReplyContent('');
        } else {
          setShowReplyForm(false);
          setEditingReply(false);
          setReplyContent('');
        }
        // 답변 댓글 로드
        if (response.data.inquiry.reply) {
          fetchReplyComments(inquiryId);
        } else {
          setReplyComments([]);
        }
        // 답변 댓글 로드
        if (response.data.inquiry.reply) {
          fetchReplyComments(inquiryId);
        } else {
          setReplyComments([]);
        }
      } else {
        alert(response.data.message || '문의를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('문의 조회 오류:', error);
      alert(error.response?.data?.message || '문의를 불러오는데 실패했습니다.');
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
        const response = await inquiryAPI.updateInquiry(
          editingInquiry.id,
          formData
        );
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
          setFormData({ title: '', content: '', is_private: true });
          setShowForm(false);
          await fetchInquiries();
          // Navbar의 새로운 문의 배지 갱신
          window.dispatchEvent(new Event('inquiryUpdated'));
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

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) {
      alert('답변 내용을 입력해주세요.');
      return;
    }

    if (replyContent.length > 500) {
      alert('답변은 500자 이내로 입력해주세요.');
      return;
    }

    try {
      if (editingReply && selectedInquiry && selectedInquiry.reply) {
        // 답변 수정
        const response = await inquiryAPI.updateInquiryReply(
          selectedInquiry.id,
          {
            reply: replyContent,
          }
        );
        if (response.data.success) {
          alert('답변이 수정되었습니다.');
          setShowReplyForm(false);
          setEditingReply(false);
          setReplyContent('');
          await handleViewInquiry(selectedInquiry.id);
          // Navbar의 새로운 문의 배지 갱신
          window.dispatchEvent(new Event('inquiryUpdated'));
        } else {
          alert(response.data.message || '답변 수정에 실패했습니다.');
        }
      } else if (selectedInquiry) {
        // 답변 작성
        const response = await inquiryAPI.replyInquiry(selectedInquiry.id, {
          reply: replyContent,
        });
        if (response.data.success) {
          alert('답변이 등록되었습니다.');
          setShowReplyForm(false);
          setReplyContent('');
          await handleViewInquiry(selectedInquiry.id);
          // Navbar의 새로운 문의 배지 갱신
          window.dispatchEvent(new Event('inquiryUpdated'));
        } else {
          alert(response.data.message || '답변 등록에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('답변 등록/수정 오류:', error);
      alert(error.response?.data?.message || '답변 등록/수정에 실패했습니다.');
    }
  };

  const handleDeleteReply = async () => {
    if (!window.confirm('정말 답변을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await inquiryAPI.deleteInquiryReply(selectedInquiry.id);
      if (response.data.success) {
        alert('답변이 삭제되었습니다.');
        await handleViewInquiry(selectedInquiry.id);
      } else {
        alert(response.data.message || '답변 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('답변 삭제 오류:', error);
      alert(error.response?.data?.message || '답변 삭제에 실패했습니다.');
    }
  };

  const handleEditReply = () => {
    if (selectedInquiry && selectedInquiry.reply) {
      setReplyContent(selectedInquiry.reply);
      setEditingReply(true);
      setShowReplyForm(true);
    }
  };

  const handleCancelReplyEdit = () => {
    setEditingReply(false);
    setReplyContent('');
    setShowReplyForm(false);
  };

  const fetchReplyComments = async (inquiryId) => {
    try {
      const response = await inquiryAPI.getReplyComments(inquiryId);
      if (response.data.success) {
        setReplyComments(response.data.comments || []);
      }
    } catch (error) {
      console.error('댓글 목록 조회 오류:', error);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentContent.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    if (commentContent.length > 500) {
      alert('댓글은 500자 이내로 입력해주세요.');
      return;
    }

    try {
      if (editingCommentId) {
        // 댓글 수정
        const response = await inquiryAPI.updateReplyComment(
          selectedInquiry.id,
          editingCommentId,
          {
            content: commentContent,
          }
        );
        if (response.data.success) {
          alert('댓글이 수정되었습니다.');
          setCommentContent('');
          setEditingCommentId(null);
          await fetchReplyComments(selectedInquiry.id);
        } else {
          alert(response.data.message || '댓글 수정에 실패했습니다.');
        }
      } else {
        // 댓글 작성
        const response = await inquiryAPI.createReplyComment(
          selectedInquiry.id,
          {
            content: commentContent,
          }
        );
        if (response.data.success) {
          setCommentContent('');
          await fetchReplyComments(selectedInquiry.id);
        } else {
          alert(response.data.message || '댓글 등록에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('댓글 등록/수정 오류:', error);
      alert(error.response?.data?.message || '댓글 등록/수정에 실패했습니다.');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('정말 댓글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await inquiryAPI.deleteReplyComment(
        selectedInquiry.id,
        commentId
      );
      if (response.data.success) {
        alert('댓글이 삭제되었습니다.');
        await fetchReplyComments(selectedInquiry.id);
      } else {
        alert(response.data.message || '댓글 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      alert(error.response?.data?.message || '댓글 삭제에 실패했습니다.');
    }
  };

  const handleEditComment = (comment) => {
    setCommentContent(comment.content);
    setEditingCommentId(comment.id);
  };

  const handleCancelComment = () => {
    setCommentContent('');
    setEditingCommentId(null);
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

  // 권한 확인 (슈퍼관리자도 접근 가능)
  if (
    !user ||
    (user.role !== 'user' &&
      user.role !== 'admin' &&
      user.role !== 'super_admin')
  ) {
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

  // 슈퍼관리자인 경우 클럽별로 문의 분류
  const inquiriesByClub = isSuperAdmin
    ? inquiries.reduce((acc, inquiry) => {
        const clubName = inquiry.club_name || '클럽 미지정';
        if (!acc[clubName]) {
          acc[clubName] = [];
        }
        acc[clubName].push(inquiry);
        return acc;
      }, {})
    : null;

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
            <div className="inquiry-detail-content">
              {selectedInquiry.content}
            </div>

            {/* 답변 섹션 - 수정 모드가 아닐 때만 표시 */}
            {selectedInquiry.reply && !editingReply && (
              <div className="inquiry-reply-section">
                <div className="inquiry-reply-header">
                  <h3>답변</h3>
                  {selectedInquiry.replier_name && (
                    <span className="inquiry-reply-meta">
                      {selectedInquiry.replier_name}
                      {selectedInquiry.replied_at &&
                        ` · ${formatDate(selectedInquiry.replied_at)}`}
                    </span>
                  )}
                </div>
                <div className="inquiry-reply-content">
                  {selectedInquiry.reply}
                </div>
                {canReply && (
                  <div className="inquiry-reply-actions">
                    <button
                      className="inquiry-edit-button-small"
                      onClick={handleEditReply}
                    >
                      수정
                    </button>
                    <button
                      className="inquiry-delete-button-small"
                      onClick={handleDeleteReply}
                    >
                      삭제
                    </button>
                  </div>
                )}

                {/* 답변 댓글 섹션 */}
                <div className="inquiry-reply-comments-section">
                  <h4 className="inquiry-comments-title">
                    댓글 ({replyComments.length})
                  </h4>

                  {/* 댓글 목록 */}
                  {replyComments.length > 0 && (
                    <div className="inquiry-comments-list">
                      {replyComments.map((comment) => (
                        <div key={comment.id} className="inquiry-comment-item">
                          <div className="inquiry-comment-header">
                            <span className="inquiry-comment-author">
                              {comment.user_name}
                            </span>
                            <span className="inquiry-comment-date">
                              {formatDate(comment.created_at)}
                            </span>
                          </div>
                          {editingCommentId === comment.id ? (
                            <form
                              onSubmit={handleCommentSubmit}
                              className="inquiry-comment-edit-form"
                            >
                              <textarea
                                value={commentContent}
                                onChange={(e) =>
                                  setCommentContent(e.target.value)
                                }
                                maxLength={500}
                                required
                                rows={3}
                                className="inquiry-comment-edit-textarea"
                              />
                              <div className="inquiry-comment-edit-actions">
                                <button
                                  type="button"
                                  className="inquiry-cancel-button-small"
                                  onClick={handleCancelComment}
                                >
                                  취소
                                </button>
                                <button
                                  type="submit"
                                  className="inquiry-submit-button-small"
                                >
                                  수정
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="inquiry-comment-content">
                                {comment.content}
                              </div>
                              {comment.user_id === user?.id && (
                                <div className="inquiry-comment-actions">
                                  <button
                                    className="inquiry-edit-button-tiny"
                                    onClick={() => handleEditComment(comment)}
                                  >
                                    수정
                                  </button>
                                  <button
                                    className="inquiry-delete-button-tiny"
                                    onClick={() =>
                                      handleDeleteComment(comment.id)
                                    }
                                  >
                                    삭제
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 댓글 작성 폼 */}
                  <form
                    onSubmit={handleCommentSubmit}
                    className="inquiry-comment-form"
                  >
                    <textarea
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      maxLength={500}
                      required
                      rows={3}
                      placeholder="댓글을 입력하세요 (500자 이내)"
                      className="inquiry-comment-textarea"
                    />
                    <div className="inquiry-comment-form-footer">
                      <div className="inquiry-char-count">
                        {commentContent.length}/500
                      </div>
                      <button
                        type="submit"
                        className="inquiry-submit-button-small"
                      >
                        {editingCommentId ? '수정하기' : '등록하기'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 답변 작성 폼 - 운영진/슈퍼관리자는 답변이 없을 때만 자동 표시 */}
            {canReply &&
              showReplyForm &&
              !selectedInquiry.reply &&
              !editingReply && (
                <div className="inquiry-reply-form-section">
                  <h3>답변 작성</h3>
                  <form onSubmit={handleReplySubmit}>
                    <div className="inquiry-form-group">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        maxLength={500}
                        required
                        rows={6}
                        placeholder="답변 내용을 입력하세요 (500자 이내)"
                      />
                      <div className="inquiry-char-count">
                        {replyContent.length}/500
                      </div>
                    </div>
                    <div className="inquiry-form-actions">
                      <button type="submit" className="inquiry-submit-button">
                        등록하기
                      </button>
                    </div>
                  </form>
                </div>
              )}

            {/* 답변 수정 폼 - 수정 버튼을 누르면 표시 */}
            {canReply &&
              showReplyForm &&
              editingReply &&
              selectedInquiry.reply && (
                <div className="inquiry-reply-form-section">
                  <h3>답변 수정</h3>
                  <form onSubmit={handleReplySubmit}>
                    <div className="inquiry-form-group">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        maxLength={500}
                        required
                        rows={6}
                        placeholder="답변 내용을 입력하세요 (500자 이내)"
                      />
                      <div className="inquiry-char-count">
                        {replyContent.length}/500
                      </div>
                    </div>
                    <div className="inquiry-comment-edit-actions">
                      <button
                        type="button"
                        className="inquiry-cancel-button-small"
                        onClick={handleCancelReplyEdit}
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="inquiry-submit-button-small"
                      >
                        수정
                      </button>
                    </div>
                  </form>
                </div>
              )}

            {/* 문의 작성자가 자신의 문의를 볼 때만 수정 버튼 표시 (답변이 없을 때만) */}
            {selectedInquiry.user_id === user?.id && !selectedInquiry.reply && (
              <div className="inquiry-detail-actions">
                <button
                  className="inquiry-edit-button"
                  onClick={() => handleEditInquiry(selectedInquiry)}
                >
                  수정
                </button>
              </div>
            )}
            
            {/* 삭제 버튼: 작성자 또는 운영진/슈퍼관리자 (단, 슈퍼관리자가 작성한 문의는 슈퍼관리자만 삭제 가능) */}
            {(selectedInquiry.user_id === user?.id || 
              (canReply && (user?.role === 'super_admin' || selectedInquiry.user_role !== 'super_admin'))) && (
              <div className="inquiry-detail-actions">
                <button
                  className="inquiry-delete-button"
                  onClick={() => handleDeleteInquiry(selectedInquiry.id)}
                >
                  삭제
                </button>
              </div>
            )}
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
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
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
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
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
                  onChange={(e) =>
                    setFormData({ ...formData, is_private: e.target.checked })
                  }
                />
                <span>
                  비공개 (작성자만 열람 가능, 체크 해제 시 같은 클럽 회원 모두
                  열람 가능)
                </span>
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
          <button
            className="inquiry-create-button"
            onClick={handleCreateInquiry}
          >
            문의 작성
          </button>
        </div>
        {error && <div className="inquiry-error">{error}</div>}
        {inquiries.length === 0 ? (
          <div className="inquiry-empty">
            <p>등록된 문의가 없습니다.</p>
            <button
              className="inquiry-create-button"
              onClick={handleCreateInquiry}
            >
              첫 문의 작성하기
            </button>
          </div>
        ) : isSuperAdmin && inquiriesByClub ? (
          <div className="inquiry-list-by-club">
            {Object.entries(inquiriesByClub).map(
              ([clubName, clubInquiries]) => (
                <div key={clubName} className="inquiry-club-section">
                  <h2 className="inquiry-club-title">{clubName}</h2>
                  <div className="inquiry-list">
                    {clubInquiries.map((inquiry) => (
                      <div
                        key={inquiry.id}
                        className="inquiry-item"
                        onClick={() => handleViewInquiry(inquiry.id)}
                      >
                        <div className="inquiry-item-header">
                          <h3>{inquiry.title}</h3>
                          <div className="inquiry-item-badges">
                            {inquiry.is_private && (
                              <span className="inquiry-private-badge">
                                비공개
                              </span>
                            )}
                            {inquiry.reply && (
                              <span className="inquiry-replied-badge">
                                답변완료
                              </span>
                            )}
                            {!inquiry.reply && (
                              <span className="inquiry-pending-badge">
                                답변대기
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="inquiry-item-content">
                          {inquiry.content.length > 50
                            ? `${inquiry.content.substring(0, 50)}...`
                            : inquiry.content}
                        </div>
                        <div className="inquiry-item-footer">
                          <div className="inquiry-item-meta">
                            <span className="inquiry-author">
                              작성자: {inquiry.user_name || '알 수 없음'}
                            </span>
                            <span className="inquiry-date">
                              {formatDate(inquiry.created_at)}
                            </span>
                          </div>
                          {/* 수정 버튼: 작성자만 (답변이 없을 때만) */}
                          {inquiry.user_id === user?.id && !inquiry.reply && (
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
                            </div>
                          )}
                          
                          {/* 삭제 버튼: 작성자 또는 운영진/슈퍼관리자 (단, 슈퍼관리자가 작성한 문의는 슈퍼관리자만 삭제 가능) */}
                          {(inquiry.user_id === user?.id || 
                            (canReply && (user?.role === 'super_admin' || inquiry.user_role !== 'super_admin'))) && (
                            <div className="inquiry-item-actions">
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
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
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
                  <div className="inquiry-item-badges">
                    {inquiry.is_private && (
                      <span className="inquiry-private-badge">비공개</span>
                    )}
                    {inquiry.reply && (
                      <span className="inquiry-replied-badge">답변완료</span>
                    )}
                    {!inquiry.reply && (
                      <span className="inquiry-pending-badge">답변대기</span>
                    )}
                  </div>
                </div>
                <div className="inquiry-item-content">
                  {inquiry.content.length > 50
                    ? `${inquiry.content.substring(0, 50)}...`
                    : inquiry.content}
                </div>
                <div className="inquiry-item-footer">
                  <div className="inquiry-item-meta">
                    <span className="inquiry-author">
                      작성자: {inquiry.user_name || '알 수 없음'}
                    </span>
                    <span className="inquiry-date">
                      {formatDate(inquiry.created_at)}
                    </span>
                  </div>
                  {/* 수정 버튼: 작성자만 (답변이 없을 때만) */}
                  {inquiry.user_id === user?.id && !inquiry.reply && (
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
                    </div>
                  )}
                  
                  {/* 삭제 버튼: 작성자 또는 운영진/슈퍼관리자 (단, 슈퍼관리자가 작성한 문의는 슈퍼관리자만 삭제 가능) */}
                  {(inquiry.user_id === user?.id || 
                    (canReply && (user?.role === 'super_admin' || inquiry.user_role !== 'super_admin'))) && (
                    <div className="inquiry-item-actions">
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
                  )}
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
