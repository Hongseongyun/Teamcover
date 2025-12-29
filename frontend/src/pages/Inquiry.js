import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { inquiryAPI } from '../services/api';
import './Inquiry.css';
import './Members.css'; // action-menu 스타일 사용

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
  const [openInquiryMenuId, setOpenInquiryMenuId] = useState(null); // 문의 메뉴 열림 상태
  const [openReplyMenuId, setOpenReplyMenuId] = useState(null); // 답변 메뉴 열림 상태
  const [openCommentMenuId, setOpenCommentMenuId] = useState(null); // 댓글 메뉴 열림 상태
  const [openReplyCommentMenuId, setOpenReplyCommentMenuId] = useState(null); // 답글 메뉴 열림 상태
  const [replyingToComment, setReplyingToComment] = useState(null); // 대댓글 작성 중인 댓글 ID
  const [replyToCommentContent, setReplyToCommentContent] = useState(''); // 대댓글 내용
  const [repliesExpanded, setRepliesExpanded] = useState({}); // 각 댓글의 답글 펼침/접기 상태
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

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !event.target.closest('.action-menu-container') &&
        (openInquiryMenuId ||
          openReplyMenuId ||
          openCommentMenuId ||
          openReplyCommentMenuId)
      ) {
        setOpenInquiryMenuId(null);
        setOpenReplyMenuId(null);
        setOpenCommentMenuId(null);
        setOpenReplyCommentMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    openInquiryMenuId,
    openReplyMenuId,
    openCommentMenuId,
    openReplyCommentMenuId,
  ]);

  // 드롭다운이 항상 아래로 열리도록 설정
  useEffect(() => {
    if (openInquiryMenuId || openCommentMenuId) {
      const menuId = openInquiryMenuId || openCommentMenuId;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const container = document.querySelector(
            `.action-menu-container[data-item-id="${menuId}"]`
          );
          if (container) {
            // 항상 아래로 열리도록 menu-open-up 클래스 제거
            container.classList.remove('menu-open-up');
          }
        });
      });
    }
  }, [openInquiryMenuId, openCommentMenuId]);

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
        // 좋아요 수 기준으로 정렬 (BEST 댓글을 상단에)
        const sortedComments = [...(response.data.comments || [])].sort(
          (a, b) => {
            const aLikes = a.like_count || 0;
            const bLikes = b.like_count || 0;
            if (aLikes !== bLikes) {
              return bLikes - aLikes; // 좋아요 수 내림차순
            }
            // 좋아요 수가 같으면 최신순
            return new Date(b.created_at) - new Date(a.created_at);
          }
        );
        setReplyComments(sortedComments);
        // 모든 댓글의 답글을 접힌 상태로 초기화 (기본값)
        const expandedState = {};
        sortedComments.forEach((comment) => {
          expandedState[comment.id] = false;
        });
        setRepliesExpanded(expandedState);
      }
    } catch (error) {
      console.error('댓글 목록 조회 오류:', error);
    }
  };

  // BEST 댓글인지 확인 (좋아요 수가 가장 많은 댓글)
  const isBestComment = (comment) => {
    if (replyComments.length === 0) return false;
    const maxLikes = Math.max(...replyComments.map((c) => c.like_count || 0));
    return (comment.like_count || 0) === maxLikes && maxLikes > 0;
  };

  const toggleReplies = (commentId) => {
    const willExpand = !repliesExpanded[commentId];
    setRepliesExpanded((prev) => ({
      ...prev,
      [commentId]: willExpand,
    }));
    // 답글을 펼칠 때 답글 작성 폼도 함께 열기, 접을 때는 닫기
    if (willExpand) {
      setReplyingToComment(commentId);
    } else {
      if (replyingToComment === commentId) {
        setReplyingToComment(null);
        setReplyToCommentContent('');
      }
    }
  };

  const handleReplyToCommentSubmit = async (parentId) => {
    if (!replyToCommentContent.trim()) return;

    try {
      const response = await inquiryAPI.createReplyComment(selectedInquiry.id, {
        content: replyToCommentContent.trim(),
        parent_id: parentId, // 답글인 경우 부모 댓글 ID
      });

      if (response.data.success) {
        setReplyToCommentContent('');
        setReplyingToComment(null);
        await fetchReplyComments(selectedInquiry.id);
      } else {
        alert(response.data.message || '답글 작성에 실패했습니다.');
      }
    } catch (error) {
      console.error('답글 작성 오류:', error);
      alert(error.response?.data?.message || '답글 작성에 실패했습니다.');
    }
  };

  const handleCommentLike = async (commentId) => {
    try {
      const response = await inquiryAPI.toggleReplyCommentLike(
        selectedInquiry.id,
        commentId
      );
      if (response.data.success) {
        await fetchReplyComments(selectedInquiry.id);
      } else {
        alert(response.data.message || '좋아요 처리에 실패했습니다.');
      }
    } catch (error) {
      console.error('댓글 좋아요 오류:', error);
      alert(
        error.response?.data?.message || '댓글 좋아요 처리에 실패했습니다.'
      );
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
              ← 목록으로
            </button>
          </div>
          <div className="inquiry-detail">
            <div className="inquiry-detail-header">
              <div className="inquiry-detail-header-left">
                <div className="inquiry-detail-title-wrapper">
                  <h2>{selectedInquiry.title}</h2>
                  {selectedInquiry.is_private && (
                    <span className="inquiry-private-badge">비공개</span>
                  )}
                </div>
                <div className="inquiry-detail-meta">
                  <span className="inquiry-date">
                    {formatDate(selectedInquiry.created_at)}
                  </span>
                </div>
              </div>
              {/* 문의 작성자가 자신의 문의를 볼 때만 수정/삭제 버튼 표시 */}
              {((selectedInquiry.user_id === user?.id &&
                !selectedInquiry.reply) ||
                selectedInquiry.user_id === user?.id ||
                (canReply &&
                  (user?.role === 'super_admin' ||
                    selectedInquiry.user_role !== 'super_admin'))) && (
                <div className="inquiry-detail-actions">
                  <div
                    className="action-menu-container"
                    data-item-id={selectedInquiry.id}
                  >
                    <button
                      className={`btn btn-sm btn-menu-toggle ${
                        openInquiryMenuId === selectedInquiry.id
                          ? 'menu-active'
                          : ''
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenInquiryMenuId(
                          openInquiryMenuId === selectedInquiry.id
                            ? null
                            : selectedInquiry.id
                        );
                      }}
                    >
                      <span className="menu-dots">
                        <span className="menu-dot"></span>
                        <span className="menu-dot"></span>
                        <span className="menu-dot"></span>
                      </span>
                    </button>
                    {openInquiryMenuId === selectedInquiry.id && (
                      <div className="action-menu-dropdown">
                        {selectedInquiry.user_id === user?.id &&
                          !selectedInquiry.reply && (
                            <button
                              className="action-menu-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditInquiry(selectedInquiry);
                                setOpenInquiryMenuId(null);
                              }}
                            >
                              수정
                            </button>
                          )}
                        {(selectedInquiry.user_id === user?.id ||
                          (canReply &&
                            (user?.role === 'super_admin' ||
                              selectedInquiry.user_role !==
                                'super_admin'))) && (
                          <button
                            className="action-menu-item action-menu-item-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteInquiry(selectedInquiry.id);
                              setOpenInquiryMenuId(null);
                            }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="inquiry-detail-content">
              {selectedInquiry.content}
            </div>

            {/* 답변 섹션 - 수정 모드가 아닐 때만 표시 */}
            {selectedInquiry.reply && !editingReply && (
              <div className="inquiry-reply-section">
                <div className="inquiry-reply-header">
                  <div className="inquiry-reply-header-left">
                    <h3>답변</h3>
                    {selectedInquiry.replier_name && (
                      <span className="inquiry-reply-meta">
                        {selectedInquiry.replier_name}
                        {selectedInquiry.replied_at &&
                          ` · ${formatDate(selectedInquiry.replied_at)}`}
                      </span>
                    )}
                  </div>
                  {canReply && (
                    <div className="inquiry-reply-actions">
                      <div
                        className="action-menu-container"
                        data-item-id="reply"
                      >
                        <button
                          className={`btn btn-sm btn-menu-toggle ${
                            openReplyMenuId === 'reply' ? 'menu-active' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenReplyMenuId(
                              openReplyMenuId === 'reply' ? null : 'reply'
                            );
                          }}
                        >
                          <span className="menu-dots">
                            <span className="menu-dot"></span>
                            <span className="menu-dot"></span>
                            <span className="menu-dot"></span>
                          </span>
                        </button>
                        {openReplyMenuId === 'reply' && (
                          <div className="action-menu-dropdown">
                            <button
                              className="action-menu-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditReply();
                                setOpenReplyMenuId(null);
                              }}
                            >
                              수정
                            </button>
                            <button
                              className="action-menu-item action-menu-item-danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReply();
                                setOpenReplyMenuId(null);
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="inquiry-reply-content">
                  {selectedInquiry.reply}
                </div>

                {/* 답변 댓글 섹션 */}
                <div className="inquiry-reply-comments-section">
                  <div className="inquiry-comments-title-wrapper">
                    <h4 className="inquiry-comments-title">
                      댓글 ({replyComments.length})
                    </h4>
                  </div>

                  {/* 댓글 목록 */}
                  {replyComments.length === 0 ? (
                    <div className="no-comments">댓글이 없습니다.</div>
                  ) : (
                    <div className="inquiry-comments-list">
                      {replyComments.map((comment) => {
                        const replyCount = comment.replies
                          ? comment.replies.length
                          : 0;
                        const isExpanded = repliesExpanded[comment.id] === true;

                        return (
                          <div
                            key={comment.id}
                            className={`inquiry-comment-item ${
                              isBestComment(comment) ? 'best-comment' : ''
                            }`}
                          >
                            {isBestComment(comment) && (
                              <span className="best-badge">BEST</span>
                            )}
                            <div className="inquiry-comment-header">
                              <div className="inquiry-comment-header-left">
                                <span className="inquiry-comment-author">
                                  {comment.user_name}
                                </span>
                                <span className="inquiry-comment-date">
                                  {formatDate(comment.created_at)}
                                </span>
                              </div>
                              {(comment.user_id === user?.id || canReply) && (
                                <div className="action-menu-container">
                                  <button
                                    className={`btn btn-sm btn-menu-toggle ${
                                      openCommentMenuId === comment.id
                                        ? 'menu-active'
                                        : ''
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const container = e.currentTarget.closest(
                                        '.action-menu-container'
                                      );
                                      if (container) {
                                        container.classList.remove(
                                          'menu-open-up'
                                        );
                                      }
                                      setOpenCommentMenuId(
                                        openCommentMenuId === comment.id
                                          ? null
                                          : comment.id
                                      );
                                    }}
                                  >
                                    <span className="menu-dots">
                                      <span className="menu-dot"></span>
                                      <span className="menu-dot"></span>
                                      <span className="menu-dot"></span>
                                    </span>
                                  </button>
                                  {openCommentMenuId === comment.id && (
                                    <div className="action-menu-dropdown">
                                      {comment.user_id === user?.id && (
                                        <button
                                          className="action-menu-item"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditComment(comment);
                                            setOpenCommentMenuId(null);
                                          }}
                                        >
                                          수정
                                        </button>
                                      )}
                                      {(comment.user_id === user?.id ||
                                        canReply) && (
                                        <button
                                          className="action-menu-item action-menu-item-danger"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteComment(comment.id);
                                            setOpenCommentMenuId(null);
                                          }}
                                        >
                                          삭제
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
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
                                <div className="inquiry-comment-actions">
                                  <button
                                    onClick={() => {
                                      toggleReplies(comment.id);
                                    }}
                                    className="comment-reply-btn"
                                  >
                                    답글 {replyCount > 0 && replyCount}
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleCommentLike(comment.id)
                                    }
                                    className={`comment-like-btn ${
                                      comment.is_liked ? 'liked' : ''
                                    }`}
                                  >
                                    👍 {comment.like_count || 0}
                                  </button>
                                </div>

                                {/* 대댓글 목록 및 입력창 */}
                                {isExpanded && (
                                  <div className="replies-section">
                                    <div className="replies-content">
                                      {/* 대댓글 목록 */}
                                      {comment.replies &&
                                        comment.replies.length > 0 && (
                                          <div className="replies-list">
                                            {comment.replies.map((reply) => (
                                              <div
                                                key={reply.id}
                                                className="reply-item"
                                              >
                                                <span className="reply-item-indicator">
                                                  ㄴ
                                                </span>
                                                <div className="reply-item-content">
                                                  <div className="reply-header">
                                                    <div className="reply-header-left">
                                                      <span className="reply-author">
                                                        {reply.user_name ||
                                                          reply.author_name}
                                                      </span>
                                                      <span className="reply-date">
                                                        {formatDate(
                                                          reply.created_at
                                                        )}
                                                      </span>
                                                    </div>
                                                    {(reply.user_id ===
                                                      user?.id ||
                                                      canReply) && (
                                                      <div className="action-menu-container">
                                                        <button
                                                          className={`btn btn-sm btn-menu-toggle ${
                                                            openReplyCommentMenuId ===
                                                            reply.id
                                                              ? 'menu-active'
                                                              : ''
                                                          }`}
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            const container =
                                                              e.currentTarget.closest(
                                                                '.action-menu-container'
                                                              );
                                                            if (container) {
                                                              container.classList.remove(
                                                                'menu-open-up'
                                                              );
                                                            }
                                                            setOpenReplyCommentMenuId(
                                                              openReplyCommentMenuId ===
                                                                reply.id
                                                                ? null
                                                                : reply.id
                                                            );
                                                          }}
                                                        >
                                                          <span className="menu-dots">
                                                            <span className="menu-dot"></span>
                                                            <span className="menu-dot"></span>
                                                            <span className="menu-dot"></span>
                                                          </span>
                                                        </button>
                                                        {openReplyCommentMenuId ===
                                                          reply.id && (
                                                          <div className="action-menu-dropdown">
                                                            {(reply.user_id ===
                                                              user?.id ||
                                                              canReply) && (
                                                              <button
                                                                className="action-menu-item action-menu-item-danger"
                                                                onClick={(
                                                                  e
                                                                ) => {
                                                                  e.stopPropagation();
                                                                  handleDeleteComment(
                                                                    reply.id
                                                                  );
                                                                  setOpenReplyCommentMenuId(
                                                                    null
                                                                  );
                                                                }}
                                                              >
                                                                삭제
                                                              </button>
                                                            )}
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                  <div className="reply-content">
                                                    {reply.content}
                                                  </div>
                                                  <div className="reply-actions">
                                                    <button
                                                      onClick={() =>
                                                        handleCommentLike(
                                                          reply.id
                                                        )
                                                      }
                                                      className={`comment-like-btn ${
                                                        reply.is_liked
                                                          ? 'liked'
                                                          : ''
                                                      }`}
                                                    >
                                                      👍 {reply.like_count || 0}
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                      {/* 대댓글 작성 폼 */}
                                      <div className="reply-form">
                                        <span className="reply-item-indicator">
                                          ㄴ
                                        </span>
                                        <div className="reply-form-wrapper">
                                          <div className="reply-input-wrapper">
                                            <textarea
                                              value={replyToCommentContent}
                                              onChange={(e) =>
                                                setReplyToCommentContent(
                                                  e.target.value
                                                )
                                              }
                                              placeholder="답글을 입력하세요..."
                                              className="reply-input"
                                              rows={2}
                                              maxLength={500}
                                            />
                                            <div className="reply-input-footer">
                                              <span className="reply-char-count">
                                                {replyToCommentContent.length}
                                                /500
                                              </span>
                                              <button
                                                onClick={() =>
                                                  handleReplyToCommentSubmit(
                                                    comment.id
                                                  )
                                                }
                                                className="reply-submit-icon-btn"
                                                disabled={
                                                  !replyToCommentContent.trim()
                                                }
                                              >
                                                <svg
                                                  className="send-icon"
                                                  width="16"
                                                  height="16"
                                                  viewBox="0 0 16 16"
                                                  fill="none"
                                                  xmlns="http://www.w3.org/2000/svg"
                                                  style={{
                                                    transform: 'rotate(180deg)',
                                                  }}
                                                >
                                                  <path
                                                    d="M2 8L14 2L10 8L14 14L2 8Z"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                  />
                                                </svg>
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* 답글 접기 버튼 */}
                                      <button
                                        onClick={() =>
                                          toggleReplies(comment.id)
                                        }
                                        className="reply-collapse-btn"
                                      >
                                        답글 접기 ∧
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
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
                      placeholder="댓글을 입력하세요..."
                      className="inquiry-comment-textarea"
                    />
                    <div className="comment-input-footer">
                      <span className="comment-char-count">
                        {commentContent.length}/500
                      </span>
                      <button
                        type="submit"
                        className="comment-submit-btn"
                        disabled={!commentContent.trim()}
                      >
                        <svg
                          className="send-icon"
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{ transform: 'rotate(180deg)' }}
                        >
                          <path
                            d="M2 8L14 2L10 8L14 14L2 8Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
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
                    <div className="inquiry-form-group inquiry-form-group-with-button">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        maxLength={500}
                        required
                        rows={6}
                        placeholder="답변 내용을 입력하세요 (500자 이내)"
                        className="inquiry-reply-textarea"
                      />
                      <div className="inquiry-form-group-footer">
                        <div className="inquiry-char-count">
                          {replyContent.length}/500
                        </div>
                        <button
                          type="submit"
                          className="inquiry-submit-button-inline"
                        >
                          등록하기
                        </button>
                      </div>
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
                    <div className="inquiry-form-group inquiry-form-group-with-button">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        maxLength={500}
                        required
                        rows={6}
                        placeholder="답변 내용을 입력하세요 (500자 이내)"
                        className="inquiry-reply-textarea"
                      />
                      <div className="inquiry-form-group-footer">
                        <button
                          type="button"
                          className="inquiry-cancel-button-small"
                          onClick={handleCancelReplyEdit}
                        >
                          취소
                        </button>
                        <div className="inquiry-form-group-footer-right">
                          <div className="inquiry-char-count">
                            {replyContent.length}/500
                          </div>
                          <button
                            type="submit"
                            className="inquiry-submit-button-inline"
                          >
                            수정
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
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
        </div>
        <div className="inquiry-content-section">
          <div className="inquiry-content-header">
            <div className="header-actions">
              <button
                className="inquiry-create-button"
                onClick={handleCreateInquiry}
              >
                <span>문의 작성</span>
              </button>
            </div>
          </div>
          {error && <div className="inquiry-error">{error}</div>}
          {inquiries.length === 0 ? (
            <div className="inquiry-empty">
              <p>등록된 문의가 없습니다.</p>
              <button
                className="inquiry-create-button"
                onClick={handleCreateInquiry}
              >
                <span>첫 문의 작성하기</span>
              </button>
            </div>
          ) : isSuperAdmin && inquiriesByClub ? (
            <div className="inquiry-list-by-club">
              {Object.entries(inquiriesByClub).map(
                ([clubName, clubInquiries]) => (
                  <div key={clubName} className="inquiry-club-section">
                    <h2 className="inquiry-club-title">{clubName}</h2>
                    <div className="inquiry-list">
                      {clubInquiries.map((inquiry) => {
                        return (
                          <div
                            key={inquiry.id}
                            className="inquiry-item"
                            onClick={() => handleViewInquiry(inquiry.id)}
                          >
                            <div className="inquiry-item-header">
                              <div className="inquiry-item-title-wrapper">
                                <h3>{inquiry.title}</h3>
                                {!inquiry.reply && (
                                  <span className="inquiry-pending-badge">
                                    답변대기
                                  </span>
                                )}
                              </div>
                              <div className="inquiry-item-header-right">
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
                                </div>
                                {/* 설정 버튼: 작성자 또는 운영진/슈퍼관리자 */}
                                {((inquiry.user_id === user?.id &&
                                  !inquiry.reply) ||
                                  inquiry.user_id === user?.id ||
                                  (canReply &&
                                    (user?.role === 'super_admin' ||
                                      inquiry.user_role !==
                                        'super_admin'))) && (
                                  <div className="inquiry-item-actions">
                                    <div
                                      className="action-menu-container"
                                      data-item-id={inquiry.id}
                                    >
                                      <button
                                        className={`btn btn-sm btn-menu-toggle ${
                                          openInquiryMenuId === inquiry.id
                                            ? 'menu-active'
                                            : ''
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenInquiryMenuId(
                                            openInquiryMenuId === inquiry.id
                                              ? null
                                              : inquiry.id
                                          );
                                        }}
                                      >
                                        <span className="menu-dots">
                                          <span className="menu-dot"></span>
                                          <span className="menu-dot"></span>
                                          <span className="menu-dot"></span>
                                        </span>
                                      </button>
                                      {openInquiryMenuId === inquiry.id && (
                                        <div className="action-menu-dropdown">
                                          {inquiry.user_id === user?.id &&
                                            !inquiry.reply && (
                                              <button
                                                className="action-menu-item"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleEditInquiry(inquiry);
                                                  setOpenInquiryMenuId(null);
                                                }}
                                              >
                                                수정
                                              </button>
                                            )}
                                          {(inquiry.user_id === user?.id ||
                                            (canReply &&
                                              (user?.role === 'super_admin' ||
                                                inquiry.user_role !==
                                                  'super_admin'))) && (
                                            <button
                                              className="action-menu-item action-menu-item-danger"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteInquiry(inquiry.id);
                                                setOpenInquiryMenuId(null);
                                              }}
                                            >
                                              삭제
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
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
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="inquiry-list">
              {inquiries.map((inquiry) => {
                return (
                  <div
                    key={inquiry.id}
                    className="inquiry-item"
                    onClick={() => handleViewInquiry(inquiry.id)}
                  >
                    <div className="inquiry-item-header">
                      <div className="inquiry-item-title-wrapper">
                        <h3>{inquiry.title}</h3>
                        {!inquiry.reply && (
                          <span className="inquiry-pending-badge">
                            답변대기
                          </span>
                        )}
                      </div>
                      <div className="inquiry-item-header-right">
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
                        </div>
                        {/* 설정 버튼: 작성자 또는 운영진/슈퍼관리자 */}
                        {((inquiry.user_id === user?.id && !inquiry.reply) ||
                          inquiry.user_id === user?.id ||
                          (canReply &&
                            (user?.role === 'super_admin' ||
                              inquiry.user_role !== 'super_admin'))) && (
                          <div className="inquiry-item-actions">
                            <div
                              className="action-menu-container"
                              data-item-id={inquiry.id}
                            >
                              <button
                                className={`btn btn-sm btn-menu-toggle ${
                                  openInquiryMenuId === inquiry.id
                                    ? 'menu-active'
                                    : ''
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenInquiryMenuId(
                                    openInquiryMenuId === inquiry.id
                                      ? null
                                      : inquiry.id
                                  );
                                }}
                              >
                                <span className="menu-dots">
                                  <span className="menu-dot"></span>
                                  <span className="menu-dot"></span>
                                  <span className="menu-dot"></span>
                                </span>
                              </button>
                              {openInquiryMenuId === inquiry.id && (
                                <div className="action-menu-dropdown">
                                  {inquiry.user_id === user?.id &&
                                    !inquiry.reply && (
                                      <button
                                        className="action-menu-item"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditInquiry(inquiry);
                                          setOpenInquiryMenuId(null);
                                        }}
                                      >
                                        수정
                                      </button>
                                    )}
                                  {(inquiry.user_id === user?.id ||
                                    (canReply &&
                                      (user?.role === 'super_admin' ||
                                        inquiry.user_role !==
                                          'super_admin'))) && (
                                    <button
                                      className="action-menu-item action-menu-item-danger"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteInquiry(inquiry.id);
                                        setOpenInquiryMenuId(null);
                                      }}
                                    >
                                      삭제
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inquiry;
