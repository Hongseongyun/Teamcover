import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { authAPI, clubAPI } from '../services/api';
import '../pages/Login.css';

// 전역 변수로 처리 상태 관리 (컴포넌트 재렌더링과 무관)
let isProcessing = false;

const GoogleAuthCallback = () => {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuth();
  const { loadClubs } = useClub();
  const [status, setStatus] = useState('처리 중...');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [showClubSelectModal, setShowClubSelectModal] = useState(false);
  const [availableClubs, setAvailableClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState('');
  const [loadingClubs, setLoadingClubs] = useState(false);
  const [clubSelectionData, setClubSelectionData] = useState(null);
  const [showApprovalPendingModal, setShowApprovalPendingModal] =
    useState(false);

  const loadAvailableClubs = useCallback(async () => {
    setLoadingClubs(true);
    try {
      const response = await clubAPI.getAvailableClubs();
      if (response.data.success) {
        setAvailableClubs(response.data.clubs);
      }
    } catch (error) {
      console.error('Failed to load clubs:', error);
      alert('클럽 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoadingClubs(false);
    }
  }, []);

  useEffect(() => {
    const handleGoogleCallback = async () => {
      // 이미 처리 중이면 무시
      if (isProcessing) {
        console.log('Already processing, skipping...');
        return;
      }

      isProcessing = true;
      setStatus('Google 로그인 처리 중...');

      try {
        console.log('Starting Google callback processing...');

        // URL에서 authorization code와 state 추출 (안전한 처리)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        console.log('URL params - code:', code ? 'present' : 'missing');
        console.log(
          'URL params - state:',
          state ? state.substring(0, 20) + '...' : 'missing'
        );

        if (!code) {
          throw new Error('Authorization code not found');
        }

        console.log('Processing code:', code.substring(0, 10) + '...');
        setStatus('토큰 교환 중...');

        // 현재 origin 가져오기
        const currentOrigin = window.location.origin;
        console.log('Current origin:', currentOrigin);

        // state에서 클럽 ID 가져오기 (회원가입 시 선택한 클럽)
        let clubId = null;
        if (state) {
          try {
            const decodedState = decodeURIComponent(state);
            // JSON 형식인지 확인
            if (decodedState.startsWith('{') && decodedState.endsWith('}')) {
              const stateObj = JSON.parse(decodedState);
              clubId = stateObj.club_id || null;
            }
          } catch (error) {
            console.warn('Failed to parse state for club_id:', error);
          }
        }

        // sessionStorage에서도 클럽 ID 가져오기 (백업용)
        const pendingClubId = sessionStorage.getItem('pending_club_id');
        if (pendingClubId) {
          sessionStorage.removeItem('pending_club_id');
          // state에 없으면 sessionStorage에서 가져온 값 사용
          if (!clubId) {
            clubId = parseInt(pendingClubId);
          }
        }

        // 백엔드로 코드를 전송하여 토큰 교환 (origin과 club_id도 함께 전송)
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/auth/google/callback`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code,
              origin: currentOrigin, // origin 정보 추가
              club_id: clubId, // 선택한 클럽 ID
            }),
          }
        );

        const data = await response.json();
        console.log('Backend response:', data);
        console.log('needs_club_selection:', data.needs_club_selection);

        if (data.success) {
          setStatus('로그인 처리 중...');

          // state에 저장된 원래 페이지 정보 (JSON 형식일 수 있음)
          let redirectTo = '/';
          if (state) {
            try {
              const decodedState = decodeURIComponent(state);
              // JSON 형식인지 확인
              if (decodedState.startsWith('{') && decodedState.endsWith('}')) {
                const stateObj = JSON.parse(decodedState);
                redirectTo = stateObj.from || '/';
              } else {
                // 일반 문자열인 경우
                redirectTo = decodedState;
              }
            } catch (error) {
              console.warn('Failed to decode state, using default:', error);
              redirectTo = '/';
            }
          }

          // 클럽 선택이 필요한 경우 (가장 먼저 체크)
          if (data.needs_club_selection) {
            // club_id가 있으면 클럽 선택 모달을 건너뛰고 자동으로 가입신청 처리
            if (clubId) {
              console.log('Club ID provided, auto-joining club:', clubId);
              setStatus('클럽 가입 처리 중...');
              try {
                const response = await authAPI.selectClubAfterSignup({
                  user_id: data.user.id,
                  club_id: parseInt(clubId),
                  email: data.email,
                });

                if (response.data.success) {
                  const { user: userData, access_token, club } = response.data;
                  setUser(userData);
                  setToken(access_token);
                  sessionStorage.setItem('token', access_token);

                  // 클럽 멤버십 상태 확인
                  const membershipStatus =
                    club?.membership_status || club?.status || 'pending';
                  const isSuperAdmin = userData?.role === 'super_admin';

                  // 승인 대기 상태인 경우 (일반 회원이고 pending 상태)
                  if (!isSuperAdmin && membershipStatus === 'pending') {
                    setStatus('승인 대기 중...');
                    setShowApprovalPendingModal(true);
                    isProcessing = false;
                    return;
                  }

                  // 승인된 경우 또는 슈퍼관리자인 경우
                  if (club && club.id) {
                    localStorage.setItem('currentClubId', club.id.toString());
                  }

                  // 클럽 컨텍스트 새로고침
                  try {
                    await loadClubs();
                  } catch (error) {
                    console.error('Failed to reload clubs:', error);
                  }

                  setStatus('리디렉션 중...');
                  isProcessing = false;
                  window.location.href = '/';
                  return;
                } else {
                  throw new Error(response.data.message || '클럽 가입에 실패했습니다.');
                }
              } catch (error) {
                console.error('Auto club join error:', error);
                // 에러 발생 시 클럽 선택 모달 표시
                setClubSelectionData({
                  user: data.user,
                  email: data.email,
                  redirectTo,
                });
                setShowClubSelectModal(true);
                setStatus('클럽 선택 중...');
                isProcessing = false;
                loadAvailableClubs();
                return;
              }
            }

            // club_id가 없으면 기존대로 클럽 선택 모달 표시
            console.log('Club selection needed, showing modal...');
            setClubSelectionData({
              user: data.user,
              email: data.email,
              redirectTo,
            });
            setShowClubSelectModal(true);
            setStatus('클럽 선택 중...');
            isProcessing = false; // 클럽 선택 모달 표시 시 플래그 리셋
            // 클럽 목록 로드
            loadAvailableClubs();
          }
          // 다른 기기에서 로그인되어 있으면 확인 모달 표시
          else if (data.requires_confirmation) {
            // 이메일 정보를 저장하고 확인 모달 표시
            // requires_confirmation인 경우 userData가 없을 수 있음
            const userEmail = data.email || '';
            setPendingData({ email: userEmail, redirectTo });
            setShowConfirmModal(true);
            setStatus('확인 대기 중...');
            isProcessing = false; // 확인 모달 표시 시 플래그 리셋
          } 
          // 승인 대기 중인 경우 - 승인 대기 모달 표시
          else if (data.pending_approval) {
            isProcessing = false; // 플래그 리셋
            setStatus('승인 대기 중...');
            setShowApprovalPendingModal(true);
          } else {
            // 활성 세션이 없으면 바로 로그인 처리
            if (!data.user || !data.access_token) {
              throw new Error('사용자 정보 또는 토큰이 없습니다.');
            }

            const { user: userData, access_token } = data;

            // 사용자 정보와 토큰을 직접 설정
            setUser(userData);
            setToken(access_token);
            sessionStorage.setItem('token', access_token);

            console.log('User logged in successfully:', userData);
            setStatus('리디렉션 중...');
            isProcessing = false; // 성공 시 플래그 리셋
            navigate('/', { replace: true }); // 항상 랜딩 페이지로 이동
          }
        } else {
          isProcessing = false; // 실패 시 플래그 리셋
          throw new Error(data.message || 'Google authentication failed');
        }
      } catch (error) {
        console.error('Google authentication error:', error);
        isProcessing = false; // 에러 시 플래그 리셋
        setStatus('오류 발생: ' + error.message);
        // 에러 페이지로 리디렉션 (안전한 인코딩)
        setTimeout(() => {
          try {
            const errorMessage = error.message || 'Unknown error';
            navigate('/login?error=' + encodeURIComponent(errorMessage), {
              replace: true,
            });
          } catch (encodeError) {
            console.error('Failed to encode error message:', encodeError);
            navigate('/login?error=Authentication failed', {
              replace: true,
            });
          }
        }, 2000);
      }
    };

    handleGoogleCallback();
  }, [navigate, setUser, setToken, loadAvailableClubs]); // 의존성 배열에 필요한 값들 추가

  const handleClubSelect = async () => {
    if (!selectedClubId) {
      alert('클럽을 선택해주세요.');
      return;
    }

    setStatus('클럽 가입 처리 중...');
    try {
      const response = await authAPI.selectClubAfterSignup({
        user_id: clubSelectionData.user.id,
        club_id: parseInt(selectedClubId),
        email: clubSelectionData.email,
      });

      if (response.data.success) {
        const { user: userData, access_token, club } = response.data;
        setUser(userData);
        setToken(access_token);
        localStorage.setItem('token', access_token);

        // 클럽 멤버십 상태 확인
        const membershipStatus =
          club?.membership_status || club?.status || 'pending';
        const isSuperAdmin = userData?.role === 'super_admin';

        // 승인 대기 상태인 경우 (일반 회원이고 pending 상태)
        if (!isSuperAdmin && membershipStatus === 'pending') {
          setShowClubSelectModal(false);
          setStatus('승인 대기 중...');
          // 승인 대기 메시지 표시
          setShowApprovalPendingModal(true);
          return;
        }

        // 승인된 경우 또는 슈퍼관리자인 경우
        // 선택한 클럽을 localStorage에 저장
        if (club && club.id) {
          localStorage.setItem('currentClubId', club.id.toString());
        }

        // 클럽 컨텍스트 새로고침
        try {
          await loadClubs();
        } catch (error) {
          console.error('Failed to reload clubs:', error);
        }

        setShowClubSelectModal(false);
        setStatus('리디렉션 중...');

        // 페이지 새로고침하여 모든 컨텍스트가 제대로 초기화되도록 함
        // 항상 랜딩 페이지로 이동
        window.location.href = '/';
      } else {
        alert(response.data.message || '클럽 선택에 실패했습니다.');
      }
    } catch (error) {
      console.error('Club selection error:', error);
      alert('클럽 선택 중 오류가 발생했습니다.');
    }
  };

  return (
    <>
      <div
        className="loading-container"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
        }}
      >
        <div className="loading-spinner"></div>
        <p style={{ fontSize: '1.2rem', color: 'var(--color-text, #333)' }}>
          {status}
        </p>
      </div>

      {/* 구글 로그인 확인 모달 */}
      {showConfirmModal && pendingData && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" fill="#fff3cd" />
                <path
                  d="M12 8v4M12 16h.01"
                  stroke="#ff9800"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2>다른 기기에서 접속 중</h2>
            <div className="modal-message">
              <p className="modal-message-main">
                해당 계정이{' '}
                <strong>다른 기기에서 이미 로그인되어 있습니다.</strong>
              </p>
              <p className="modal-message-sub">
                이 기기에서 로그인하면{' '}
                <strong>다른 기기에서 자동으로 로그아웃</strong>됩니다.
                <br />
                계속하시겠습니까?
              </p>
            </div>
            <div className="modal-buttons">
              <button
                className="btn-primary"
                onClick={async () => {
                  setStatus('로그인 처리 중...');
                  try {
                    // 확인 후 실제 로그인 처리
                    if (pendingData.userData && pendingData.access_token) {
                      // 이전 방식 (이미 토큰이 있는 경우)
                      setUser(pendingData.userData);
                      setToken(pendingData.access_token);
                      localStorage.setItem('token', pendingData.access_token);
                      setShowConfirmModal(false);
                      navigate('/', { replace: true }); // 항상 랜딩 페이지로 이동
                    } else if (pendingData.email) {
                      // 새 방식 (확인 후 로그인)
                      const response = await authAPI.googleConfirmLogin({
                        email: pendingData.email,
                      });
                      if (response.data.success) {
                        const { user: userData, access_token } = response.data;
                        setUser(userData);
                        setToken(access_token);
                        sessionStorage.setItem('token', access_token);
                        setShowConfirmModal(false);
                        navigate('/', { replace: true }); // 항상 랜딩 페이지로 이동
                      } else {
                        setStatus('로그인 실패: ' + response.data.message);
                        setTimeout(() => {
                          navigate('/login', { replace: true });
                        }, 2000);
                      }
                    }
                  } catch (error) {
                    setStatus('로그인 중 오류 발생');
                    setTimeout(() => {
                      navigate('/login', { replace: true });
                    }, 2000);
                  }
                }}
              >
                로그인하기
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowConfirmModal(false);
                  navigate('/login', { replace: true });
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 클럽 선택 모달 */}
      {showClubSelectModal && clubSelectionData && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" fill="#e3f2fd" />
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="#2196f3"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="#2196f3"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="#2196f3"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2>클럽 선택</h2>
            <div className="modal-message">
              <p className="modal-message-main">가입할 클럽을 선택해주세요.</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              {loadingClubs ? (
                <p>클럽 목록을 불러오는 중...</p>
              ) : (
                <select
                  id="club-select"
                  value={selectedClubId}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '16px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginBottom: '10px',
                  }}
                >
                  <option value="">클럽을 선택하세요</option>
                  {availableClubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="modal-buttons">
              <button
                className="btn-primary"
                onClick={handleClubSelect}
                disabled={!selectedClubId || loadingClubs}
              >
                선택 완료
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowClubSelectModal(false);
                  navigate('/clubs/promotion', { replace: true });
                }}
              >
                가입한 클럽이 없습니다
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 승인 대기 모달 */}
      {showApprovalPendingModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" fill="#fff3cd" />
                <path
                  d="M12 8v4M12 16h.01"
                  stroke="#ff9800"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2>승인 대기 중</h2>
            <div className="modal-message">
              <p
                className="modal-message-main"
                style={{ marginBottom: '10px' }}
              >
                관리자에게 승인 요청하였습니다.
              </p>
              <p className="modal-message-sub">
                승인이 완료되면 정상적으로 이용이 가능합니다.
              </p>
            </div>
            <div className="modal-buttons">
              <button
                className="btn-primary"
                onClick={() => {
                  setShowApprovalPendingModal(false);
                  // 로그아웃 처리
                  sessionStorage.removeItem('token');
                  navigate('/login', { replace: true });
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GoogleAuthCallback;
