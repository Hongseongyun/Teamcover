from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from models import db, User, Post, PostImage, Comment, CommentLike, Like
from sqlalchemy import case
import os
import uuid
from werkzeug.utils import secure_filename
from utils.club_helpers import get_current_club_id, require_club_membership, check_club_permission

# 게시판 Blueprint
posts_bp = Blueprint('posts', __name__, url_prefix='/api/posts')

# 파일 업로드 설정
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'posts')

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@posts_bp.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = make_response()
        from flask import current_app
        allowed_origins = current_app.config.get('CORS_ALLOWED_ORIGINS', [])
        request_origin = request.headers.get('Origin')
        if request_origin and request_origin in allowed_origins:
            response.headers.add("Access-Control-Allow-Origin", request_origin)
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization,X-Requested-With,X-Club-Id,X-Privacy-Token")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

# 게시글 목록 조회
@posts_bp.route('', methods=['GET'])
@jwt_required()
def get_posts():
    """게시글 목록 조회 (공지사항 상단 고정)"""
    try:
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
        
        # 슈퍼관리자는 가입 여부 확인 생략, 일반 사용자는 가입 확인 필요
        try:
            current_user = User.query.get(int(user_id))
            if not current_user:
                return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'}), 404
            
            is_super_admin = current_user.role == 'super_admin'
            
            # 슈퍼관리자가 아닌 경우에만 클럽 가입 확인
            if not is_super_admin:
                is_member, result = require_club_membership(int(user_id), club_id)
                if not is_member:
                    return jsonify({'success': False, 'message': result}), 403
        except (ValueError, TypeError) as e:
            return jsonify({'success': False, 'message': f'유효하지 않은 사용자 ID입니다: {str(e)}'}), 400
        
        post_type = request.args.get('type', 'all')  # 'all', 'free', 'notice'
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        # 클럽별 게시글 + 전체 게시글 조회 (club_id가 null인 게시글은 모든 클럽이 볼 수 있음)
        query = Post.query.filter(
            (Post.club_id == club_id) | (Post.club_id.is_(None))
        )
        
        if post_type != 'all':
            query = query.filter_by(post_type=post_type)
            # 특정 타입만 조회하는 경우는 최신순 정렬
            query = query.order_by(Post.created_at.desc())
        else:
            # 전체 조회 시: 공지사항을 먼저, 그 다음 일반 게시글
            # 각 그룹 내에서는 최신순 정렬
            query = query.order_by(
                case(
                    (Post.post_type == 'notice', 0),
                    else_=1
                ),
                Post.created_at.desc()
            )
        
        # 페이지네이션
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        posts = pagination.items
        
        return jsonify({
            'success': True,
            'posts': [post.to_dict() for post in posts],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'게시글 목록 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 게시글 상세 조회
@posts_bp.route('/<int:post_id>', methods=['GET'])
@jwt_required()
def get_post(post_id):
    """게시글 상세 조회"""
    try:
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        # 클럽별 게시글 또는 전체 게시글 조회
        post = Post.query.filter(
            Post.id == post_id,
            ((Post.club_id == club_id) | (Post.club_id.is_(None)))
        ).first_or_404()
        
        user_id = get_jwt_identity()
        # 슈퍼관리자는 가입 여부 확인 생략, 일반 사용자는 가입 확인 필요
        is_super_admin = False
        if user_id:
            current_user = User.query.get(int(user_id))
            is_super_admin = current_user and current_user.role == 'super_admin'
        
        # 전체 게시글이 아닌 경우에만 클럽 가입 확인 (슈퍼관리자 제외)
        if post.club_id is not None and user_id and not is_super_admin:
            is_member, result = require_club_membership(int(user_id), club_id)
            if not is_member:
                return jsonify({'success': False, 'message': result}), 403
        
        # 현재 사용자가 좋아요를 눌렀는지 확인
        is_liked = Like.query.filter_by(post_id=post_id, user_id=int(user_id)).first() is not None if user_id else False
        
        post_dict = post.to_dict()
        post_dict['is_liked'] = is_liked
        
        return jsonify({
            'success': True,
            'post': post_dict
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'게시글 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 게시글 작성
@posts_bp.route('', methods=['POST'])
@jwt_required()
def create_post():
    """게시글 작성"""
    try:
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다.'}), 404
        
        # 슈퍼관리자는 가입 여부 확인 생략, 일반 사용자는 가입 확인 필요
        is_super_admin = user.role == 'super_admin'
        
        if not is_super_admin:
            # 클럽 가입 확인
            is_member, result = require_club_membership(user_id, club_id)
            if not is_member:
                return jsonify({'success': False, 'message': result}), 403
        
        data = request.get_json()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        post_type = data.get('post_type', 'free')  # 'free' or 'notice'
        is_global = data.get('is_global', False)  # 전체 게시글 여부
        image_urls = data.get('image_urls', [])  # 이미지 URL 리스트
        
        # 전체 게시글 작성 권한 확인 (슈퍼관리자만 가능)
        if is_global:
            if user.role != 'super_admin':
                return jsonify({'success': False, 'message': '전체 게시글은 슈퍼관리자만 작성할 수 있습니다.'}), 403
        
        # 권한 확인: 공지사항은 클럽 내 운영진만 작성 가능 (슈퍼관리자 제외)
        if post_type == 'notice' and not is_super_admin:
            has_permission, result = check_club_permission(user_id, club_id, 'admin')
            if not has_permission:
                return jsonify({'success': False, 'message': '공지사항은 운영진만 작성할 수 있습니다.'}), 403
        
        if not title or not content:
            return jsonify({'success': False, 'message': '제목과 내용을 입력해주세요.'}), 400
        
        # 게시글 생성 (전체 게시글인 경우 club_id를 null로 설정)
        post = Post(
            title=title,
            content=content,
            post_type=post_type,
            author_id=user_id,
            club_id=None if is_global else club_id
        )
        db.session.add(post)
        db.session.flush()  # ID를 얻기 위해 flush
        
        # 이미지 추가
        for image_url in image_urls:
            if image_url:
                post_image = PostImage(
                    post_id=post.id,
                    url=image_url
                )
                db.session.add(post_image)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '게시글이 작성되었습니다.',
            'post': post.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'게시글 작성 중 오류가 발생했습니다: {str(e)}'}), 500

# 게시글 수정
@posts_bp.route('/<int:post_id>', methods=['PUT'])
@jwt_required()
def update_post(post_id):
    """게시글 수정"""
    try:
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        # 클럽별 게시글 또는 전체 게시글 조회
        post = Post.query.filter(
            Post.id == post_id,
            ((Post.club_id == club_id) | (Post.club_id.is_(None)))
        ).first_or_404()
        
        # 권한 확인: 작성자이거나 운영진만 수정 가능
        if post.author_id != user_id and user.role not in ['admin', 'super_admin']:
            return jsonify({'success': False, 'message': '게시글을 수정할 권한이 없습니다.'}), 403
        
        data = request.get_json()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        is_global = data.get('is_global', False)  # 전체 게시글 여부
        image_urls = data.get('image_urls', [])
        
        # 전체 게시글 변경 권한 확인 (슈퍼관리자만 가능)
        if is_global != (post.club_id is None):
            if user.role != 'super_admin':
                return jsonify({'success': False, 'message': '전체 게시글 설정은 슈퍼관리자만 변경할 수 있습니다.'}), 403
        
        if not title or not content:
            return jsonify({'success': False, 'message': '제목과 내용을 입력해주세요.'}), 400
        
        # 게시글 수정
        post.title = title
        post.content = content
        post.club_id = None if is_global else club_id
        post.updated_at = datetime.utcnow()
        
        # 기존 이미지 삭제
        PostImage.query.filter_by(post_id=post_id).delete()
        
        # 새 이미지 추가
        for image_url in image_urls:
            if image_url:
                post_image = PostImage(
                    post_id=post.id,
                    url=image_url
                )
                db.session.add(post_image)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '게시글이 수정되었습니다.',
            'post': post.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'게시글 수정 중 오류가 발생했습니다: {str(e)}'}), 500

# 게시글 삭제
@posts_bp.route('/<int:post_id>', methods=['DELETE'])
@jwt_required()
def delete_post(post_id):
    """게시글 삭제"""
    try:
        # 클럽 필터링
        club_id = get_current_club_id()
        if not club_id:
            return jsonify({'success': False, 'message': '클럽이 선택되지 않았습니다.'}), 400
        
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        # 클럽별 게시글 또는 전체 게시글 조회
        post = Post.query.filter(
            Post.id == post_id,
            ((Post.club_id == club_id) | (Post.club_id.is_(None)))
        ).first_or_404()
        
        # 권한 확인: 작성자이거나 운영진만 삭제 가능
        if post.author_id != user_id and user.role not in ['admin', 'super_admin']:
            return jsonify({'success': False, 'message': '게시글을 삭제할 권한이 없습니다.'}), 403
        
        db.session.delete(post)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '게시글이 삭제되었습니다.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'게시글 삭제 중 오류가 발생했습니다: {str(e)}'}), 500

# 댓글 목록 조회
@posts_bp.route('/<int:post_id>/comments', methods=['GET'])
@jwt_required()
def get_comments(post_id):
    """댓글 목록 조회 (업 수 기준 정렬)"""
    try:
        user_id = int(get_jwt_identity())
        
        # 부모 댓글만 조회 (대댓글 제외)
        parent_comments = Comment.query.filter_by(post_id=post_id, parent_id=None).all()
        
        # 업 수 기준으로 정렬 (업 수가 같으면 최신순)
        comments_with_likes = []
        for comment in parent_comments:
            like_count = len(comment.likes)
            comments_with_likes.append((comment, like_count))
        
        # 업 수 내림차순, 같으면 최신순
        comments_with_likes.sort(key=lambda x: (-x[1], x[0].created_at))
        sorted_comments = [c[0] for c in comments_with_likes]
        
        # 각 댓글의 좋아요 여부 확인
        comments_data = []
        for comment in sorted_comments:
            comment_dict = comment.to_dict()
            # 현재 사용자가 좋아요를 눌렀는지 확인
            is_liked = CommentLike.query.filter_by(comment_id=comment.id, user_id=user_id).first() is not None
            comment_dict['is_liked'] = is_liked
            # 좋아요 수도 다시 계산 (to_dict에서 계산된 값 사용)
            comment_like_count = CommentLike.query.filter_by(comment_id=comment.id).count()
            comment_dict['like_count'] = comment_like_count
            # 대댓글도 좋아요 여부 및 좋아요 수 확인
            for reply in comment_dict.get('replies', []):
                reply_is_liked = CommentLike.query.filter_by(comment_id=reply['id'], user_id=user_id).first() is not None
                reply['is_liked'] = reply_is_liked
                # 대댓글의 좋아요 수도 다시 계산 (to_dict에서 계산된 값 사용)
                reply_like_count = CommentLike.query.filter_by(comment_id=reply['id']).count()
                reply['like_count'] = reply_like_count
            comments_data.append(comment_dict)
        
        return jsonify({
            'success': True,
            'comments': comments_data
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'댓글 목록 조회 중 오류가 발생했습니다: {str(e)}'}), 500

# 댓글 작성
@posts_bp.route('/<int:post_id>/comments', methods=['POST'])
@jwt_required()
def create_comment(post_id):
    """댓글 작성 (대댓글 지원)"""
    try:
        user_id = int(get_jwt_identity())
        post = Post.query.get_or_404(post_id)
        
        data = request.get_json()
        content = data.get('content', '').strip()
        parent_id = data.get('parent_id')  # 대댓글인 경우 부모 댓글 ID
        
        if not content:
            return jsonify({'success': False, 'message': '댓글 내용을 입력해주세요.'}), 400
        
        # 대댓글인 경우 부모 댓글 확인
        if parent_id:
            parent_comment = Comment.query.filter_by(id=parent_id, post_id=post_id).first()
            if not parent_comment:
                return jsonify({'success': False, 'message': '부모 댓글을 찾을 수 없습니다.'}), 404
        
        comment = Comment(
            post_id=post_id,
            author_id=user_id,
            parent_id=parent_id,
            content=content
        )
        db.session.add(comment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '댓글이 작성되었습니다.',
            'comment': comment.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'댓글 작성 중 오류가 발생했습니다: {str(e)}'}), 500

# 댓글 수정
@posts_bp.route('/comments/<int:comment_id>', methods=['PUT'])
@jwt_required()
def update_comment(comment_id):
    """댓글 수정"""
    try:
        user_id = int(get_jwt_identity())
        comment = Comment.query.get_or_404(comment_id)
        
        # 권한 확인: 작성자만 수정 가능
        if comment.author_id != user_id:
            return jsonify({'success': False, 'message': '댓글을 수정할 권한이 없습니다.'}), 403
        
        data = request.get_json()
        content = data.get('content', '').strip()
        
        if not content:
            return jsonify({'success': False, 'message': '댓글 내용을 입력해주세요.'}), 400
        
        comment.content = content
        comment.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '댓글이 수정되었습니다.',
            'comment': comment.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'댓글 수정 중 오류가 발생했습니다: {str(e)}'}), 500

# 댓글 삭제
@posts_bp.route('/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    """댓글 삭제"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        comment = Comment.query.get_or_404(comment_id)
        
        # 권한 확인: 작성자이거나 운영진만 삭제 가능
        if comment.author_id != user_id and user.role not in ['admin', 'super_admin']:
            return jsonify({'success': False, 'message': '댓글을 삭제할 권한이 없습니다.'}), 403
        
        db.session.delete(comment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '댓글이 삭제되었습니다.'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'댓글 삭제 중 오류가 발생했습니다: {str(e)}'}), 500

# 좋아요 토글
@posts_bp.route('/<int:post_id>/like', methods=['POST'])
@jwt_required()
def toggle_like(post_id):
    """좋아요 토글"""
    try:
        user_id = int(get_jwt_identity())
        post = Post.query.get_or_404(post_id)
        
        # 기존 좋아요 확인
        existing_like = Like.query.filter_by(post_id=post_id, user_id=user_id).first()
        
        if existing_like:
            # 좋아요 취소
            db.session.delete(existing_like)
            action = 'unliked'
        else:
            # 좋아요 추가
            like = Like(post_id=post_id, user_id=user_id)
            db.session.add(like)
            action = 'liked'
        
        db.session.commit()
        
        # 업데이트된 좋아요 수 반환
        like_count = Like.query.filter_by(post_id=post_id).count()
        
        return jsonify({
            'success': True,
            'message': f'좋아요가 {"취소" if action == "unliked" else "추가"}되었습니다.',
            'action': action,
            'like_count': like_count
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'좋아요 처리 중 오류가 발생했습니다: {str(e)}'}), 500

# 댓글 좋아요 토글
@posts_bp.route('/comments/<int:comment_id>/like', methods=['POST'])
@jwt_required()
def toggle_comment_like(comment_id):
    """댓글 좋아요(업) 토글"""
    try:
        user_id = int(get_jwt_identity())
        comment = Comment.query.get_or_404(comment_id)
        
        # 기존 좋아요 확인
        existing_like = CommentLike.query.filter_by(comment_id=comment_id, user_id=user_id).first()
        
        if existing_like:
            # 좋아요 취소
            db.session.delete(existing_like)
            action = 'unliked'
        else:
            # 좋아요 추가
            like = CommentLike(comment_id=comment_id, user_id=user_id)
            db.session.add(like)
            action = 'liked'
        
        db.session.commit()
        
        # 업데이트된 좋아요 수 반환
        like_count = CommentLike.query.filter_by(comment_id=comment_id).count()
        
        return jsonify({
            'success': True,
            'message': f'업이 {"취소" if action == "unliked" else "추가"}되었습니다.',
            'action': action,
            'like_count': like_count
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'댓글 좋아요 처리 중 오류가 발생했습니다: {str(e)}'}), 500

# 이미지 업로드
@posts_bp.route('/upload-image', methods=['POST'])
@jwt_required()
def upload_image():
    """이미지 업로드"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'message': '이미지 파일이 없습니다.'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'message': '선택된 파일이 없습니다.'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': '허용되지 않은 파일 형식입니다.'}), 400
        
        # 파일 저장
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4()}_{filename}"
        
        # 업로드 폴더 생성
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        file_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        file.save(file_path)
        
        # URL 반환 (실제 배포 시에는 CDN URL로 변경 필요)
        image_url = f"/uploads/posts/{unique_filename}"
        
        return jsonify({
            'success': True,
            'message': '이미지가 업로드되었습니다.',
            'url': image_url
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'이미지 업로드 중 오류가 발생했습니다: {str(e)}'}), 500

