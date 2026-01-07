import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { scheduleAPI, memberAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { useTheme } from '../contexts/ThemeContext';
import { LoadingModal, Modal } from '../components/common';
import { Trash2 } from 'lucide-react';
import './Schedules.css';

const Schedules = () => {
  const { user } = useAuth();
  const { currentClub, isAdmin: clubIsAdmin } = useClub();
  const { theme } = useTheme();
  const isSuperAdmin = user && user.role === 'super_admin';
  const isAdmin = isSuperAdmin || clubIsAdmin;

  const [schedules, setSchedules] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingRegularSchedules, setCreatingRegularSchedules] =
    useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // 모달 상태
  const [showRegularSettingsModal, setShowRegularSettingsModal] =
    useState(false);
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [showScheduleDetailModal, setShowScheduleDetailModal] = useState(false);
  const [showDateSchedulesModal, setShowDateSchedulesModal] = useState(false);
  const [selectedDateSchedules, setSelectedDateSchedules] = useState([]);

  // 정기전 설정 상태
  const [regularSettings, setRegularSettings] = useState({
    dayOfWeek: 1, // 0: 일요일, 1: 월요일, ...
    weekType: 'all', // 'all', 'even', 'odd'
    frequency: 4, // 월 몇 번
    time: '19:00',
    maxParticipants: 24,
  });

  // 일정 추가 폼 상태
  const [scheduleForm, setScheduleForm] = useState({
    schedule_type: 'meeting', // 'regular', 'meeting', 'event'
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    max_participants: 18,
    description: '',
  });

  // 현재 사용자의 회원 정보
  const [currentMember, setCurrentMember] = useState(null);

  // 데이터 로드
  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(
        lastDay
      ).padStart(2, '0')}`;

      const response = await scheduleAPI.getSchedules({
        start_date: startDate,
        end_date: endDate,
      });

      if (response.data.success) {
        setSchedules(response.data.schedules);
      }
    } catch (error) {
      console.error('일정 로드 실패:', error);
      if (error.response?.status === 404) {
        console.error(
          '일정 API를 찾을 수 없습니다. 백엔드 서버가 재시작되었는지 확인하세요.'
        );
      } else if (
        error.code === 'ERR_NETWORK' ||
        error.message === 'Network Error'
      ) {
        console.error('네트워크 오류: 백엔드 서버가 실행 중인지 확인하세요.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  const normalizeEmail = (email) =>
    email && typeof email === 'string' ? email.trim().toLowerCase() : null;

  const loadMembers = useCallback(async () => {
    try {
      const response = await memberAPI.getMembers();
      if (response.data.success) {
        setMembers(response.data.members);
        // 현재 사용자의 회원 정보 찾기
        const userEmail = normalizeEmail(user?.email);
        const member =
          response.data.members.find(
            (m) => normalizeEmail(m.email) === userEmail
          ) || response.data.members.find((m) => m.name === user?.name);

        // 매칭되는 회원이 없으면 null로 두고, 참석 시 안내
        setCurrentMember(member || null);
      }
    } catch (error) {
      console.error('회원 목록 로드 실패:', error);
    }
  }, [user]);

  useEffect(() => {
    loadSchedules();
    loadMembers();
  }, [loadSchedules, loadMembers]);

  // 달력 생성
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);

    while (days.length < 42) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentDate]);

  // 날짜별 일정 그룹화
  const schedulesByDate = useMemo(() => {
    const grouped = {};
    schedules.forEach((schedule) => {
      const date = schedule.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(schedule);
    });
    return grouped;
  }, [schedules]);

  // 날짜 일정 목록 모달이 열려있을 때 schedules 변경 시 목록 업데이트
  useEffect(() => {
    if (showDateSchedulesModal && selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const updatedSchedules = schedulesByDate[dateStr] || [];
      setSelectedDateSchedules(updatedSchedules);
      // 일정이 모두 삭제되면 모달 닫기
      if (updatedSchedules.length === 0) {
        setShowDateSchedulesModal(false);
      }
    }
  }, [schedulesByDate, showDateSchedulesModal, selectedDate]);

  // 이전/다음 월 이동
  const changeMonth = (direction) => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  // 일정 추가
  const handleAddSchedule = async () => {
    try {
      const response = await scheduleAPI.createSchedule(scheduleForm);
      if (response.data.success) {
        await loadSchedules();
        setShowAddScheduleModal(false);
        setScheduleForm({
          schedule_type: 'meeting',
          title: '',
          date: new Date().toISOString().split('T')[0],
          time: '19:00',
          max_participants: 18,
          description: '',
        });
      }
    } catch (error) {
      console.error('일정 추가 실패:', error);
      alert(error.response?.data?.message || '일정 추가에 실패했습니다.');
    }
  };

  // 참석
  const handleAttend = async (scheduleId) => {
    try {
      // currentMember가 있으면 member_id 전달, 없으면 null 전달 (백엔드에서 로그인 유저 정보로 찾음)
      const response = await scheduleAPI.attendSchedule(scheduleId, {
        member_id: currentMember?.id || null,
      });
      if (response.data.success) {
        await loadSchedules();
        if (selectedSchedule?.id === scheduleId) {
          const updated = schedules.find((s) => s.id === scheduleId);
          if (updated) {
            const detailResponse = await scheduleAPI.getSchedule(scheduleId);
            if (detailResponse.data.success) {
              setSelectedSchedule(detailResponse.data.schedule);
            }
          }
        }
      }
    } catch (error) {
      alert(error.response?.data?.message || '참석 신청에 실패했습니다.');
    }
  };

  // 참석 취소
  const handleCancel = async (scheduleId) => {
    if (!window.confirm('참석을 취소하시겠습니까?')) {
      return;
    }

    try {
      // currentMember가 있으면 member_id 전달, 없으면 null 전달 (백엔드에서 로그인 유저 정보로 찾음)
      const response = await scheduleAPI.cancelAttendance(scheduleId, {
        member_id: currentMember?.id || null,
      });
      if (response.data.success) {
        await loadSchedules();
        if (selectedSchedule?.id === scheduleId) {
          const detailResponse = await scheduleAPI.getSchedule(scheduleId);
          if (detailResponse.data.success) {
            setSelectedSchedule(detailResponse.data.schedule);
          }
        }
      }
    } catch (error) {
      alert(error.response?.data?.message || '참석 취소에 실패했습니다.');
    }
  };

  // 참석 거부 (운영진/슈퍼관리자)
  const handleReject = async (scheduleId, memberId, memberName) => {
    if (
      !window.confirm(`${memberName || '해당 회원'}의 참석을 거부하시겠습니까?`)
    ) {
      return;
    }

    try {
      const response = await scheduleAPI.rejectAttendance(scheduleId, {
        member_id: memberId,
      });
      if (response.data.success) {
        await loadSchedules();
        if (selectedSchedule?.id === scheduleId) {
          const detailResponse = await scheduleAPI.getSchedule(scheduleId);
          if (detailResponse.data.success) {
            setSelectedSchedule(detailResponse.data.schedule);
          }
        }
        alert('참석이 거부되었습니다.');
      }
    } catch (error) {
      alert(error.response?.data?.message || '참석 거부에 실패했습니다.');
    }
  };

  // 일정 상세 보기
  const handleViewSchedule = async (schedule) => {
    try {
      const response = await scheduleAPI.getSchedule(schedule.id);
      if (response.data.success) {
        setSelectedSchedule(response.data.schedule);
        setShowScheduleDetailModal(true);
      }
    } catch (error) {
      console.error('일정 상세 로드 실패:', error);
    }
  };

  // 날짜 클릭
  const handleDateClick = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const daySchedules = schedulesByDate[dateStr] || [];

    setSelectedDate(date);
    setScheduleForm((prev) => ({
      ...prev,
      date: dateStr,
    }));

    // 해당 날짜의 일정이 있으면 목록 모달 표시
    if (daySchedules.length > 0) {
      setSelectedDateSchedules(daySchedules);
      setShowDateSchedulesModal(true);
    }
  };

  // 일정 삭제
  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('정말 이 일정을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await scheduleAPI.deleteSchedule(scheduleId);
      if (response.data.success) {
        await loadSchedules();

        // 상세 모달이 열려있고 삭제한 일정이면 닫기
        if (showScheduleDetailModal && selectedSchedule?.id === scheduleId) {
          setShowScheduleDetailModal(false);
          setSelectedSchedule(null);
        }
        alert('일정이 삭제되었습니다.');
      }
    } catch (error) {
      console.error('일정 삭제 실패:', error);
      alert(error.response?.data?.message || '일정 삭제에 실패했습니다.');
    }
  };

  // 정기전 생성 (해당 연도의 모든 월에 적용)
  const handleCreateRegularSchedules = async () => {
    setCreatingRegularSchedules(true);
    try {
      const targetYear = currentDate.getFullYear();
      const schedulesToCreate = [];

      // 해당 연도의 1월부터 12월까지 모든 월에 적용
      for (let month = 1; month <= 12; month++) {
        const lastDay = new Date(targetYear, month, 0).getDate();

        // 해당 월의 첫 번째 해당 요일 찾기
        let firstTargetDay = null;
        for (let day = 1; day <= 7; day++) {
          const date = new Date(targetYear, month - 1, day);
          if (date.getDay() === regularSettings.dayOfWeek) {
            firstTargetDay = day;
            break;
          }
        }

        if (!firstTargetDay) continue; // 해당 요일이 없는 월 (없을 수 없지만 안전장치)

        // 해당 월의 모든 해당 요일 찾기
        const targetDays = [];
        for (let day = firstTargetDay; day <= lastDay; day += 7) {
          targetDays.push(day);
        }

        // 주차별 필터링
        const filteredDays = [];
        for (let i = 0; i < targetDays.length; i++) {
          const weekNumber = i + 1; // 1주차, 2주차, 3주차...

          if (regularSettings.weekType === 'all') {
            filteredDays.push(targetDays[i]);
          } else if (
            regularSettings.weekType === 'even' &&
            weekNumber % 2 === 0
          ) {
            filteredDays.push(targetDays[i]);
          } else if (
            regularSettings.weekType === 'odd' &&
            weekNumber % 2 === 1
          ) {
            filteredDays.push(targetDays[i]);
          }
        }

        // 횟수 제한 적용
        const daysToAdd = filteredDays.slice(0, regularSettings.frequency);

        for (const day of daysToAdd) {
          const date = new Date(targetYear, month - 1, day);
          schedulesToCreate.push({
            schedule_type: 'regular',
            title: '정기전',
            date: date.toISOString().split('T')[0],
            time: regularSettings.time,
            max_participants: regularSettings.maxParticipants,
            description: '',
            is_recurring: true,
            recurring_config: regularSettings,
          });
        }
      }

      // 일괄 생성
      let successCount = 0;
      let errorCount = 0;

      for (const schedule of schedulesToCreate) {
        try {
          await scheduleAPI.createSchedule(schedule);
          successCount++;
        } catch (error) {
          console.error('일정 생성 실패:', schedule.date, error);
          errorCount++;
        }
      }

      await loadSchedules();
      setShowRegularSettingsModal(false);

      if (errorCount > 0) {
        alert(
          `${successCount}개의 정기전이 생성되었습니다. ${errorCount}개의 생성에 실패했습니다.`
        );
      } else {
        alert(
          `${successCount}개의 정기전이 생성되었습니다. (${targetYear}년 전체)`
        );
      }
    } catch (error) {
      console.error('정기전 생성 실패:', error);
      const errorMessage =
        error.response?.data?.message ||
        (error.code === 'ERR_NETWORK'
          ? '네트워크 오류: 백엔드 서버를 확인하세요.'
          : '정기전 생성에 실패했습니다.');
      alert(errorMessage);
    } finally {
      setCreatingRegularSchedules(false);
    }
  };

  if (loading) {
    return <LoadingModal isOpen={true} />;
  }

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const monthNames = [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
  ];

  return (
    <div className="schedules-page">
      <LoadingModal isOpen={creatingRegularSchedules} />
      <div className="schedules-header">
        <h1>일정확인</h1>
        <div className="schedules-actions">
          {isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => setShowRegularSettingsModal(true)}
              disabled={creatingRegularSchedules}
            >
              정기전 설정
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => setShowAddScheduleModal(true)}
            disabled={creatingRegularSchedules}
          >
            일정 추가
          </button>
        </div>
      </div>

      {/* 달력 */}
      <div className="calendar-container">
        <div className="calendar-header">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => changeMonth(-1)}
          >
            ‹
          </button>
          <h2>
            {currentDate.getFullYear()}년 {monthNames[currentDate.getMonth()]}
          </h2>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => changeMonth(1)}
          >
            ›
          </button>
        </div>

        <div className="calendar-grid">
          {/* 요일 헤더 */}
          {weekDays.map((day) => (
            <div key={day} className="calendar-weekday">
              {day}
            </div>
          ))}

          {/* 날짜 셀 */}
          {calendarDays.map((date, index) => {
            const dateStr = date.toISOString().split('T')[0];
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const daySchedules = schedulesByDate[dateStr] || [];

            return (
              <div
                key={index}
                className={`calendar-day ${
                  !isCurrentMonth ? 'other-month' : ''
                } ${isToday ? 'today' : ''} ${
                  selectedDate?.toISOString().split('T')[0] === dateStr
                    ? 'selected'
                    : ''
                }`}
                onClick={() => handleDateClick(date)}
              >
                <div className="calendar-day-number">{date.getDate()}</div>
                <div className="calendar-day-schedules">
                  {daySchedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`schedule-dot schedule-${schedule.schedule_type}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSchedule(schedule);
                      }}
                      title={schedule.title}
                    >
                      {schedule.title}
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <div className="schedule-more">
                      +{daySchedules.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 정기전 설정 모달 */}
      <Modal
        isOpen={showRegularSettingsModal}
        onClose={() => setShowRegularSettingsModal(false)}
        title="정기전 설정"
        size="md"
      >
        <div className="regular-settings-form">
          <div className="form-group">
            <label>요일</label>
            <select
              value={regularSettings.dayOfWeek}
              onChange={(e) =>
                setRegularSettings({
                  ...regularSettings,
                  dayOfWeek: parseInt(e.target.value),
                })
              }
              disabled={creatingRegularSchedules}
            >
              {weekDays.map((day, index) => (
                <option key={index} value={index}>
                  {day}요일
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>주차</label>
            <select
              value={regularSettings.weekType}
              onChange={(e) =>
                setRegularSettings({
                  ...regularSettings,
                  weekType: e.target.value,
                })
              }
              disabled={creatingRegularSchedules}
            >
              <option value="all">매주</option>
              <option value="even">짝수 주</option>
              <option value="odd">홀수 주</option>
            </select>
          </div>

          <div className="form-group">
            <label>월 횟수</label>
            <input
              type="number"
              min="1"
              max="10"
              value={regularSettings.frequency}
              onChange={(e) =>
                setRegularSettings({
                  ...regularSettings,
                  frequency: parseInt(e.target.value) || 1,
                })
              }
              disabled={creatingRegularSchedules}
            />
          </div>

          <div className="form-group">
            <label>시간</label>
            <input
              type="time"
              value={regularSettings.time}
              onChange={(e) =>
                setRegularSettings({
                  ...regularSettings,
                  time: e.target.value,
                })
              }
              disabled={creatingRegularSchedules}
            />
          </div>

          <div className="form-group">
            <label>최대 인원</label>
            <input
              type="number"
              min="1"
              value={regularSettings.maxParticipants}
              onChange={(e) =>
                setRegularSettings({
                  ...regularSettings,
                  maxParticipants: parseInt(e.target.value) || 18,
                })
              }
              disabled={creatingRegularSchedules}
            />
          </div>

          <div className="modal-actions">
            <button
              className="btn btn-primary"
              onClick={handleCreateRegularSchedules}
              disabled={creatingRegularSchedules}
            >
              {creatingRegularSchedules ? '생성 중...' : '생성'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowRegularSettingsModal(false)}
              disabled={creatingRegularSchedules}
            >
              취소
            </button>
          </div>
        </div>
      </Modal>

      {/* 일정 추가 모달 */}
      <Modal
        isOpen={showAddScheduleModal}
        onClose={() => setShowAddScheduleModal(false)}
        title="일정 추가"
        size="md"
      >
        <div className="schedule-form">
          <div className="form-group">
            <label>일정 종류</label>
            <select
              value={scheduleForm.schedule_type}
              onChange={(e) =>
                setScheduleForm({
                  ...scheduleForm,
                  schedule_type: e.target.value,
                })
              }
            >
              <option value="meeting">벙</option>
              <option value="event">이벤트전</option>
              <option value="regular">정기전</option>
            </select>
          </div>

          <div className="form-group">
            <label>제목</label>
            <input
              type="text"
              value={scheduleForm.title}
              onChange={(e) =>
                setScheduleForm({ ...scheduleForm, title: e.target.value })
              }
              placeholder="일정 제목"
            />
          </div>

          <div className="form-group">
            <label>날짜</label>
            <input
              type="date"
              value={scheduleForm.date}
              onChange={(e) =>
                setScheduleForm({ ...scheduleForm, date: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label>시간</label>
            <input
              type="time"
              value={scheduleForm.time}
              onChange={(e) =>
                setScheduleForm({ ...scheduleForm, time: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label>최대 인원</label>
            <input
              type="number"
              min="1"
              value={scheduleForm.max_participants}
              onChange={(e) =>
                setScheduleForm({
                  ...scheduleForm,
                  max_participants: parseInt(e.target.value) || 18,
                })
              }
            />
          </div>

          <div className="form-group">
            <label>설명</label>
            <textarea
              value={scheduleForm.description}
              onChange={(e) =>
                setScheduleForm({
                  ...scheduleForm,
                  description: e.target.value,
                })
              }
              rows="3"
            />
          </div>

          <div className="modal-actions">
            <button className="btn btn-primary" onClick={handleAddSchedule}>
              추가
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowAddScheduleModal(false)}
            >
              취소
            </button>
          </div>
        </div>
      </Modal>

      {/* 일정 상세 모달 */}
      {selectedSchedule && (
        <Modal
          isOpen={showScheduleDetailModal}
          onClose={() => {
            setShowScheduleDetailModal(false);
            setSelectedSchedule(null);
          }}
          title={selectedSchedule.title}
          size="lg"
        >
          <div className="schedule-detail">
            <div className="schedule-info">
              <p>
                <strong>날짜:</strong> {selectedSchedule.date}
              </p>
              <p>
                <strong>시간:</strong> {selectedSchedule.time}
              </p>
              <p>
                <strong>인원:</strong> {selectedSchedule.attendance_count}/
                {selectedSchedule.max_participants}
              </p>
              {selectedSchedule.description && (
                <p>
                  <strong>설명:</strong> {selectedSchedule.description}
                </p>
              )}
            </div>

            <div className="schedule-attendances">
              <h3>참석자 목록</h3>
              {selectedSchedule.attendances &&
              selectedSchedule.attendances.length > 0 ? (
                <>
                  {/* 한 섹션에 모든 참석자 이름을 표시 */}
                  <div className="attendee-summary">
                    {selectedSchedule.attendances
                      .filter((att) => att.status === 'attending')
                      .map((att) => {
                        // 로그인한 회원 본인의 참석일 경우, user 테이블의 name을 우선 사용
                        const isCurrentUserAttendance =
                          currentMember &&
                          att.member_id === currentMember.id &&
                          att.status === 'attending';

                        const displayName =
                          isCurrentUserAttendance && user?.name
                            ? user.name
                            : att.member_name;

                        return displayName;
                      })
                      .join(', ')}
                  </div>

                  {/* 운영진/슈퍼관리자용: 참석자 개별 거부 섹션 */}
                  {isAdmin && (
                    <div className="attendee-admin-section">
                      <p className="attendee-admin-title">참석자 관리</p>
                      <ul>
                        {selectedSchedule.attendances
                          .filter((att) => att.status === 'attending')
                          .map((att) => (
                            <li key={att.id}>
                              {att.member_name}
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() =>
                                  handleReject(
                                    selectedSchedule.id,
                                    att.member_id,
                                    att.member_name
                                  )
                                }
                              >
                                거부
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p>참석자가 없습니다.</p>
              )}
            </div>

            <div className="schedule-actions">
              <div className="schedule-actions-left">
                {user && (
                  <>
                    {selectedSchedule.attendances?.some((att) => {
                      // currentMember가 있으면 member_id로 비교, 없으면 이름으로 비교
                      if (currentMember) {
                        return (
                          att.member_id === currentMember.id &&
                          att.status === 'attending'
                        );
                      }
                      // 이름으로 비교 (로그인한 유저 이름)
                      return (
                        att.member_name === user.name &&
                        att.status === 'attending'
                      );
                    }) ? (
                      <button
                        className="btn btn-warning"
                        onClick={() => handleCancel(selectedSchedule.id)}
                      >
                        참석 취소
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleAttend(selectedSchedule.id)}
                        disabled={
                          selectedSchedule.attendance_count >=
                          selectedSchedule.max_participants
                        }
                      >
                        참석
                      </button>
                    )}
                  </>
                )}
              </div>
              {isAdmin && (
                <div className="schedule-actions-right">
                  <button
                    type="button"
                    className="btn-delete-row"
                    onClick={() => handleDeleteSchedule(selectedSchedule.id)}
                    title="일정 삭제"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 날짜별 일정 목록 모달 */}
      {selectedDate && (
        <Modal
          isOpen={showDateSchedulesModal}
          onClose={() => {
            setShowDateSchedulesModal(false);
            setSelectedDateSchedules([]);
          }}
          title={`${selectedDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })} 일정`}
          size="lg"
        >
          <div className="date-schedules-list">
            {selectedDateSchedules.length > 0 ? (
              <ul className="schedule-list">
                {selectedDateSchedules.map((schedule) => (
                  <li key={schedule.id} className="schedule-list-item">
                    <div className="schedule-list-content">
                      <div className="schedule-list-header">
                        <h4
                          className={`schedule-title schedule-${schedule.schedule_type}`}
                        >
                          {schedule.title}
                        </h4>
                        {isAdmin && (
                          <button
                            type="button"
                            className="btn-delete-row"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            title="일정 삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="schedule-list-info">
                        <span>
                          <strong>시간:</strong> {schedule.time}
                        </span>
                        <span>
                          <strong>인원:</strong>{' '}
                          {schedule.attendance_count || 0}/
                          {schedule.max_participants}
                        </span>
                        {schedule.description && (
                          <span>
                            <strong>설명:</strong> {schedule.description}
                          </span>
                        )}
                      </div>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setShowDateSchedulesModal(false);
                          handleViewSchedule(schedule);
                        }}
                      >
                        상세보기
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>일정이 없습니다.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Schedules;
