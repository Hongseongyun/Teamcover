import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { messageAPI } from '../services/api';
import './Messages.css';

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // UTC 시간을 한국 시간(KST, UTC+9)으로 변환
  // 반환값: { date: Date 객체, kstHours: number, kstMinutes: number, ... }
  const convertToKST = (utcTimeString) => {
    if (!utcTimeString) return null;
    // 백엔드에서 'YYYY-MM-DD HH:MM:SS' 형식으로 반환 (UTC 시간)
    // 예: "2024-12-05 00:46:00" (UTC) -> "2024-12-05 09:46:00" (KST)
    try {
      // 문자열을 직접 파싱하여 UTC 시간 추출
      const parts = utcTimeString.split(' ');
      if (parts.length !== 2) return null;
      
      const [datePart, timePart] = parts;
      const [year, month, day] = datePart.split('-').map(Number);
      const [utcHours, utcMinutes, utcSeconds] = timePart.split(':').map(Number);
      
      // UTC Date 객체 생성
      const utcDate = new Date(Date.UTC(year, month - 1, day, utcHours, utcMinutes, utcSeconds || 0));
      
      // KST 시간 직접 계산 (UTC + 9시간)
      let kstHours = utcHours + 9;
      let kstDay = day;
      let kstMonth = month;
      let kstYear = year;
      
      // 시간 오버플로우 처리
      if (kstHours >= 24) {
        kstHours -= 24;
        kstDay += 1;
        // 월 오버플로우 처리
        const daysInMonth = new Date(year, month, 0).getDate();
        if (kstDay > daysInMonth) {
          kstDay = 1;
          kstMonth += 1;
          // 연도 오버플로우 처리
          if (kstMonth > 12) {
            kstMonth = 1;
            kstYear += 1;
          }
        }
      }
      
      // KST Date 객체 생성 (로컬 시간대로 생성하되 KST 시간 값 사용)
      const kstDate = new Date(kstYear, kstMonth - 1, kstDay, kstHours, utcMinutes, utcSeconds || 0);
      
      return {
        date: kstDate,
        kstHours,
        kstMinutes: utcMinutes,
        kstYear,
        kstMonth,
        kstDay,
      };
    } catch (e) {
      console.error('시간 변환 실패:', utcTimeString, e);
      return null;
    }
  };

  // 날짜 포맷팅 (오늘, 어제, 그 외)
  const formatDate = (kstData) => {
    if (!kstData) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(
      kstData.kstYear,
      kstData.kstMonth - 1,
      kstData.kstDay
    );
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (
      messageDate.getFullYear() === today.getFullYear() &&
      messageDate.getMonth() === today.getMonth() &&
      messageDate.getDate() === today.getDate()
    ) {
      return '오늘';
    } else if (
      messageDate.getFullYear() === yesterday.getFullYear() &&
      messageDate.getMonth() === yesterday.getMonth() &&
      messageDate.getDate() === yesterday.getDate()
    ) {
      return '어제';
    } else {
      const year = kstData.kstYear;
      const month = String(kstData.kstMonth).padStart(2, '0');
      const day = String(kstData.kstDay).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };

  // 시간 포맷팅 (HH:MM) - KST 시간 사용
  const formatTime = (kstData) => {
    if (!kstData) return '';
    // kstData는 convertToKST의 반환값 (객체)
    const hours = String(kstData.kstHours).padStart(2, '0');
    const minutes = String(kstData.kstMinutes).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // 대화 목록 시간 포맷팅
  const formatConversationTime = (timeString) => {
    if (!timeString) return '';
    const kstData = convertToKST(timeString);
    if (!kstData) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(
      kstData.kstYear,
      kstData.kstMonth - 1,
      kstData.kstDay
    );
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (
      messageDate.getFullYear() === today.getFullYear() &&
      messageDate.getMonth() === today.getMonth() &&
      messageDate.getDate() === today.getDate()
    ) {
      return formatTime(kstData);
    } else if (
      messageDate.getFullYear() === yesterday.getFullYear() &&
      messageDate.getMonth() === yesterday.getMonth() &&
      messageDate.getDate() === yesterday.getDate()
    ) {
      return '어제';
    } else {
      const month = String(kstData.kstMonth).padStart(2, '0');
      const day = String(kstData.kstDay).padStart(2, '0');
      return `${month}-${day}`;
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const res = await messageAPI.getConversations();
      if (res.data.success) {
        setConversations(res.data.conversations || []);
      }
    } catch (e) {
      console.error('대화 목록 로드 실패:', e);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (otherUserId, markRead = true) => {
      if (!otherUserId) return;
      try {
        setLoadingMessages(true);
        const res = await messageAPI.getMessagesWithUser(otherUserId);
        if (res.data.success) {
          setMessages(res.data.messages || []);
          if (!selectedUser) {
            setSelectedUser(res.data.other_user);
          }
          if (markRead) {
            try {
              await messageAPI.markAsRead(otherUserId);
              // 상단 네비게이션 뱃지 갱신을 위해 커스텀 이벤트 디스패치
              window.dispatchEvent(new Event('messagesUpdated'));
            } catch (e) {
              console.error('메세지 읽음 처리 실패:', e);
            }
          }
        }
      } catch (e) {
        console.error('메세지 로드 실패:', e);
      } finally {
        setLoadingMessages(false);
        setTimeout(scrollToBottom, 10);
      }
    },
    [selectedUser]
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSelectConversation = async (conv) => {
    setSelectedUser({
      id: conv.user_id,
      name: conv.name,
      email: conv.email,
    });
    await loadMessages(conv.user_id);
    // 선택한 대화의 unread_count 초기화
    setConversations((prev) =>
      prev.map((c) =>
        c.user_id === conv.user_id ? { ...c, unread_count: 0 } : c
      )
    );
  };

  const handleSendMessage = async () => {
    if (!selectedUser || !newMessage.trim() || sending) return;
    const content = newMessage.trim();
    setSending(true);
    
    // 전송 중 메시지를 임시로 표시
    const tempMessage = {
      id: `temp-${Date.now()}`,
      content: content,
      is_mine: true,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      is_sending: true, // 전송 중 플래그
    };
    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage('');
    scrollToBottom();
    
    try {
      const res = await messageAPI.sendMessage(selectedUser.id, content);
      if (res.data.success) {
        // 임시 메시지를 실제 메시지로 교체
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempMessage.id ? res.data.message : msg
          )
        );
        scrollToBottom();
        window.dispatchEvent(new Event('messagesUpdated'));
        // 대화 목록 갱신 (마지막 메세지 반영)
        await loadConversations();
      } else {
        // 전송 실패 시 임시 메시지 제거
        setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      }
    } catch (e) {
      console.error('메세지 전송 실패:', e);
      // 전송 실패 시 임시 메시지 제거
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      alert('메시지 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 메시지 삭제 가능 여부 확인 (10분 이내)
  const canDeleteMessage = (createdAt) => {
    if (!createdAt) return false;
    
    // 백엔드에서 받은 UTC 시간 문자열을 UTC Date로 파싱
    try {
      const isoString = createdAt.replace(' ', 'T') + 'Z';
      const messageUtcTime = new Date(isoString);
      
      if (isNaN(messageUtcTime.getTime())) return false;
      
      // 현재 UTC 시간
      const nowUtcTime = new Date();
      
      // 시간 차이 계산 (밀리초)
      const timeDiff = nowUtcTime.getTime() - messageUtcTime.getTime();
      const minutesDiff = timeDiff / (1000 * 60);
      
      // 10분 이내인지 확인
      return minutesDiff <= 10;
    } catch (e) {
      console.error('메시지 삭제 가능 여부 확인 실패:', e);
      return false;
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('이 메시지를 삭제하시겠습니까?')) {
      return;
    }
    try {
      const res = await messageAPI.deleteMessage(messageId);
      if (res.data.success) {
        // 메시지 목록에서 삭제
        setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
        // 대화 목록 갱신
        await loadConversations();
        window.dispatchEvent(new Event('messagesUpdated'));
      }
    } catch (e) {
      console.error('메시지 삭제 실패:', e);
      const errorMessage = e.response?.data?.message || '메시지 삭제에 실패했습니다.';
      alert(errorMessage);
    }
  };

  return (
    <div className="messages-page responsive-page">
      <h1 className="messages-title">메세지</h1>
      <div className="messages-container">
        <div className="conversation-list">
          <div className="conversation-list-header">대화 목록</div>
          {loadingConversations ? (
            <div className="conversation-empty">대화 목록을 불러오는 중...</div>
          ) : conversations.length === 0 ? (
            <div className="conversation-empty">
              아직 대화가 없습니다. 메세지를 보내보세요.
            </div>
          ) : (
            <ul>
              {conversations.map((conv) => (
                <li
                  key={conv.user_id}
                  className={`conversation-item ${
                    selectedUser?.id === conv.user_id ? 'active' : ''
                  }`}
                  onClick={() => handleSelectConversation(conv)}
                >
                  <div className="conversation-avatar">
                    {conv.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="conversation-main">
                    <div className="conversation-name-row">
                      <span className="conversation-name">{conv.name}</span>
                      {conv.unread_count > 0 && (
                        <span className="conversation-unread-badge">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="conversation-last-message">
                      {conv.last_message}
                    </div>
                  </div>
                  <div className="conversation-time">
                    {formatConversationTime(conv.last_time)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="chat-panel">
          {selectedUser ? (
            <>
              <div className="chat-header">
                <div className="chat-header-avatar">
                  {selectedUser.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="chat-header-info">
                  <div className="chat-header-name">{selectedUser.name}</div>
                  <div className="chat-header-email">{selectedUser.email}</div>
                </div>
              </div>
              <div className="chat-messages">
                {loadingMessages ? (
                  <div className="chat-loading">메세지를 불러오는 중...</div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty">
                    아직 메세지가 없습니다. 첫 메세지를 보내보세요.
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    // 전송 중 메시지는 시간 변환 불필요
                    if (msg.is_sending) {
                      const prevMsg = index > 0 ? messages[index - 1] : null;
                      const showDateDivider = !prevMsg || prevMsg.is_sending;
                      
                      return (
                        <React.Fragment key={msg.id}>
                          {showDateDivider && (
                            <div className="chat-date-divider">
                              <span>오늘</span>
                            </div>
                          )}
                          <div className={`chat-message-row mine`}>
                            <div className="chat-bubble-wrapper">
                              <div className="chat-bubble">
                                <div className="chat-content sending">
                                  {msg.content}
                                  <span className="sending-indicator"> 전송중..</span>
                                </div>
                              </div>
                            </div>
                            <div className="chat-avatar small mine">
                              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    }
                    
                    const kstData = convertToKST(msg.created_at);
                    if (!kstData) return null;
                    
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const prevKstData = prevMsg
                      ? convertToKST(prevMsg.created_at)
                      : null;
                    const showDateDivider =
                      !prevKstData ||
                      formatDate(kstData) !== formatDate(prevKstData);

                    return (
                      <React.Fragment key={msg.id}>
                        {showDateDivider && (
                          <div className="chat-date-divider">
                            <span>{formatDate(kstData)}</span>
                          </div>
                        )}
                        <div
                          className={`chat-message-row ${
                            msg.is_mine ? 'mine' : 'theirs'
                          }`}
                        >
                          {!msg.is_mine && (
                            <div className="chat-avatar small">
                              {selectedUser.name?.charAt(0)?.toUpperCase() ||
                                'U'}
                            </div>
                          )}
                          <div className="chat-bubble-wrapper">
                            <div className="chat-bubble">
                              {msg.is_deleted ? (
                                <div className="chat-content deleted">
                                  메시지가 삭제되었습니다
                                </div>
                              ) : msg.is_sending ? (
                                <div className="chat-content sending">
                                  {msg.content}
                                  <span className="sending-indicator"> 전송중..</span>
                                </div>
                              ) : (
                                <>
                                  <div className="chat-content">{msg.content}</div>
                                  {msg.is_mine && canDeleteMessage(msg.created_at) && (
                                    <button
                                      className="chat-delete-button"
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      title="메시지 삭제 (10분 이내)"
                                    >
                                      ×
                                    </button>
                                  )}
                                </>
                              )}
                              {!msg.is_sending && (
                                <div className="chat-time">
                                  {formatTime(kstData)}
                                </div>
                              )}
                            </div>
                          </div>
                          {msg.is_mine && (
                            <div className="chat-avatar small mine">
                              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="chat-input-bar">
                <textarea
                  className="chat-input"
                  placeholder="메세지를 입력하세요"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  className="chat-send-button"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                >
                  {sending ? '전송중...' : '전송'}
                </button>
              </div>
            </>
          ) : (
            <div className="chat-placeholder">
              왼쪽에서 대화 상대를 선택하거나 새 메세지를 보내세요.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;


