import React, { useState, useEffect } from 'react';
import { postAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import './PostDetail.css';

const PostDetail = ({ postId, onBack, onEdit, onDelete }) => {
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // 대댓글 작성 중인 댓글 ID
  const [replyContent, setReplyContent] = useState(''); // 대댓글 내용
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [repliesExpanded, setRepliesExpanded] = useState({}); // 각 댓글의 답글 펼침/접기 상태

  const { isAdmin: clubIsAdmin } = useClub();
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = isSuperAdmin || clubIsAdmin;

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [postId]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await postAPI.getPost(postId);
      if (response.data.success) {
        setPost(response.data.post);
        setIsLiked(response.data.post.is_liked);
        setLikeCount(response.data.post.like_count);
      } else {
        setError('게시글을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('게시글 조회 오류:', error);
      setError('게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await postAPI.getComments(postId);
      if (response.data.success) {
        // 좋아요 수 기준으로 정렬 (BEST 댓글을 상단에)
        const sortedComments = [...response.data.comments].sort((a, b) => {
          const aLikes = a.like_count || 0;
          const bLikes = b.like_count || 0;
          if (aLikes !== bLikes) {
            return bLikes - aLikes; // 좋아요 수 내림차순
          }
          // 좋아요 수가 같으면 최신순
          return new Date(b.created_at) - new Date(a.created_at);
        });
        setComments(sortedComments);
        // 모든 댓글의 답글을 접힌 상태로 초기화 (기본값)
        const expandedState = {};
        sortedComments.forEach((comment) => {
          expandedState[comment.id] = false;
        });
        setRepliesExpanded(expandedState);
      }
    } catch (error) {
      console.error('댓글 조회 오류:', error);
    }
  };

  const handleLike = async () => {
    try {
      const response = await postAPI.toggleLike(postId);
      if (response.data.success) {
        setIsLiked(response.data.action === 'liked');
        setLikeCount(response.data.like_count);
      }
    } catch (error) {
      console.error('좋아요 오류:', error);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setCommentLoading(true);
      const response = await postAPI.createComment(postId, {
        content: newComment.trim(),
      });

      if (response.data.success) {
        setNewComment('');
        fetchComments();
      } else {
        alert(response.data.message || '댓글 작성에 실패했습니다.');
      }
    } catch (error) {
      console.error('댓글 작성 오류:', error);
      alert('댓글 작성에 실패했습니다.');
    } finally {
      setCommentLoading(false);
    }
  };

  const handleReplySubmit = async (parentId) => {
    if (!replyContent.trim()) return;

    try {
      setCommentLoading(true);
      const response = await postAPI.createComment(postId, {
        content: replyContent.trim(),
        parent_id: parentId,
      });

      if (response.data.success) {
        setReplyContent('');
        setReplyingTo(null);
        fetchComments();
      } else {
        alert(response.data.message || '대댓글 작성에 실패했습니다.');
      }
    } catch (error) {
      console.error('대댓글 작성 오류:', error);
      alert('대댓글 작성에 실패했습니다.');
    } finally {
      setCommentLoading(false);
    }
  };

  const toggleReplies = (commentId) => {
    const willExpand = !repliesExpanded[commentId];
    setRepliesExpanded((prev) => ({
      ...prev,
      [commentId]: willExpand,
    }));
    // 답글을 펼칠 때 답글 작성 폼도 함께 열기, 접을 때는 닫기
    if (willExpand) {
      setReplyingTo(commentId);
    } else {
      if (replyingTo === commentId) {
        setReplyingTo(null);
      }
    }
  };

  // BEST 댓글인지 확인 (좋아요 수가 가장 많은 댓글)
  const isBestComment = (comment) => {
    if (comments.length === 0) return false;
    const maxLikes = Math.max(...comments.map((c) => c.like_count || 0));
    return (comment.like_count || 0) === maxLikes && maxLikes > 0;
  };

  const handleCommentLike = async (commentId) => {
    try {
      const response = await postAPI.toggleCommentLike(commentId);
      if (response.data.success) {
        // 댓글 목록을 다시 불러와서 업데이트된 좋아요 수 반영
        fetchComments();
      }
    } catch (error) {
      console.error('댓글 좋아요 오류:', error);
      alert('댓글 좋아요 처리에 실패했습니다.');
    }
  };

  const handleCommentDelete = async (commentId) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await postAPI.deleteComment(commentId);
      if (response.data.success) {
        fetchComments();
      } else {
        alert(response.data.message || '댓글 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="post-detail-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="post-detail-container">
        <div className="error-message">
          {error || '게시글을 찾을 수 없습니다.'}
        </div>
        <button onClick={onBack} className="btn-back">
          목록으로
        </button>
      </div>
    );
  }

  return (
    <div className="post-detail-container">
      <button onClick={onBack} className="btn-back">
        ← 목록으로
      </button>

      <article className="post-detail">
        <div className="post-detail-header">
          <div className="post-detail-meta">
            <span className={`post-type ${post.post_type}`}>
              {post.post_type === 'notice' ? '공지' : '자유'}
            </span>
            <h1 className="post-detail-title">{post.title}</h1>
          </div>
          <div className="post-detail-info">
            <span className="post-author">{post.author_name}</span>
            <span className="post-date">{post.created_at}</span>
            {/* 수정/삭제 버튼: 본인이 작성했거나, 관리자이면서 슈퍼관리자가 작성한 글이 아닌 경우만 표시 */}
            {(post.author_id === user?.id ||
              (isAdmin &&
                (user?.role === 'super_admin' ||
                  post.author_role !== 'super_admin'))) && (
              <div className="post-detail-actions">
                <button onClick={() => onEdit(post)} className="btn-edit">
                  수정
                </button>
                <button
                  onClick={() => onDelete(post.id)}
                  className="btn-delete"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="post-detail-content">
          <div className="post-text">{post.content}</div>
          {post.images && post.images.length > 0 && (
            <div className="post-images">
              {post.images.map((imageUrl, index) => (
                <img
                  key={index}
                  src={`${process.env.REACT_APP_API_URL}${imageUrl}`}
                  alt={`게시글 이미지 ${index + 1}`}
                  className="post-image"
                />
              ))}
            </div>
          )}
        </div>

        <div className="post-detail-footer">
          <button
            onClick={handleLike}
            className={`like-btn ${isLiked ? 'liked' : ''}`}
          >
            {isLiked ? '❤️' : '🤍'} {likeCount}
          </button>
        </div>
      </article>

      <section className="comments-section">
        <h2 className="comments-title">댓글 ({comments.length})</h2>

        <form onSubmit={handleCommentSubmit} className="comment-form">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={
              user
                ? '댓글을 입력하세요...'
                : '댓글을 남기려면 로그인이 필요합니다.'
            }
            className="comment-input"
            rows={3}
            disabled={!user}
            maxLength={500}
          />
          <div className="comment-input-footer">
            <span className="comment-char-count">{newComment.length}/500</span>
            <button
              type="submit"
              className="comment-submit-btn"
              disabled={commentLoading || !newComment.trim() || !user}
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

        <div className="comments-list">
          {comments.length === 0 ? (
            <div className="no-comments">댓글이 없습니다.</div>
          ) : (
            comments.map((comment) => {
              const replyCount = comment.replies ? comment.replies.length : 0;
              const isExpanded = repliesExpanded[comment.id] === true;

              return (
                <div
                  key={comment.id}
                  className={`comment-item ${
                    isBestComment(comment) ? 'best-comment' : ''
                  }`}
                >
                  {isBestComment(comment) && (
                    <span className="best-badge">BEST</span>
                  )}
                  <div className="comment-header">
                    <span className="comment-author">
                      {comment.author_name}
                    </span>
                    <span className="comment-date">{comment.created_at}</span>
                  </div>
                  <div className="comment-content">{comment.content}</div>
                  <div className="comment-actions">
                    <button
                      onClick={() => {
                        // 답글 버튼 클릭 시 답글 펼치기/접기
                        toggleReplies(comment.id);
                      }}
                      className="comment-reply-btn"
                    >
                      답글 {replyCount > 0 && replyCount}
                    </button>
                    <button
                      onClick={() => handleCommentLike(comment.id)}
                      className={`comment-like-btn ${
                        comment.is_liked ? 'liked' : ''
                      }`}
                    >
                      👍 {comment.like_count || 0}
                    </button>
                    {(comment.author_id === user?.id || isAdmin) && (
                      <button
                        onClick={() => handleCommentDelete(comment.id)}
                        className="comment-delete-btn"
                      >
                        삭제
                      </button>
                    )}
                  </div>

                  {/* 대댓글 목록 및 입력창 */}
                  {isExpanded && (
                    <div className="replies-section">
                      <div className="replies-content">
                        {/* 대댓글 목록 */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="replies-list">
                            {comment.replies.map((reply) => (
                              <div key={reply.id} className="reply-item">
                                <span className="reply-item-indicator">ㄴ</span>
                                <div className="reply-item-content">
                                  <div className="reply-header">
                                    <span className="reply-author">
                                      {reply.author_name}
                                    </span>
                                    <span className="reply-date">
                                      {reply.created_at}
                                    </span>
                                  </div>
                                  <div className="reply-content">
                                    {reply.content}
                                  </div>
                                  <div className="reply-actions">
                                    <button
                                      onClick={() =>
                                        handleCommentLike(reply.id)
                                      }
                                      className={`comment-like-btn ${
                                        reply.is_liked ? 'liked' : ''
                                      }`}
                                    >
                                      👍 {reply.like_count || 0}
                                    </button>
                                    {(reply.author_id === user?.id ||
                                      isAdmin) && (
                                      <button
                                        onClick={() =>
                                          handleCommentDelete(reply.id)
                                        }
                                        className="comment-delete-btn"
                                      >
                                        삭제
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 대댓글 작성 폼 */}
                        <div className="reply-form">
                          <span className="reply-item-indicator">ㄴ</span>
                          <div className="reply-form-wrapper">
                            <div className="reply-input-wrapper">
                              <textarea
                                value={replyContent}
                                onChange={(e) =>
                                  setReplyContent(e.target.value)
                                }
                                placeholder={
                                  user
                                    ? '답글을 입력하세요...'
                                    : '댓글을 남기려면 로그인이 필요합니다.'
                                }
                                className="reply-input"
                                rows={2}
                                maxLength={500}
                                disabled={!user}
                              />
                              <div className="reply-input-footer">
                                <span className="reply-char-count">
                                  {replyContent.length}/500
                                </span>
                                <button
                                  onClick={() => handleReplySubmit(comment.id)}
                                  className="reply-submit-icon-btn"
                                  disabled={
                                    commentLoading ||
                                    !replyContent.trim() ||
                                    !user
                                  }
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
                            </div>
                          </div>
                        </div>

                        {/* 답글 접기 버튼 */}
                        <button
                          onClick={() => toggleReplies(comment.id)}
                          className="reply-collapse-btn"
                        >
                          답글 접기 ∧
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default PostDetail;
