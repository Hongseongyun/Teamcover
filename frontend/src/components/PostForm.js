import React, { useState, useEffect } from 'react';
import { postAPI } from '../services/api';
import './PostForm.css';

const PostForm = ({ post, onClose, isAdmin }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('free');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setPostType(post.post_type);
      setImages(post.images || []);
    }
  }, [post]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 이미지 파일만 허용
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }

    try {
      setUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('image', file);

      const response = await postAPI.uploadImage(formData);
      if (response.data.success) {
        const imageUrl = response.data.url;
        setImages([...images, imageUrl]);
      } else {
        setError(response.data.message || '이미지 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      setError('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const data = {
        title: title.trim(),
        content: content.trim(),
        post_type: postType,
        image_urls: images,
      };

      let response;
      if (post) {
        response = await postAPI.updatePost(post.id, data);
      } else {
        response = await postAPI.createPost(data);
      }

      if (response.data.success) {
        onClose();
      } else {
        setError(response.data.message || '게시글 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('게시글 저장 오류:', error);
      setError('게시글 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="post-form-overlay" onClick={onClose}>
      <div className="post-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="post-form-header">
          <h2>{post ? '게시글 수정' : '게시글 작성'}</h2>
          <button onClick={onClose} className="close-btn">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="post-form">
          {isAdmin && (
            <div className="form-group">
              <label>게시글 유형</label>
              <select
                value={postType}
                onChange={(e) => setPostType(e.target.value)}
                className="form-select"
              >
                <option value="free">자유게시판</option>
                <option value="notice">공지사항</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label>제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              placeholder="제목을 입력하세요"
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label>내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="form-textarea"
              placeholder="내용을 입력하세요"
              rows={10}
            />
          </div>

          <div className="form-group">
            <label>이미지</label>
            <div className="image-upload-area">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="image-input"
                id="image-upload"
                disabled={uploading}
              />
              <label htmlFor="image-upload" className="image-upload-btn">
                {uploading ? '업로드 중...' : '이미지 선택'}
              </label>
            </div>
            {images.length > 0 && (
              <div className="image-preview-list">
                {images.map((imageUrl, index) => (
                  <div key={index} className="image-preview-item">
                    <img
                      src={`${process.env.REACT_APP_API_URL}${imageUrl}`}
                      alt={`Preview ${index + 1}`}
                      className="image-preview"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="remove-image-btn"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              취소
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '저장 중...' : post ? '수정' : '작성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostForm;

