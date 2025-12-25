import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { postAPI } from '../services/api';
import PostForm from '../components/PostForm';
import PostDetail from '../components/PostDetail';
import './Board.css';
import './Members.css'; // action-menu 스타일 사용

const Board = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin: clubIsAdmin } = useClub();
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
  const [openPostMenuId, setOpenPostMenuId] = useState(null); // 게시글 메뉴 열림 상태

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = isSuperAdmin || clubIsAdmin;

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

  // 슈퍼관리자인 경우 클럽별로 게시글 분류
  const postsByClub = isSuperAdmin
    ? posts.reduce((acc, post) => {
        const clubName = post.club_name || '클럽 미지정';
        if (!acc[clubName]) {
          acc[clubName] = [];
        }
        acc[clubName].push(post);
        return acc;
      }, {})
    : null;

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
        <div className="header-actions">
          <button onClick={handleCreatePost} className="btn btn-primary">
            글쓰기
          </button>
        </div>
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
          {/* 슈퍼관리자인 경우 클럽별로 분류 표시 */}
          {isSuperAdmin && postsByClub ? (
            <div className="posts-list-by-club">
              {Object.entries(postsByClub).map(([clubName, clubPosts]) => (
                <div key={clubName} className="posts-club-section">
                  <h2 className="posts-club-title">{clubName}</h2>
                  <div className="posts-list">
                    {clubPosts.length === 0 ? (
                      <div className="no-posts">게시글이 없습니다.</div>
                    ) : (
                      clubPosts.map((post, index) => {
                        const isLastTwo = index >= clubPosts.length - 2;
                        return (
                          <div
                            key={post.id}
                            className="post-item"
                            onClick={() => handlePostClick(post)}
                          >
                            <div className="post-header">
                              <span className={`post-type ${post.post_type}`}>
                                {post.post_type === 'notice' ? '공지' : '자유'}
                              </span>
                              {post.is_global && (
                                <span className="global-badge">전체</span>
                              )}
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
                              <span className="post-author">
                                {post.author_name}
                              </span>
                              <span className="post-date">
                                {post.created_at}
                              </span>
                              <div className="post-stats">
                                <span>💬 {post.comment_count}</span>
                                <span>❤️ {post.like_count}</span>
                              </div>
                            </div>
                            {/* 수정/삭제 버튼: 본인이 작성했거나, 관리자이면서 슈퍼관리자가 작성한 글이 아닌 경우만 표시 */}
                            {(post.author_id === user?.id ||
                              (isAdmin &&
                                (user?.role === 'super_admin' ||
                                  post.author_role !== 'super_admin'))) && (
                              <div className="post-actions">
                                <div
                                  className={`action-menu-container ${
                                    isLastTwo ? 'menu-open-up' : ''
                                  }`}
                                  data-item-id={post.id}
                                >
                                  <button
                                    className="btn btn-sm btn-menu-toggle"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const button = e.currentTarget;
                                      const container = button.closest(
                                        '.action-menu-container'
                                      );
                                      const rect =
                                        button.getBoundingClientRect();
                                      const viewportHeight = window.innerHeight;
                                      const dropdownHeight = 100;
                                      const spaceBelow =
                                        viewportHeight - rect.bottom;

                                      const shouldOpenUp =
                                        isLastTwo ||
                                        spaceBelow < dropdownHeight;

                                      if (shouldOpenUp) {
                                        container.classList.add('menu-open-up');
                                      } else {
                                        container.classList.remove(
                                          'menu-open-up'
                                        );
                                      }

                                      setOpenPostMenuId(
                                        openPostMenuId === post.id
                                          ? null
                                          : post.id
                                      );
                                    }}
                                  >
                                    ⋯
                                  </button>
                                  {openPostMenuId === post.id && (
                                    <div className="action-menu-dropdown">
                                      <button
                                        className="action-menu-item"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditPost(post);
                                          setOpenPostMenuId(null);
                                        }}
                                      >
                                        수정
                                      </button>
                                      <button
                                        className="action-menu-item action-menu-item-danger"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePost(post.id);
                                          setOpenPostMenuId(null);
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
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="posts-list">
              {posts.length === 0 ? (
                <div className="no-posts">게시글이 없습니다.</div>
              ) : (
                posts.map((post, index) => {
                  const isLastTwo = index >= posts.length - 2;
                  return (
                    <div
                      key={post.id}
                      className="post-item"
                      onClick={() => handlePostClick(post)}
                    >
                      <div className="post-header">
                        <span className={`post-type ${post.post_type}`}>
                          {post.post_type === 'notice' ? '공지' : '자유'}
                        </span>
                        {post.is_global && (
                          <span className="global-badge">전체</span>
                        )}
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
                      {/* 수정/삭제 버튼: 본인이 작성했거나, 관리자이면서 슈퍼관리자가 작성한 글이 아닌 경우만 표시 */}
                      {(post.author_id === user?.id ||
                        (isAdmin &&
                          (user?.role === 'super_admin' ||
                            post.author_role !== 'super_admin'))) && (
                        <div className="post-actions">
                          <div
                            className={`action-menu-container ${
                              isLastTwo ? 'menu-open-up' : ''
                            }`}
                            data-item-id={post.id}
                          >
                            <button
                              className="btn btn-sm btn-menu-toggle"
                              onClick={(e) => {
                                e.stopPropagation();
                                const button = e.currentTarget;
                                const container = button.closest(
                                  '.action-menu-container'
                                );
                                const rect = button.getBoundingClientRect();
                                const viewportHeight = window.innerHeight;
                                const dropdownHeight = 100;
                                const spaceBelow = viewportHeight - rect.bottom;

                                const shouldOpenUp =
                                  isLastTwo || spaceBelow < dropdownHeight;

                                if (shouldOpenUp) {
                                  container.classList.add('menu-open-up');
                                } else {
                                  container.classList.remove('menu-open-up');
                                }

                                setOpenPostMenuId(
                                  openPostMenuId === post.id ? null : post.id
                                );
                              }}
                            >
                              ⋯
                            </button>
                            {openPostMenuId === post.id && (
                              <div className="action-menu-dropdown">
                                <button
                                  className="action-menu-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditPost(post);
                                    setOpenPostMenuId(null);
                                  }}
                                >
                                  수정
                                </button>
                                <button
                                  className="action-menu-item action-menu-item-danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePost(post.id);
                                    setOpenPostMenuId(null);
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
                  );
                })
              )}
            </div>
          )}

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
