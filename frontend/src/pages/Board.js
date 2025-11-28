import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { postAPI } from '../services/api';
import PostForm from '../components/PostForm';
import PostDetail from '../components/PostDetail';
import './Board.css';

const Board = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [postType, setPostType] = useState('all'); // 'all', 'free', 'notice'
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total: 0,
    pages: 0,
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  useEffect(() => {
    fetchPosts();
  }, [postType, pagination.page]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await postAPI.getPosts({
        type: postType,
        page: pagination.page,
        per_page: pagination.per_page,
      });

      if (response.data.success) {
        // 공지사항을 상단에 고정 (프론트엔드에서도 정렬)
        const sortedPosts = [...response.data.posts].sort((a, b) => {
          // 공지사항을 먼저
          if (a.post_type === 'notice' && b.post_type !== 'notice') return -1;
          if (a.post_type !== 'notice' && b.post_type === 'notice') return 1;
          // 같은 타입이면 최신순
          return new Date(b.created_at) - new Date(a.created_at);
        });
        setPosts(sortedPosts);
        setPagination(response.data.pagination);
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

  const handleCreatePost = () => {
    setEditingPost(null);
    setShowPostForm(true);
  };

  const handleEditPost = (post) => {
    // 먼저 목록으로 돌아가기
    setSelectedPost(null);
    // 모달 표시를 위해 약간의 지연 (렌더링 완료 후)
    setTimeout(() => {
      setEditingPost(post);
      setShowPostForm(true);
    }, 50);
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await postAPI.deletePost(postId);
      if (response.data.success) {
        // 상세 보기에서 삭제한 경우 목록으로 돌아가기
        if (selectedPost && selectedPost.id === postId) {
          setSelectedPost(null);
        }
        fetchPosts();
      } else {
        alert(response.data.message || '게시글 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('게시글 삭제 오류:', error);
      alert('게시글 삭제에 실패했습니다.');
    }
  };

  const handlePostFormClose = () => {
    setShowPostForm(false);
    setEditingPost(null);
    fetchPosts();
  };

  const handlePostClick = (post) => {
    setSelectedPost(post);
  };

  const handleBackToList = () => {
    setSelectedPost(null);
    fetchPosts();
  };

  if (selectedPost) {
    return (
      <PostDetail
        postId={selectedPost.id}
        onBack={handleBackToList}
        onEdit={handleEditPost}
        onDelete={handleDeletePost}
      />
    );
  }

  return (
    <div className="board-container">
      <div className="board-header">
        <h1>게시판</h1>
        <button onClick={handleCreatePost} className="btn-primary">
          글쓰기
        </button>
      </div>

      <div className="board-tabs">
        <button
          className={`tab-button ${postType === 'all' ? 'active' : ''}`}
          onClick={() => {
            setPostType('all');
            setPagination({ ...pagination, page: 1 });
          }}
        >
          전체
        </button>
        <button
          className={`tab-button ${postType === 'notice' ? 'active' : ''}`}
          onClick={() => {
            setPostType('notice');
            setPagination({ ...pagination, page: 1 });
          }}
        >
          공지사항
        </button>
        <button
          className={`tab-button ${postType === 'free' ? 'active' : ''}`}
          onClick={() => {
            setPostType('free');
            setPagination({ ...pagination, page: 1 });
          }}
        >
          자유게시판
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <>
          <div className="posts-list">
            {posts.length === 0 ? (
              <div className="no-posts">게시글이 없습니다.</div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="post-item"
                  onClick={() => handlePostClick(post)}
                >
                  <div className="post-header">
                    <span className={`post-type ${post.post_type}`}>
                      {post.post_type === 'notice' ? '공지' : '자유'}
                    </span>
                    <h3 className="post-title">{post.title}</h3>
                    {isAdmin && post.post_type === 'notice' && (
                      <span className="admin-badge">운영진</span>
                    )}
                  </div>
                  <div className="post-content-preview">
                    {post.content.length > 100
                      ? `${post.content.substring(0, 100)}...`
                      : post.content}
                  </div>
                  {post.images && post.images.length > 0 && (
                    <div className="post-images-preview">
                      <span className="image-count">
                        📷 {post.images.length}
                      </span>
                    </div>
                  )}
                  <div className="post-footer">
                    <span className="post-author">{post.author_name}</span>
                    <span className="post-date">{post.created_at}</span>
                    <div className="post-stats">
                      <span>💬 {post.comment_count}</span>
                      <span>❤️ {post.like_count}</span>
                    </div>
                  </div>
                  {(post.author_id === user?.id || isAdmin) && (
                    <div className="post-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPost(post);
                        }}
                        className="btn-edit"
                      >
                        수정
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePost(post.id);
                        }}
                        className="btn-delete"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page - 1 })
                }
                disabled={pagination.page === 1}
              >
                이전
              </button>
              <span>
                {pagination.page} / {pagination.pages}
              </span>
              <button
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page + 1 })
                }
                disabled={pagination.page === pagination.pages}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {showPostForm && (
        <PostForm
          post={editingPost}
          onClose={handlePostFormClose}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};

export default Board;
