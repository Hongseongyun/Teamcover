import React, { useState, useEffect, useCallback } from 'react';
import { scoreAPI, sheetsAPI, memberAPI, ocrAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Scores.css';
import './Members.css'; // Members 페이지의 티어 스타일을 사용하기 위해 import
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Members 페이지의 TierBadge 컴포넌트를 가져옴
const TierBadge = ({ tier, size = 'normal' }) => {
  const getTierClass = (tier) => {
    if (!tier) return 'tier-unranked';

    const tierMap = {
      배치: 'tier-unranked',
      아이언: 'tier-iron',
      브론즈: 'tier-bronze',
      실버: 'tier-silver',
      골드: 'tier-gold',
      플레티넘: 'tier-platinum',
      다이아: 'tier-diamond',
      마스터: 'tier-master',
      챌린저: 'tier-challenger',
    };

    return tierMap[tier] || 'tier-unranked';
  };

  const getDisplayTier = (tier) => {
    const tierMap = {
      배치: 'UNRANKED',
      아이언: 'IRON',
      브론즈: 'BRONZE',
      실버: 'SILVER',
      골드: 'GOLD',
      플레티넘: 'PLATINUM',
      다이아: 'DIAMOND',
      마스터: 'MASTER',
      챌린저: 'CHALLENGER',
    };

    return tierMap[tier] || 'UNRANKED';
  };

  return (
    <span
      className={`tier-badge ${getTierClass(tier)} ${
        size === 'small' ? 'tier-badge-sm' : ''
      }`}
    >
      {getDisplayTier(tier)}
    </span>
  );
};

const Scores = () => {
  const { user } = useAuth(); // 현재 사용자 정보
  const isAdmin =
    user && (user.role === 'admin' || user.role === 'super_admin');
  const isSuperAdmin = user && user.role === 'super_admin';
  const [scores, setScores] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false); // 스코어 등록 중 로딩 상태
  const [deleting, setDeleting] = useState(false); // 스코어 삭제 중 로딩 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [editingScore, setEditingScore] = useState(null);
  // 행 인라인 편집 상태
  const [inlineEditingId, setInlineEditingId] = useState(null);
  const [inlineEditData, setInlineEditData] = useState({
    member_name: '',
    game_date: '',
    score1: '',
    score2: '',
    score3: '',
    note: '',
  });
  const [formData, setFormData] = useState({
    member_name: '',
    game_date: '',
    score1: '',
    score2: '',
    score3: '',
    note: '',
  });

  // 다중 입력 행 상태 (새 스코어 등록용)
  const [formEntries, setFormEntries] = useState([
    {
      member_name: '',
      game_date: '',
      score1: '',
      score2: '',
      score3: '',
      note: '',
    },
  ]);

  // 표 형식 보조 함수들 (포인트와 동일한 동작)
  const addScoreRow = () => {
    setFormEntries((prev) => {
      const firstDate = prev.length > 0 ? prev[0].game_date : '';
      return [
        ...prev,
        {
          member_name: '',
          game_date: firstDate,
          score1: '',
          score2: '',
          score3: '',
          note: '',
        },
      ];
    });
  };

  const removeScoreRow = (indexToRemove) => {
    setFormEntries((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== indexToRemove) : prev
    );
  };

  const updateEntryField = (indexToUpdate, field, value) => {
    setFormEntries((prev) => {
      const next = prev.map((row, i) =>
        i === indexToUpdate ? { ...row, [field]: value } : row
      );
      // 첫 행 날짜 변경 시 모든 행 동기화
      if (field === 'game_date' && indexToUpdate === 0) {
        return next.map((row, i) =>
          i === 0 ? row : { ...row, game_date: value }
        );
      }
      return next;
    });
  };

  // 이미지 업로드 관련 상태
  const [selectedImages, setSelectedImages] = useState([]); // 다중 이미지
  const [imagePreviews, setImagePreviews] = useState([]); // 다중 미리보기
  const [ocrResults, setOcrResults] = useState([]);
  const [currentStep, setCurrentStep] = useState('upload'); // upload, selection, result
  const [aiAnalyzing, setAiAnalyzing] = useState(false); // AI 분석 중 로딩 상태
  const [analyzingProgress, setAnalyzingProgress] = useState({
    current: 0,
    total: 0,
  }); // 분석 진행률

  // 구글시트 가져오기 관련 상태
  const [showImportForm, setShowImportForm] = useState(false);
  const [importFormData, setImportFormData] = useState({
    spreadsheetUrl: '',
    worksheetName: '',
    confirmDelete: false,
  });

  // 통계 상태 (현재 사용하지 않음)
  // const [stats, setStats] = useState({
  //   totalScores: 0,
  //   averageScore: 0,
  //   highestScore: 0,
  //   sectionStats: {},
  // });

  // 회원별 평균 순위 상태
  const [memberAverages, setMemberAverages] = useState([]);
  const [averagesLoading, setAveragesLoading] = useState(false);
  const [showAllAverages, setShowAllAverages] = useState(false);

  // 개인별 검색 상태
  const [searchMember, setSearchMember] = useState('');
  const [memberStats, setMemberStats] = useState(null);
  const [showMemberSearch, setShowMemberSearch] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredMembers, setFilteredMembers] = useState([]);

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortOrder, setSortOrder] = useState('desc'); // desc: 최신순, asc: 오래된순

  // 날짜별 그룹화된 스코어 상태
  const [groupedScores, setGroupedScores] = useState([]);

  // 날짜별 좌우 페이징 상태
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const [showAllDates, setShowAllDates] = useState(false);

  // 일괄 삭제 관련 상태
  const [selectedScores, setSelectedScores] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // 날짜 그룹 인라인 편집 상태 (슈퍼계정만 사용)
  const [editingGroupDate, setEditingGroupDate] = useState(null); // 기존 날짜 문자열 (yyyy-MM-dd)
  const [newGroupDate, setNewGroupDate] = useState('');

  const loadScores = useCallback(async () => {
    try {
      setLoading(true);
      const response = await scoreAPI.getScores();
      if (response.data.success) {
        setScores(response.data.scores);
        calculateStats(response.data.scores);
      }
    } catch (error) {
      // 에러 처리
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const response = await memberAPI.getMembers();
      if (response.data.success) {
        setMembers(response.data.members);
      }
    } catch (error) {
      // 에러 처리
    }
  }, []);

  const loadMemberAverages = useCallback(async () => {
    try {
      setAveragesLoading(true);
      const response = await scoreAPI.getMemberAverages();
      if (response.data.success) {
        setMemberAverages(response.data.averages);
      }
    } catch (error) {
      console.error('회원별 평균 로드 실패:', error);
    } finally {
      setAveragesLoading(false);
    }
  }, []);

  const refreshMemberAverages = useCallback(async () => {
    try {
      setAveragesLoading(true);

      // 에버 새로고침 API 호출 (모든 사용자)
      const response = await scoreAPI.refreshMemberAverages();
      if (response.data.success) {
        setMemberAverages(response.data.averages);
      } else {
        console.error('에버 새로고침 실패:', response.data.message);
      }
    } catch (error) {
      console.error('회원별 평균 새로고침 실패:', error);
    } finally {
      setAveragesLoading(false);
    }
  }, []);

  // (가상 스크롤 컴포넌트는 현재 미사용 - 필요 시 복구)

  useEffect(() => {
    loadScores();
    loadMembers();
    // 초기 로드: 빠른 표시를 위해 재계산 없이 저장값만 로드
    loadMemberAverages();
  }, [loadScores, loadMembers, loadMemberAverages]);

  // 페이지 포커스 시 평균 순위 재요청(빠른 조회 버전)
  useEffect(() => {
    const handleFocus = () => {
      loadMemberAverages();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadMemberAverages]);

  const calculateStats = (scoreList) => {
    // 통계 계산 로직 (현재 사용하지 않음)
    // 필요시 나중에 구현
  };

  // 개인별 통계 계산
  const calculateMemberStats = (memberName) => {
    if (!memberName || !scores.length) return;

    const memberScores = scores.filter(
      (score) => score.member_name === memberName
    );
    if (memberScores.length === 0) {
      setMemberStats(null);
      return;
    }

    const allScores = memberScores
      .flatMap((score) => [score.score1, score.score2, score.score3])
      .filter((s) => s > 0);

    const totalGames = memberScores.length;
    const totalScore = allScores.reduce((sum, score) => sum + score, 0);
    const averageScore =
      allScores.length > 0 ? Math.round(totalScore / allScores.length) : 0;
    const highestScore = Math.max(...allScores, 0);
    const lowestScore = Math.min(...allScores, 300);

    // 전체 게임 기록 (최신순 정렬)
    const allScoresSorted = memberScores.sort(
      (a, b) => new Date(b.game_date) - new Date(a.game_date)
    );

    setMemberStats({
      memberName,
      totalGames,
      totalScore,
      averageScore,
      highestScore,
      lowestScore,
      allScores: allScoresSorted,
    });
  };

  // 개인별 검색 실행
  const handleMemberSearch = () => {
    if (searchMember.trim()) {
      calculateMemberStats(searchMember.trim());
      setShowMemberSearch(false);
    }
  };

  // 검색 초기화
  const resetMemberSearch = () => {
    setSearchMember('');
    setMemberStats(null);
    setShowMemberSearch(true);
  };

  // 날짜별 그룹 페이징 처리 함수들
  const getPaginatedGroups = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return groupedScores.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(groupedScores.length / itemsPerPage);
  };

  // 날짜별 좌우 페이징 함수들
  const getCurrentDateGroup = () => {
    if (groupedScores.length === 0) return null;
    return groupedScores[currentDateIndex];
  };

  const goToPreviousDate = () => {
    if (currentDateIndex > 0) {
      setCurrentDateIndex(currentDateIndex - 1);
    }
  };

  const goToNextDate = () => {
    if (currentDateIndex < groupedScores.length - 1) {
      setCurrentDateIndex(currentDateIndex + 1);
    }
  };

  const goToFirstDate = () => {
    setCurrentDateIndex(0);
  };

  const goToLastDate = () => {
    setCurrentDateIndex(groupedScores.length - 1);
  };

  const scrollToImportSection = () => {
    setShowImportForm(true);
    setTimeout(() => {
      const element = document.getElementById('sheet-import-section');
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 120);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortOrderChange = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    setCurrentPage(1); // 정렬 변경 시 첫 페이지로 이동
  };

  // 페이지 변경 시 currentPage 초기화
  useEffect(() => {
    setCurrentPage(1);
  }, [scores.length]);

  // 날짜별로 스코어 그룹화
  const groupScoresByDate = useCallback(
    (scoreList) => {
      const groups = {};

      scoreList.forEach((score) => {
        const dateKey = score.game_date || score.created_at;
        if (!groups[dateKey]) {
          groups[dateKey] = [];
        }
        groups[dateKey].push(score);
      });

      // 날짜별로 정렬하여 배열로 변환
      const sortedGroups = Object.entries(groups)
        .sort(([dateA], [dateB]) => {
          const dateObjA = new Date(dateA);
          const dateObjB = new Date(dateB);
          return sortOrder === 'desc'
            ? dateObjB - dateObjA
            : dateObjA - dateObjB;
        })
        .map(([date, scores]) => ({
          date,
          scores,
          memberCount: scores.length,
          totalScore: scores.reduce(
            (sum, score) => sum + score.score1 + score.score2 + score.score3,
            0
          ),
          averageScore: Math.round(
            scores.reduce(
              (sum, score) => sum + score.score1 + score.score2 + score.score3,
              0
            ) /
              (scores.length * 3)
          ),
        }));

      setGroupedScores(sortedGroups);
      return sortedGroups;
    },
    [sortOrder]
  );

  // 날짜 그룹 인라인 편집 시작
  const startGroupDateEdit = (dateStr) => {
    if (!isSuperAdmin) return;
    setEditingGroupDate(dateStr);
    setNewGroupDate(dateStr);
  };

  // 날짜 그룹 인라인 편집 취소
  const cancelGroupDateEdit = () => {
    setEditingGroupDate(null);
    setNewGroupDate('');
  };

  // 날짜 그룹 저장: 해당 날짜의 모든 스코어를 새 날짜로 업데이트
  const saveGroupDateEdit = async (oldDate) => {
    if (!isSuperAdmin) return;
    const targetGroup = groupedScores.find((g) => g.date === oldDate);
    if (!targetGroup) {
      cancelGroupDateEdit();
      return;
    }

    const newDate = newGroupDate;
    try {
      // 백엔드 업데이트 (필수 필드 모두 포함)
      await Promise.all(
        targetGroup.scores.map((s) =>
          scoreAPI.updateScore(s.id, {
            member_name: s.member_name,
            game_date: newDate,
            score1: s.score1 || 0,
            score2: s.score2 || 0,
            score3: s.score3 || 0,
            note: s.note || '',
          })
        )
      );

      // 로컬 상태 갱신
      setScores((prev) => {
        const updated = prev.map((s) =>
          (s.game_date || s.created_at) === oldDate
            ? { ...s, game_date: newDate }
            : s
        );
        groupScoresByDate(updated);
        return updated;
      });

      cancelGroupDateEdit();
    } catch (e) {
      alert('날짜 변경에 실패했습니다.');
    }
  };

  // 스코어 로드 시 그룹화 실행
  useEffect(() => {
    if (scores.length > 0) {
      groupScoresByDate(scores);
    }
  }, [scores, groupScoresByDate]);

  // 이미지 업로드 처리 (다중 이미지 지원)
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      // 기존 이미지에 새 이미지 추가
      setSelectedImages((prevImages) => [...prevImages, ...files]);

      // 각 파일의 미리보기 생성
      const previewPromises = files.map((file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve(e.target.result);
          };
          reader.readAsDataURL(file);
        });
      });

      Promise.all(previewPromises).then((previews) => {
        setImagePreviews((prevPreviews) => [...prevPreviews, ...previews]);
        setCurrentStep('upload');
      });
    }
  };

  // 이미지 분석 시작 (다중 이미지 지원)
  const handleAnalyzeImage = async () => {
    if (!selectedImages || selectedImages.length === 0) {
      alert('이미지를 선택해주세요.');
      return;
    }

    setAiAnalyzing(true);
    setAnalyzingProgress({ current: 0, total: selectedImages.length });

    const allResults = [];

    try {
      // 각 이미지를 순차적으로 분석
      for (let i = 0; i < selectedImages.length; i++) {
        setAnalyzingProgress({ current: i + 1, total: selectedImages.length });

        const formData = new FormData();
        formData.append('image', selectedImages[i]);

        const response = await ocrAPI.processImage(formData);

        if (response.data.success && response.data.results) {
          const todayDate = new Date().toISOString().split('T')[0];
          const resultsWithDate = response.data.results.map((result) => ({
            member_name: result.member_name || '',
            game_date: todayDate,
            score1: parseInt(result.score1) || 0,
            score2: parseInt(result.score2) || 0,
            score3: parseInt(result.score3) || 0,
            note: '',
          }));

          allResults.push(...resultsWithDate);
        } else {
          // 이미지 분석 실패
        }
      }

      if (allResults.length > 0) {
        setOcrResults(allResults);
        setCurrentStep('result');
      } else {
        alert('AI 스코어 인식에 실패했습니다. 이미지를 확인해주세요.');
      }
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        alert(
          'AI 분석 시간이 초과되었습니다. 이미지 크기를 줄이거나 다시 시도해주세요.'
        );
      } else {
        alert(
          error.response?.data?.message ||
            error.response?.data?.error ||
            'AI 스코어 인식에 실패했습니다. 이미지를 확인해주세요.'
        );
      }
    } finally {
      setAiAnalyzing(false);
      setAnalyzingProgress({ current: 0, total: 0 });
    }
  };

  // OCR 결과를 스코어로 저장
  const handleSaveOcrResults = async () => {
    try {
      // 회원명이 비어있는 항목 체크
      const emptyNames = ocrResults.filter(
        (r) => !r.member_name || r.member_name.trim() === ''
      );
      if (emptyNames.length > 0) {
        alert(
          '모든 회원을 선택해주세요. (선택되지 않은 인원: ' +
            emptyNames.length +
            '명)'
        );
        return;
      }

      // 로딩 상태 시작
      setAiAnalyzing(true);
      setAnalyzingProgress({ current: 0, total: ocrResults.length });

      // 병렬 처리로 모든 스코어를 동시에 저장
      const savePromises = ocrResults.map(async (result, index) => {
        try {
          const response = await scoreAPI.addScore({
            member_name: result.member_name.trim(),
            game_date:
              result.game_date || new Date().toISOString().split('T')[0],
            score1: parseInt(result.score1) || 0,
            score2: parseInt(result.score2) || 0,
            score3: parseInt(result.score3) || 0,
            note: result.note || '', // 비고 추가
          });

          // 진행률 업데이트
          setAnalyzingProgress((prev) => ({
            current: prev.current + 1,
            total: prev.total,
          }));

          return { success: true, result, response };
        } catch (error) {
          const errorMsg =
            error.response?.data?.message || error.message || '알 수 없는 오류';
          return {
            success: false,
            result,
            error: `${result.member_name || '(이름없음)'}: ${errorMsg}`,
          };
        }
      });

      // 모든 저장 작업 완료 대기
      const results = await Promise.all(savePromises);

      const successResults = results.filter((r) => r.success);
      const failResults = results.filter((r) => !r.success);

      const successCount = successResults.length;
      const failCount = failResults.length;
      const errors = failResults.map((r) => r.error);

      // 로딩 상태 종료
      setAiAnalyzing(false);
      setAnalyzingProgress({ current: 0, total: 0 });

      if (successCount > 0 && failCount === 0) {
        alert(`✅ ${successCount}명의 스코어가 성공적으로 저장되었습니다.`);
        // 성공 시 폼 닫기 및 데이터 초기화
        setShowPhotoForm(false);
        setOcrResults([]);
        setSelectedImages([]);
        setImagePreviews([]);
        setCurrentStep('upload');
        loadScores();
        refreshMemberAverages();
      } else if (successCount > 0 && failCount > 0) {
        const confirmContinue = window.confirm(
          `일부 저장 완료\n성공: ${successCount}명\n실패: ${failCount}명\n\n실패 내역:\n${errors.join(
            '\n'
          )}\n\n성공한 스코어는 저장되었습니다. 계속하시겠습니까?`
        );
        if (confirmContinue) {
          setShowPhotoForm(false);
          setOcrResults([]);
          setSelectedImages([]);
          setImagePreviews([]);
          setCurrentStep('upload');
          loadScores();
          refreshMemberAverages();
        }
      } else {
        alert(
          `❌ 스코어 저장에 실패했습니다.\n\n실패 내역:\n${errors.join(
            '\n'
          )}\n\n다시 시도해주세요.`
        );
        return; // 모두 실패하면 폼을 닫지 않음
      }
    } catch (error) {
      // 로딩 상태 종료
      setAiAnalyzing(false);
      setAnalyzingProgress({ current: 0, total: 0 });

      const errorMsg =
        error.response?.data?.message ||
        error.message ||
        '알 수 없는 오류가 발생했습니다.';
      alert(
        `스코어 저장 중 오류가 발생했습니다.\n\n오류: ${errorMsg}\n\n다시 시도해주세요.`
      );
    }
  };

  // 구글시트 가져오기
  const handleImportFromSheets = async (e) => {
    e.preventDefault();
    if (!importFormData.confirmDelete) {
      alert('경고사항을 확인해주세요.');
      return;
    }

    try {
      const response = await sheetsAPI.importScores(importFormData);
      const { success, message, error_type } = response?.data || {};
      if (success) {
        alert('구글시트에서 스코어를 성공적으로 가져왔습니다.');
        setShowImportForm(false);
        setImportFormData({
          spreadsheetUrl: '',
          worksheetName: '',
          confirmDelete: false,
        });
        loadScores();
        refreshMemberAverages();
      } else {
        let errorMessage = message || '구글시트 가져오기에 실패했습니다.';
        if (error_type === 'authentication_failed') {
          errorMessage += '\n\n환경변수 설정을 확인해주세요.';
        } else if (error_type === 'data_fetch_failed') {
          errorMessage += '\n\n구글 시트 URL과 권한을 확인해주세요.';
        } else if (error_type === 'parsing_failed') {
          errorMessage += '\n\n시트 형식을 확인해주세요.';
        }
        alert(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        '구글시트 가져오기에 실패했습니다.';
      alert(`오류: ${errorMessage}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); // 로딩 시작

    try {
      if (editingScore) {
        // 단일 수정 모드
        await scoreAPI.updateScore(editingScore.id, formData);
      } else {
        // 다중 등록 모드
        let successCount = 0;
        let failCount = 0;
        for (const entry of formEntries) {
          const memberName = (entry.member_name || '').trim();
          if (!memberName) {
            continue; // 비어있는 행 건너뜀
          }
          try {
            await scoreAPI.addScore({
              member_name: memberName,
              game_date:
                entry.game_date || new Date().toISOString().split('T')[0],
              score1: parseInt(entry.score1) || 0,
              score2: parseInt(entry.score2) || 0,
              score3: parseInt(entry.score3) || 0,
              note: entry.note || '',
            });
            successCount++;
          } catch (err) {
            failCount++;
          }
        }
        alert(`등록 완료: ${successCount}건, 실패: ${failCount}건`);
      }

      // 폼 초기화
      setShowAddForm(false);
      setEditingScore(null);
      setFormData({
        member_name: '',
        game_date: '',
        score1: '',
        score2: '',
        score3: '',
        note: '',
      });
      setFormEntries([
        {
          member_name: '',
          game_date: '',
          score1: '',
          score2: '',
          score3: '',
          note: '',
        },
      ]);
      loadScores();
      loadMemberAverages();
    } catch (error) {
      // 에러 처리
    } finally {
      setSubmitting(false); // 로딩 종료
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말로 이 스코어를 삭제하시겠습니까?')) {
      setDeleting(true); // 로딩 시작
      try {
        await scoreAPI.deleteScore(id);
        loadScores();
        refreshMemberAverages();
      } catch (error) {
        // 에러 처리
        alert('스코어 삭제에 실패했습니다.');
      } finally {
        setDeleting(false); // 로딩 종료
      }
    }
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedScores([]);
    } else {
      // 전체 날짜 보기와 단일 날짜 보기에 따라 다르게 처리
      let allIds = [];
      if (showAllDates) {
        // 전체 날짜 보기: 현재 페이지의 모든 스코어
        const currentPageGroups = getPaginatedGroups();
        currentPageGroups.forEach((group) => {
          allIds.push(...group.scores.map((s) => s.id));
        });
      } else {
        // 단일 날짜 보기: 현재 날짜의 모든 스코어
        const currentGroup = getCurrentDateGroup();
        if (currentGroup) {
          allIds = currentGroup.scores.map((s) => s.id);
        }
      }
      setSelectedScores(allIds);
    }
    setSelectAll(!selectAll);
  };

  // 개별 선택/해제
  const handleSelectScore = (id) => {
    if (selectedScores.includes(id)) {
      setSelectedScores(selectedScores.filter((scoreId) => scoreId !== id));
      setSelectAll(false);
    } else {
      setSelectedScores([...selectedScores, id]);
    }
  };

  // 선택된 항목 일괄 삭제
  const handleDeleteSelected = async () => {
    if (selectedScores.length === 0) {
      alert('삭제할 스코어를 선택해주세요.');
      return;
    }

    if (
      window.confirm(
        `선택한 ${selectedScores.length}개의 스코어를 삭제하시겠습니까?`
      )
    ) {
      setDeleting(true); // 로딩 시작
      try {
        let successCount = 0;
        let failCount = 0;

        for (const id of selectedScores) {
          try {
            await scoreAPI.deleteScore(id);
            successCount++;
          } catch (error) {
            failCount++;
          }
        }

        if (successCount > 0) {
          alert(
            `${successCount}개 삭제 완료${
              failCount > 0 ? `, ${failCount}개 실패` : ''
            }`
          );
          setSelectedScores([]);
          setSelectAll(false);
          loadScores();
          refreshMemberAverages();
        } else {
          alert('스코어 삭제에 실패했습니다.');
        }
      } catch (error) {
        alert('스코어 삭제에 실패했습니다.');
      } finally {
        setDeleting(false); // 로딩 종료
      }
    }
  };

  // 인라인 편집 시작
  const startInlineEdit = (score) => {
    setInlineEditingId(score.id);
    setInlineEditData({
      member_name: score.member_name,
      game_date: score.game_date,
      score1: String(score.score1 ?? ''),
      score2: String(score.score2 ?? ''),
      score3: String(score.score3 ?? ''),
      note: score.note || '',
    });
  };

  // 인라인 편집 취소
  const cancelInlineEdit = () => {
    setInlineEditingId(null);
    setInlineEditData({
      member_name: '',
      game_date: '',
      score1: '',
      score2: '',
      score3: '',
      note: '',
    });
  };

  // 인라인 편집 저장
  const saveInlineEdit = async (scoreId) => {
    try {
      await scoreAPI.updateScore(scoreId, {
        ...inlineEditData,
        score1: parseInt(inlineEditData.score1) || 0,
        score2: parseInt(inlineEditData.score2) || 0,
        score3: parseInt(inlineEditData.score3) || 0,
      });

      // 전체 새로고침 없이 상태 갱신하고 그룹도 즉시 재계산
      setScores((prev) => {
        const updatedScores = prev.map((s) =>
          s.id === scoreId
            ? {
                ...s,
                member_name: inlineEditData.member_name,
                game_date: inlineEditData.game_date,
                score1: parseInt(inlineEditData.score1) || 0,
                score2: parseInt(inlineEditData.score2) || 0,
                score3: parseInt(inlineEditData.score3) || 0,
                total_score:
                  (parseInt(inlineEditData.score1) || 0) +
                  (parseInt(inlineEditData.score2) || 0) +
                  (parseInt(inlineEditData.score3) || 0),
                average_score: (() => {
                  const t =
                    (parseInt(inlineEditData.score1) || 0) +
                    (parseInt(inlineEditData.score2) || 0) +
                    (parseInt(inlineEditData.score3) || 0);
                  return t > 0 ? Math.round((t / 3) * 10) / 10 : 0;
                })(),
                note: inlineEditData.note,
              }
            : s
        );

        // 업데이트된 scores로 그룹 재계산
        groupScoresByDate(updatedScores);

        return updatedScores;
      });

      // 평균 순위도 새로고침
      loadMemberAverages();
      cancelInlineEdit();
    } catch (error) {
      alert('수정에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setFormData({
      member_name: '',
      game_date: '',
      score1: '',
      score2: '',
      score3: '',
      note: '',
    });
    setFormEntries([
      {
        member_name: '',
        game_date: '',
        score1: '',
        score2: '',
        score3: '',
        note: '',
      },
    ]);
    setEditingScore(null);
    setShowAddForm(false);
  };

  // 스코어 추가 폼으로 스크롤하는 함수
  const scrollToAddForm = () => {
    setShowAddForm(true);
    // 폼이 렌더링된 후 스크롤
    setTimeout(() => {
      const formSection = document.querySelector('.form-section');
      if (formSection) {
        formSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 100);
  };

  const calculateTotal = () => {
    const score1 = parseInt(formData.score1) || 0;
    const score2 = parseInt(formData.score2) || 0;
    const score3 = parseInt(formData.score3) || 0;
    return score1 + score2 + score3;
  };

  const calculateAverage = () => {
    const total = calculateTotal();
    return total > 0 ? (total / 3).toFixed(1) : 0;
  };

  // 메달 아이콘 렌더링 함수
  const renderMedalIcon = (rank) => {
    switch (rank) {
      case 1:
        return <span className="medal gold">🥇</span>;
      case 2:
        return <span className="medal silver">🥈</span>;
      case 3:
        return <span className="medal bronze">🥉</span>;
      default:
        return <span className="rank-number">{rank}</span>;
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="scores-page">
      <div className="page-header">
        <h1>스코어</h1>
        {isAdmin && (
          <div className="header-actions">
            <button className="btn btn-info" onClick={scrollToImportSection}>
              구글시트 가져오기
            </button>
            <button
              className="btn btn-success"
              onClick={() => {
                setShowPhotoForm(true);
                // AI 스코어 인식 섹션으로 스크롤
                setTimeout(() => {
                  const element = document.getElementById(
                    'ai-score-recognition'
                  );
                  if (element) {
                    element.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }
                }, 100); // 약간의 지연을 두어 섹션이 렌더링된 후 스크롤
              }}
            >
              AI로 스코어 인식
            </button>
            <button className="btn btn-primary" onClick={scrollToAddForm}>
              스코어 추가
            </button>
          </div>
        )}
      </div>

      {/* 회원별 평균 순위 섹션 */}
      <div className="member-averages-section">
        <div className="averages-container-new">
          {/* 평균 순위 테이블 */}
          <div className="averages-main-new">
            <div className="section-card">
              <div className="section-header">
                <h3 className="section-title">회원별 평균 순위</h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={refreshMemberAverages}
                  disabled={averagesLoading}
                >
                  {averagesLoading ? (
                    <>
                      <span className="loading-spinner"></span>
                      로딩 중...
                    </>
                  ) : (
                    '새로고침'
                  )}
                </button>
              </div>

              <div className="averages-info">
                <p>정기전 점수 기준 반기별 평균 순위입니다.</p>
              </div>

              {averagesLoading ? (
                <div className="loading">평균 순위 로딩 중...</div>
              ) : (
                <div className="averages-table-container">
                  <table className="averages-table-new">
                    <thead>
                      <tr>
                        <th>순위</th>
                        <th>회원명</th>
                        <th>평균 점수</th>
                        <th>티어</th>
                      </tr>
                    </thead>
                  </table>
                  {memberAverages && memberAverages.length > 0 ? (
                    <table className="averages-table-new">
                      <tbody>
                        {(showAllAverages
                          ? memberAverages
                          : memberAverages.slice(0, 10)
                        ).map((member) => (
                          <tr key={member.member_id}>
                            <td className="rank-column">
                              {renderMedalIcon(member.rank)}
                            </td>
                            <td className="name-column">
                              {member.member_name}
                            </td>
                            <td className="score-column">
                              {member.average_score}
                            </td>
                            <td className="tier-column">
                              <TierBadge tier={member.tier} size="small" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="averages-table-new">
                      <tbody>
                        <tr>
                          <td colSpan="4" className="no-data">
                            정기전 기록이 있는 회원이 없습니다.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {/* 더보기 버튼 */}
                  {memberAverages && memberAverages.length > 10 && (
                    <div className="show-more-btn-container">
                      <button
                        className="btn-more"
                        onClick={() => setShowAllAverages(!showAllAverages)}
                      >
                        {showAllAverages
                          ? '접기'
                          : `더보기 (${memberAverages.length - 10}명 더)`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 티어 기준표 */}
          <div className="tier-reference-new">
            <div className="section-card">
              <h3 className="section-title">티어 기준표</h3>
              <div className="tier-reference-table-new">
                <table>
                  <thead>
                    <tr>
                      <th>티어</th>
                      <th>비율(누적 상위 %)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="tier-row challenger">
                      <td>
                        <TierBadge tier="챌린저" size="small" />
                      </td>
                      <td>1% (0~1%)</td>
                    </tr>
                    <tr className="tier-row master">
                      <td>
                        <TierBadge tier="마스터" size="small" />
                      </td>
                      <td>3% (0~4%)</td>
                    </tr>
                    <tr className="tier-row diamond">
                      <td>
                        <TierBadge tier="다이아" size="small" />
                      </td>
                      <td>7% (4~11%)</td>
                    </tr>
                    <tr className="tier-row platinum">
                      <td>
                        <TierBadge tier="플레티넘" size="small" />
                      </td>
                      <td>12%(11~23%)</td>
                    </tr>
                    <tr className="tier-row gold">
                      <td>
                        <TierBadge tier="골드" size="small" />
                      </td>
                      <td>18%(23~41%)</td>
                    </tr>
                    <tr className="tier-row silver">
                      <td>
                        <TierBadge tier="실버" size="small" />
                      </td>
                      <td>22%(41~63%)</td>
                    </tr>
                    <tr className="tier-row bronze">
                      <td>
                        <TierBadge tier="브론즈" size="small" />
                      </td>
                      <td>20%(63~83%)</td>
                    </tr>
                    <tr className="tier-row iron">
                      <td>
                        <TierBadge tier="아이언" size="small" />
                      </td>
                      <td>17%(83~100%)</td>
                    </tr>
                    <tr className="tier-row unranked">
                      <td>
                        <TierBadge tier="배치" size="small" />
                      </td>
                      <td>기록 없음</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 개인별 검색 섹션 */}
      <div className="member-search-section">
        <div className="section-card">
          <h3 className="section-title">개인별 스코어 검색</h3>

          {showMemberSearch ? (
            <div className="search-form">
              <div className="search-row">
                <div className="form-group autocomplete-wrapper">
                  <input
                    type="text"
                    value={searchMember}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchMember(value);
                      // 검색어로 회원 필터링
                      const filtered = members.filter((member) =>
                        member.name.toLowerCase().includes(value.toLowerCase())
                      );
                      setFilteredMembers(filtered);
                      setShowDropdown(value.length > 0 && filtered.length > 0);
                    }}
                    onFocus={() => {
                      if (searchMember) {
                        const filtered = members.filter((member) =>
                          member.name
                            .toLowerCase()
                            .includes(searchMember.toLowerCase())
                        );
                        setFilteredMembers(filtered);
                        setShowDropdown(filtered.length > 0);
                      }
                    }}
                    onKeyPress={(e) =>
                      e.key === 'Enter' && handleMemberSearch()
                    }
                    placeholder="회원명을 입력하세요"
                    className="member-search-input"
                  />
                  {showDropdown && (
                    <div className="autocomplete-dropdown">
                      {filteredMembers.map((member) => (
                        <div
                          key={member.id}
                          className="autocomplete-item"
                          onClick={() => {
                            setSearchMember(member.name);
                            setShowDropdown(false);
                          }}
                        >
                          {member.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleMemberSearch}
                  disabled={!searchMember.trim()}
                >
                  검색
                </button>
              </div>
            </div>
          ) : (
            <div className="member-stats">
              {memberStats ? (
                <>
                  <div className="member-header">
                    <h4>{memberStats.memberName}님의 스코어 통계</h4>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={resetMemberSearch}
                    >
                      다른 회원 검색
                    </button>
                  </div>

                  <div className="member-stats-grid">
                    <div className="stat-card stat-primary">
                      <div className="stat-number">
                        {memberStats.totalGames}
                      </div>
                      <div className="stat-label">총 게임 수</div>
                    </div>
                    <div className="stat-card stat-success">
                      <div className="stat-number">
                        {memberStats.averageScore}
                      </div>
                      <div className="stat-label">평균 점수</div>
                    </div>
                    <div className="stat-card stat-info">
                      <div className="stat-number">
                        {memberStats.highestScore}
                      </div>
                      <div className="stat-label">최고 점수</div>
                    </div>
                    <div className="stat-card stat-warning">
                      <div className="stat-number">
                        {memberStats.lowestScore}
                      </div>
                      <div className="stat-label">최저 점수</div>
                    </div>
                  </div>

                  {/* 스코어 그래프 */}
                  <div className="score-chart-section">
                    <h5>평균점수 추이 그래프</h5>
                    <div className="chart-container">
                      {(() => {
                        // 디버깅을 위한 데이터 확인
                        console.log(
                          'memberStats.allScores:',
                          memberStats.allScores
                        );
                        const scores =
                          memberStats.allScores?.map(
                            (score) => score.average_score
                          ) || [];
                        console.log('average scores data:', scores);
                        return null;
                      })()}
                      {memberStats.allScores &&
                      memberStats.allScores.length > 0 ? (
                        <Line
                          data={{
                            labels: (() => {
                              const reversedScores = memberStats.allScores
                                .slice()
                                .reverse();
                              const monthGroups = {};

                              // 월별로 그룹화
                              reversedScores.forEach((score, index) => {
                                const date = new Date(score.game_date);
                                const monthKey = `${date.getFullYear()}-${
                                  date.getMonth() + 1
                                }`;
                                if (!monthGroups[monthKey]) {
                                  monthGroups[monthKey] = [];
                                }
                                monthGroups[monthKey].push({
                                  score,
                                  index,
                                  date,
                                });
                              });

                              // 라벨 생성
                              // - 각 월의 데이터를 날짜순으로 정렬하여 1-1, 1-2, 2-1, 2-2 형태로 표시
                              const labels = [];
                              Object.keys(monthGroups).forEach((monthKey) => {
                                const group = monthGroups[monthKey];
                                const monthNum =
                                  new Date(group[0].date).getMonth() + 1;

                                // 날짜순으로 정렬 (빠른 날짜가 먼저)
                                group.sort(
                                  (a, b) => new Date(a.date) - new Date(b.date)
                                );

                                group.forEach((item, groupIndex) => {
                                  const order = groupIndex + 1;
                                  labels[item.index] = `${monthNum}-${order}`;
                                });
                              });

                              return labels;
                            })(),
                            datasets: [
                              {
                                label: '평균점수',
                                data: memberStats.allScores
                                  .slice()
                                  .reverse()
                                  .map((score) => score.average_score),
                                borderColor: '#3b82f6',
                                backgroundColor: 'transparent',
                                borderWidth: 3,
                                pointRadius: 6,
                                pointHoverRadius: 8,
                                pointBackgroundColor: '#3b82f6',
                                pointBorderColor: '#ffffff',
                                pointBorderWidth: 2,
                                fill: false,
                                tension: 0.4,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                display: false,
                              },
                              tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                titleColor: '#ffffff',
                                bodyColor: '#ffffff',
                                borderColor: '#3b82f6',
                                borderWidth: 1,
                                cornerRadius: 8,
                                displayColors: false,
                                callbacks: {
                                  title: function (context) {
                                    const index = context[0].dataIndex;
                                    const reversedScores = memberStats.allScores
                                      .slice()
                                      .reverse();
                                    const score = reversedScores[index];
                                    const date = new Date(score.game_date);
                                    return `${date.getFullYear()}년 ${
                                      date.getMonth() + 1
                                    }월 ${date.getDate()}일`;
                                  },
                                  label: function (context) {
                                    const index = context.dataIndex;
                                    const reversedScores = memberStats.allScores
                                      .slice()
                                      .reverse();
                                    const score = reversedScores[index];
                                    return [
                                      `평균: ${score.average_score}`,
                                      `1게임: ${score.score1}`,
                                      `2게임: ${score.score2}`,
                                      `3게임: ${score.score3}`,
                                      `총점: ${score.total_score}`,
                                    ];
                                  },
                                },
                              },
                            },
                            scales: {
                              x: {
                                display: true,
                                title: {
                                  display: false,
                                },
                                grid: {
                                  display: false,
                                },
                                ticks: {
                                  maxRotation: 0,
                                  minRotation: 0,
                                  font: {
                                    size: 12,
                                    weight: '600',
                                  },
                                  callback: function (value, index, ticks) {
                                    const label = this.getLabelForValue(value);
                                    return label || '';
                                  },
                                },
                              },
                              y: {
                                display: true,
                                title: {
                                  display: false,
                                },
                                grid: {
                                  color: 'rgba(0, 0, 0, 0.1)',
                                  drawBorder: false,
                                },
                                ticks: {
                                  font: {
                                    size: 12,
                                  },
                                },
                                beginAtZero: true,
                                max: 300,
                              },
                            },
                            interaction: {
                              intersect: false,
                              mode: 'index',
                            },
                            elements: {
                              point: {
                                hoverBackgroundColor: '#3b82f6',
                              },
                            },
                          }}
                        />
                      ) : (
                        <div className="no-data-message">
                          <p>표시할 게임 기록이 없습니다.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 전체 게임 기록 */}
                  <div className="all-games">
                    <h5>전체 게임 기록 ({memberStats.totalGames}게임)</h5>
                    <div className="all-games-table">
                      <table>
                        <thead>
                          <tr>
                            <th>날짜</th>
                            <th>1게임</th>
                            <th>2게임</th>
                            <th>3게임</th>
                            <th>총점</th>
                            <th>평균</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberStats.allScores.map((score, index) => (
                            <tr key={index}>
                              <td>{score.game_date}</td>
                              <td>{score.score1}</td>
                              <td>{score.score2}</td>
                              <td>{score.score3}</td>
                              <td>
                                {score.score1 + score.score2 + score.score3}
                              </td>
                              <td>
                                {(
                                  (score.score1 + score.score2 + score.score3) /
                                  3
                                ).toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="no-results">
                  <div className="no-results-content">
                    <h4>검색결과가 없습니다</h4>
                    <p>해당 회원의 스코어 기록이 없습니다.</p>
                    <button
                      className="btn btn-primary"
                      onClick={resetMemberSearch}
                    >
                      다른 회원 검색
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 구글시트 가져오기 폼 (관리자만) */}
      {isAdmin && showImportForm && (
        <div id="sheet-import-section" className="import-section">
          <div className="section-card">
            <h3 className="section-title">구글시트에서 스코어 가져오기</h3>
            <div className="alert alert-warning import-alert">
              <strong>주의:</strong> 기존 스코어 모두 삭제 후 가져오기 (기존
              데이터가 모두 삭제됩니다)
            </div>
            <form onSubmit={handleImportFromSheets} className="import-form">
              <div className="form-row">
                <div className="form-group">
                  <label>구글시트 URL *</label>
                  <input
                    type="url"
                    value={importFormData.spreadsheetUrl}
                    onChange={(e) =>
                      setImportFormData({
                        ...importFormData,
                        spreadsheetUrl: e.target.value,
                      })
                    }
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label>워크시트 이름 (선택)</label>
                  <input
                    type="text"
                    value={importFormData.worksheetName}
                    onChange={(e) =>
                      setImportFormData({
                        ...importFormData,
                        worksheetName: e.target.value,
                      })
                    }
                    placeholder="Sheet1 (기본값)"
                  />
                </div>
              </div>
              <div className="form-group import-confirm">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={importFormData.confirmDelete}
                    onChange={(e) =>
                      setImportFormData({
                        ...importFormData,
                        confirmDelete: e.target.checked,
                      })
                    }
                    required
                  />
                  위 경고사항을 확인했습니다
                </label>
              </div>
              <div className="form-actions import-actions">
                <button type="submit" className="btn btn-primary">
                  구글시트에서 가져오기
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowImportForm(false)}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 사진으로 스코어 등록 폼 (관리자만) */}
      {isAdmin && showPhotoForm && (
        <div id="ai-score-recognition" className="photo-section">
          <div className="section-card">
            <h3 className="section-title">AI 스코어 인식</h3>

            {currentStep === 'upload' && (
              <div className="upload-step">
                <div className="form-group">
                  <label>볼링 점수표 사진 선택</label>
                  <div
                    className="file-input"
                    onClick={() =>
                      document.getElementById('file-upload').click()
                    }
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('drag-over');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('drag-over');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('drag-over');
                      const files = Array.from(e.dataTransfer.files);
                      if (files.length > 0) {
                        handleImageUpload({ target: { files } });
                      }
                    }}
                  >
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                    <div className="file-input-content">
                      {selectedImages.length > 0 ? (
                        <div className="file-input-images">
                          {imagePreviews.map((preview, index) => (
                            <div
                              key={index}
                              className="file-input-preview-wrapper"
                            >
                              <img
                                src={preview}
                                alt={`미리보기 ${index + 1}`}
                                className="file-input-preview"
                              />
                              <button
                                type="button"
                                className="file-input-remove-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImagePreviews(
                                    imagePreviews.filter((_, i) => i !== index)
                                  );
                                  setSelectedImages(
                                    selectedImages.filter((_, i) => i !== index)
                                  );
                                }}
                                title="이미지 제거"
                              >
                                ✕
                              </button>
                              <div className="file-input-number">
                                {index + 1}
                              </div>
                            </div>
                          ))}
                          <div className="file-input-overlay">
                            <div className="file-input-icon">+</div>
                            <div className="file-input-text">더 추가하기</div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="file-input-icon">📁</div>
                          <div className="file-input-text">
                            클릭하거나 파일을 드래그하세요
                          </div>
                          <div className="file-input-subtext">
                            JPG, PNG, GIF 파일을 여러 개 선택할 수 있습니다
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="form-text">
                    AI가 자동으로 모든 스코어를 인식합니다.
                  </div>

                  {selectedImages.length > 0 && (
                    <div className="file-input-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-lg"
                        onClick={handleAnalyzeImage}
                        disabled={aiAnalyzing}
                      >
                        {aiAnalyzing ? (
                          <>
                            <span className="spinner"></span>
                            AI 분석 중... ({analyzingProgress.current}/
                            {analyzingProgress.total})
                          </>
                        ) : (
                          `AI 스코어 인식 (${selectedImages.length}개 사진)`
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* AI 분석 중 로딩 오버레이 */}
                {aiAnalyzing && (
                  <div className="ai-analyzing-overlay">
                    <div className="ai-analyzing-content">
                      <div className="spinner-large"></div>
                      <h3>🤖 AI가 스코어를 분석하고 있습니다...</h3>
                      <p>이미지 크기에 따라 최대 2분 정도 걸릴 수 있습니다.</p>
                      {analyzingProgress.total > 1 && (
                        <p className="progress-text">
                          📸 {analyzingProgress.current} /{' '}
                          {analyzingProgress.total} 사진 분석 중
                        </p>
                      )}
                      <p className="please-wait">잠시만 기다려주세요 ⏳</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 'result' && ocrResults.length > 0 && (
              <div className="result-step">
                <h4>AI 인식 결과</h4>
                <div className="ocr-summary">
                  <p>인식된 회원 수: {ocrResults.length}명</p>
                  <p className="edit-hint">
                    💡 숫자와 날짜를 클릭하여 수정할 수 있습니다
                  </p>
                </div>

                {/* 게임 날짜 선택 */}
                <div className="game-date-selector">
                  <label>게임 날짜:</label>
                  <input
                    type="date"
                    value={
                      ocrResults[0]?.game_date ||
                      new Date().toISOString().split('T')[0]
                    }
                    onChange={(e) => {
                      const newResults = ocrResults.map((result) => ({
                        ...result,
                        game_date: e.target.value,
                      }));
                      setOcrResults(newResults);
                    }}
                    className="date-input-large"
                  />
                </div>

                {/* 원본 이미지 표시 */}
                {imagePreviews.length > 0 && (
                  <div className="image-preview-result">
                    <h5>원본 이미지 ({imagePreviews.length}개)</h5>
                    <div className="result-images-grid">
                      {imagePreviews.map((preview, index) => (
                        <img
                          key={index}
                          src={preview}
                          alt={`원본 이미지 ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="ocr-results-table">
                  <table>
                    <thead>
                      <tr>
                        <th>회원명</th>
                        <th>1게임</th>
                        <th>2게임</th>
                        <th>3게임</th>
                        <th>총점</th>
                        <th>평균</th>
                        <th>비고</th>
                        <th>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocrResults.map((result, index) => {
                        const total =
                          (parseInt(result.score1) || 0) +
                          (parseInt(result.score2) || 0) +
                          (parseInt(result.score3) || 0);
                        const average =
                          total > 0 ? (total / 3).toFixed(1) : '0.0';

                        return (
                          <tr key={index}>
                            <td>
                              <select
                                value={result.member_name}
                                onChange={(e) => {
                                  const newResults = [...ocrResults];
                                  newResults[index].member_name =
                                    e.target.value;
                                  setOcrResults(newResults);
                                }}
                                className="editable-input name-select"
                              >
                                <option value="">회원 선택</option>
                                {members.map((member) => (
                                  <option key={member.id} value={member.name}>
                                    {member.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                value={result.score1}
                                onChange={(e) => {
                                  const newResults = [...ocrResults];
                                  newResults[index].score1 =
                                    parseInt(e.target.value) || 0;
                                  setOcrResults(newResults);
                                }}
                                min="0"
                                max="300"
                                className="editable-input score-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={result.score2}
                                onChange={(e) => {
                                  const newResults = [...ocrResults];
                                  newResults[index].score2 =
                                    parseInt(e.target.value) || 0;
                                  setOcrResults(newResults);
                                }}
                                min="0"
                                max="300"
                                className="editable-input score-input"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={result.score3}
                                onChange={(e) => {
                                  const newResults = [...ocrResults];
                                  newResults[index].score3 =
                                    parseInt(e.target.value) || 0;
                                  setOcrResults(newResults);
                                }}
                                min="0"
                                max="300"
                                className="editable-input score-input"
                              />
                            </td>
                            <td className="total-cell">{total}</td>
                            <td className="average-cell">{average}</td>
                            <td>
                              <input
                                type="text"
                                value={result.note || ''}
                                onChange={(e) => {
                                  const newResults = [...ocrResults];
                                  newResults[index].note = e.target.value;
                                  setOcrResults(newResults);
                                }}
                                className="editable-input note-input"
                                placeholder="비고 입력"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => {
                                  const newResults = ocrResults.filter(
                                    (_, i) => i !== index
                                  );
                                  setOcrResults(newResults);
                                }}
                                title="삭제"
                              >
                                X
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* 인원 추가 버튼 */}
                  <div className="add-person-row">
                    <button
                      type="button"
                      className="btn btn-secondary btn-add-person"
                      onClick={() => {
                        const newPerson = {
                          member_name: '',
                          game_date:
                            ocrResults[0]?.game_date ||
                            new Date().toISOString().split('T')[0],
                          score1: 0,
                          score2: 0,
                          score3: 0,
                        };
                        setOcrResults([...ocrResults, newPerson]);
                      }}
                    >
                      ➕ 인원 추가
                    </button>
                  </div>
                </div>

                <div className="ocr-actions">
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleSaveOcrResults}
                    disabled={aiAnalyzing}
                  >
                    {aiAnalyzing ? (
                      <>
                        <span className="spinner"></span>
                        저장 중... ({analyzingProgress.current}/
                        {analyzingProgress.total})
                      </>
                    ) : (
                      '스코어 저장'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCurrentStep('upload')}
                  >
                    다른 이미지 선택
                  </button>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPhotoForm(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스코어 추가/수정 폼 (관리자만) */}
      {isAdmin && showAddForm && (
        <div className="form-section">
          <div className="section-card">
            <h3 className="section-title">
              {editingScore ? '스코어 수정' : '스코어 등록'}
            </h3>
            <div className="table-form-container">
              <div className="table-form-header">
                <div className="header-buttons">
                  {/* 포인트 UI와 동일한 헤더 영역 (버튼 없음) */}
                </div>
              </div>
              <form
                onSubmit={handleSubmit}
                className={`score-form compact-form ${
                  submitting ? 'submitting' : ''
                }`}
              >
                {editingScore ? (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>회원 이름 *</label>
                        <select
                          value={formData.member_name}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              member_name: e.target.value,
                            })
                          }
                          required
                          disabled={submitting}
                        >
                          <option value="">회원 선택</option>
                          {members.map((member) => (
                            <option key={member.id} value={member.name}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>게임 날짜</label>
                        <input
                          type="date"
                          value={formData.game_date}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              game_date: e.target.value,
                            })
                          }
                          disabled={submitting}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>1게임</label>
                        <input
                          type="number"
                          min="0"
                          max="300"
                          value={formData.score1}
                          onChange={(e) =>
                            setFormData({ ...formData, score1: e.target.value })
                          }
                          disabled={submitting}
                        />
                      </div>
                      <div className="form-group">
                        <label>2게임</label>
                        <input
                          type="number"
                          min="0"
                          max="300"
                          value={formData.score2}
                          onChange={(e) =>
                            setFormData({ ...formData, score2: e.target.value })
                          }
                          disabled={submitting}
                        />
                      </div>
                      <div className="form-group">
                        <label>3게임</label>
                        <input
                          type="number"
                          min="0"
                          max="300"
                          value={formData.score3}
                          onChange={(e) =>
                            setFormData({ ...formData, score3: e.target.value })
                          }
                          disabled={submitting}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>총점</label>
                        <input
                          type="number"
                          value={calculateTotal()}
                          readOnly
                          className="readonly"
                        />
                      </div>
                      <div className="form-group">
                        <label>평균</label>
                        <input
                          type="number"
                          value={calculateAverage()}
                          readOnly
                          className="readonly"
                        />
                      </div>
                      <div className="form-group">
                        <label>비고</label>
                        <input
                          type="text"
                          value={formData.note}
                          onChange={(e) =>
                            setFormData({ ...formData, note: e.target.value })
                          }
                          disabled={submitting}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="table-form-table">
                      <table>
                        <thead>
                          <tr>
                            <th>날짜</th>
                            <th>회원</th>
                            <th>1G</th>
                            <th>2G</th>
                            <th>3G</th>
                            <th>비고</th>
                            <th>작업</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formEntries.map((entry, index) => (
                            <tr key={index}>
                              <td>
                                <input
                                  type="date"
                                  value={entry.game_date}
                                  onChange={(e) =>
                                    updateEntryField(
                                      index,
                                      'game_date',
                                      e.target.value
                                    )
                                  }
                                  className={
                                    index === 0 ? 'master-date-input' : ''
                                  }
                                  title={
                                    index === 0
                                      ? '이 날짜가 모든 행에 적용됩니다'
                                      : ''
                                  }
                                  disabled={submitting}
                                />
                                {index === 0 && formEntries.length > 1 && (
                                  <div className="date-sync-indicator">
                                    모든 행에 적용됨
                                  </div>
                                )}
                              </td>
                              <td>
                                <select
                                  value={entry.member_name}
                                  onChange={(e) =>
                                    updateEntryField(
                                      index,
                                      'member_name',
                                      e.target.value
                                    )
                                  }
                                  required
                                  disabled={submitting}
                                >
                                  <option value="">회원 선택</option>
                                  {members.map((member) => (
                                    <option key={member.id} value={member.name}>
                                      {member.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="300"
                                  value={entry.score1}
                                  onChange={(e) =>
                                    updateEntryField(
                                      index,
                                      'score1',
                                      e.target.value
                                    )
                                  }
                                  disabled={submitting}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="300"
                                  value={entry.score2}
                                  onChange={(e) =>
                                    updateEntryField(
                                      index,
                                      'score2',
                                      e.target.value
                                    )
                                  }
                                  disabled={submitting}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="300"
                                  value={entry.score3}
                                  onChange={(e) =>
                                    updateEntryField(
                                      index,
                                      'score3',
                                      e.target.value
                                    )
                                  }
                                  disabled={submitting}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={entry.note}
                                  onChange={(e) =>
                                    updateEntryField(
                                      index,
                                      'note',
                                      e.target.value
                                    )
                                  }
                                  placeholder="메모"
                                  disabled={submitting}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger"
                                  onClick={() => removeScoreRow(index)}
                                  disabled={
                                    formEntries.length === 1 || submitting
                                  }
                                >
                                  삭제
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="sticky-add-row">
                      <button
                        type="button"
                        className="add-row-btn"
                        onClick={addScoreRow}
                        disabled={submitting}
                        aria-label="행 추가"
                        title="행 추가"
                      >
                        +
                      </button>
                    </div>
                  </>
                )}
                <div className="form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <div className="loading-spinner"></div>
                        {editingScore ? '수정 중...' : '등록 중...'}
                      </>
                    ) : editingScore ? (
                      '수정'
                    ) : (
                      `등록 (${formEntries.length}명)`
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetForm}
                    disabled={submitting}
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 스코어 목록 */}
      <div className="scores-section">
        <div className="section-card">
          <div className="scores-header">
            <div className="header-left">
              <h3 className="section-title">스코어 기록</h3>
            </div>
            <div className="header-right">
              {selectedScores.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <div className="loading-spinner"></div>
                      삭제 중... ({selectedScores.length})
                    </>
                  ) : (
                    `선택 삭제 (${selectedScores.length})`
                  )}
                </button>
              )}
              <div className="view-toggle">
                <button
                  className={`btn btn-sm ${
                    showAllDates ? 'btn-primary' : 'btn-outline-secondary'
                  }`}
                  onClick={() => setShowAllDates(true)}
                >
                  전체 보기
                </button>
                <button
                  className={`btn btn-sm ${
                    !showAllDates ? 'btn-primary' : 'btn-outline-secondary'
                  }`}
                  onClick={() => {
                    setShowAllDates(false);
                    setCurrentDateIndex(0);
                  }}
                >
                  단일 날짜 보기
                </button>
              </div>
            </div>
          </div>

          {showAllDates ? (
            // 전체 날짜 보기
            <div className="scores-table">
              <table>
                <thead>
                  <tr>
                    {isAdmin && (
                      <th className="checkbox-col" style={{ width: '50px' }}>
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                          className="select-checkbox"
                        />
                      </th>
                    )}
                    <th className="member-name-col">회원명</th>
                    <th>1게임</th>
                    <th>2게임</th>
                    <th>3게임</th>
                    <th>총점</th>
                    <th>평균</th>
                    <th>비고</th>
                    {isAdmin && <th>작업</th>}
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedGroups().map((group) => (
                    <React.Fragment key={group.date}>
                      {/* 날짜 헤더 행 */}
                      <tr className="date-header-row">
                        <td
                          colSpan={isAdmin ? '8' : '7'}
                          className="date-header"
                        >
                          <div className="date-header-content">
                            {isSuperAdmin && editingGroupDate === group.date ? (
                              <div className="inline-date-editor">
                                <input
                                  type="date"
                                  className="inline-input"
                                  value={newGroupDate}
                                  onChange={(e) =>
                                    setNewGroupDate(e.target.value)
                                  }
                                />
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => saveGroupDateEdit(group.date)}
                                >
                                  저장
                                </button>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={cancelGroupDateEdit}
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <span
                                className="date-text"
                                onClick={() =>
                                  isSuperAdmin && startGroupDateEdit(group.date)
                                }
                                style={{
                                  cursor: isSuperAdmin ? 'pointer' : 'default',
                                }}
                              >
                                {group.date}
                              </span>
                            )}
                            <div className="date-stats">
                              <span className="stat-item">
                                참여: {group.memberCount}명
                              </span>
                              <span className="stat-item">
                                총점: {group.totalScore}
                              </span>
                              <span className="stat-item">
                                평균: {group.averageScore}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* 해당 날짜의 스코어들 */}
                      {group.scores.map((score) => (
                        <tr key={score.id} className="score-row">
                          {inlineEditingId === score.id ? (
                            <>
                              {isAdmin && (
                                <td className="checkbox-col">
                                  <input
                                    type="checkbox"
                                    checked={selectedScores.includes(score.id)}
                                    onChange={() => handleSelectScore(score.id)}
                                    className="select-checkbox"
                                  />
                                </td>
                              )}
                              <td className="member-name-col">
                                <select
                                  className="inline-select"
                                  value={inlineEditData.member_name}
                                  onChange={(e) =>
                                    setInlineEditData((prev) => ({
                                      ...prev,
                                      member_name: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">회원 선택</option>
                                  {members.map((m) => (
                                    <option key={m.id} value={m.name}>
                                      {m.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  className="inline-input"
                                  type="number"
                                  min="0"
                                  max="300"
                                  value={inlineEditData.score1}
                                  onChange={(e) =>
                                    setInlineEditData((prev) => ({
                                      ...prev,
                                      score1: e.target.value,
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  className="inline-input"
                                  type="number"
                                  min="0"
                                  max="300"
                                  value={inlineEditData.score2}
                                  onChange={(e) =>
                                    setInlineEditData((prev) => ({
                                      ...prev,
                                      score2: e.target.value,
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  className="inline-input"
                                  type="number"
                                  min="0"
                                  max="300"
                                  value={inlineEditData.score3}
                                  onChange={(e) =>
                                    setInlineEditData((prev) => ({
                                      ...prev,
                                      score3: e.target.value,
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                {(parseInt(inlineEditData.score1) || 0) +
                                  (parseInt(inlineEditData.score2) || 0) +
                                  (parseInt(inlineEditData.score3) || 0)}
                              </td>
                              <td>
                                {(() => {
                                  const t =
                                    (parseInt(inlineEditData.score1) || 0) +
                                    (parseInt(inlineEditData.score2) || 0) +
                                    (parseInt(inlineEditData.score3) || 0);
                                  return t > 0 ? (t / 3).toFixed(1) : '0.0';
                                })()}
                              </td>
                              <td>
                                <input
                                  className="inline-input"
                                  type="text"
                                  value={inlineEditData.note}
                                  onChange={(e) =>
                                    setInlineEditData((prev) => ({
                                      ...prev,
                                      note: e.target.value,
                                    }))
                                  }
                                />
                              </td>
                              <td className="inline-actions">
                                <button
                                  className="btn btn-sm btn-primary"
                                  onClick={() => saveInlineEdit(score.id)}
                                >
                                  완료
                                </button>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={cancelInlineEdit}
                                >
                                  취소
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              {isAdmin && (
                                <td className="checkbox-col">
                                  <input
                                    type="checkbox"
                                    checked={selectedScores.includes(score.id)}
                                    onChange={() => handleSelectScore(score.id)}
                                    className="select-checkbox"
                                  />
                                </td>
                              )}
                              <td className="member-name-col">
                                {score.member_name}
                              </td>
                              <td>{score.score1}</td>
                              <td>{score.score2}</td>
                              <td>{score.score3}</td>
                              <td>
                                {score.score1 + score.score2 + score.score3}
                              </td>
                              <td>
                                {(
                                  (score.score1 + score.score2 + score.score3) /
                                  3
                                ).toFixed(1)}
                              </td>
                              <td>{score.note || '-'}</td>
                              {isAdmin && (
                                <td className="inline-actions">
                                  <button
                                    className="btn btn-sm btn-edit"
                                    onClick={() => startInlineEdit(score)}
                                  >
                                    수정
                                  </button>
                                  <button
                                    className="btn btn-sm btn-delete"
                                    onClick={() => handleDelete(score.id)}
                                    disabled={deleting}
                                  >
                                    {deleting ? (
                                      <>
                                        <div className="loading-spinner"></div>
                                        삭제 중...
                                      </>
                                    ) : (
                                      '삭제'
                                    )}
                                  </button>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {groupedScores.length > itemsPerPage && (
                <div className="pagination-controls">
                  <button
                    className="btn btn-primary"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    이전
                  </button>
                  <span>
                    페이지 {currentPage} / {getTotalPages()}
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === getTotalPages()}
                  >
                    다음
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleSortOrderChange}
                  >
                    {sortOrder === 'desc' ? '오래된순' : '최신순'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            // 단일 날짜 보기 (좌우 화살표)
            <div className="single-date-view">
              {getCurrentDateGroup() && (
                <>
                  <div className="date-navigation">
                    <button
                      className="btn btn-outline-primary nav-btn"
                      onClick={goToFirstDate}
                      disabled={currentDateIndex === 0}
                      title="첫 번째 날짜"
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M18 17L13 12L18 7M11 17L6 12L11 7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      className="btn btn-outline-primary nav-btn"
                      onClick={goToPreviousDate}
                      disabled={currentDateIndex === 0}
                      title="이전 날짜"
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M15 18L9 12L15 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <div className="current-date-info">
                      {isSuperAdmin &&
                      editingGroupDate === getCurrentDateGroup().date ? (
                        <div className="inline-date-editor">
                          <input
                            type="date"
                            className="inline-input"
                            value={newGroupDate}
                            onChange={(e) => setNewGroupDate(e.target.value)}
                          />
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() =>
                              saveGroupDateEdit(getCurrentDateGroup().date)
                            }
                          >
                            저장
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={cancelGroupDateEdit}
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <span
                          className="date-display"
                          onClick={() =>
                            isSuperAdmin &&
                            startGroupDateEdit(getCurrentDateGroup().date)
                          }
                          style={{
                            cursor: isSuperAdmin ? 'pointer' : 'default',
                          }}
                        >
                          {getCurrentDateGroup().date}
                        </span>
                      )}
                      <div className="date-details">
                        <span className="participant-count">
                          참여: {getCurrentDateGroup().memberCount}명
                        </span>
                        <span className="date-counter">
                          {currentDateIndex + 1} / {groupedScores.length}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-outline-primary nav-btn"
                      onClick={goToNextDate}
                      disabled={currentDateIndex === groupedScores.length - 1}
                      title="다음 날짜"
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M9 18L15 12L9 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      className="btn btn-outline-primary nav-btn"
                      onClick={goToLastDate}
                      disabled={currentDateIndex === groupedScores.length - 1}
                      title="마지막 날짜"
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M6 17L11 12L6 7M13 17L18 12L13 7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="single-date-table">
                    <table>
                      <thead>
                        <tr>
                          {isAdmin && (
                            <th
                              className="checkbox-col"
                              style={{ width: '50px' }}
                            >
                              <input
                                type="checkbox"
                                checked={selectAll}
                                onChange={handleSelectAll}
                                className="select-checkbox"
                              />
                            </th>
                          )}
                          <th className="member-name-col">회원명</th>
                          <th>1게임</th>
                          <th>2게임</th>
                          <th>3게임</th>
                          <th>총점</th>
                          <th>평균</th>
                          <th>비고</th>
                          {isAdmin && <th>작업</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {getCurrentDateGroup().scores.map((score) => (
                          <tr key={score.id} className="score-row">
                            {inlineEditingId === score.id ? (
                              <>
                                {isAdmin && (
                                  <td className="checkbox-col">
                                    <input
                                      type="checkbox"
                                      checked={selectedScores.includes(
                                        score.id
                                      )}
                                      onChange={() =>
                                        handleSelectScore(score.id)
                                      }
                                      className="select-checkbox"
                                    />
                                  </td>
                                )}
                                <td className="member-name-col">
                                  <select
                                    className="inline-select"
                                    value={inlineEditData.member_name}
                                    onChange={(e) =>
                                      setInlineEditData((prev) => ({
                                        ...prev,
                                        member_name: e.target.value,
                                      }))
                                    }
                                  >
                                    <option value="">회원 선택</option>
                                    {members.map((m) => (
                                      <option key={m.id} value={m.name}>
                                        {m.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    className="inline-input"
                                    type="number"
                                    min="0"
                                    max="300"
                                    value={inlineEditData.score1}
                                    onChange={(e) =>
                                      setInlineEditData((prev) => ({
                                        ...prev,
                                        score1: e.target.value,
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    className="inline-input"
                                    type="number"
                                    min="0"
                                    max="300"
                                    value={inlineEditData.score2}
                                    onChange={(e) =>
                                      setInlineEditData((prev) => ({
                                        ...prev,
                                        score2: e.target.value,
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    className="inline-input"
                                    type="number"
                                    min="0"
                                    max="300"
                                    value={inlineEditData.score3}
                                    onChange={(e) =>
                                      setInlineEditData((prev) => ({
                                        ...prev,
                                        score3: e.target.value,
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  {(parseInt(inlineEditData.score1) || 0) +
                                    (parseInt(inlineEditData.score2) || 0) +
                                    (parseInt(inlineEditData.score3) || 0)}
                                </td>
                                <td>
                                  {(() => {
                                    const t =
                                      (parseInt(inlineEditData.score1) || 0) +
                                      (parseInt(inlineEditData.score2) || 0) +
                                      (parseInt(inlineEditData.score3) || 0);
                                    return t > 0 ? (t / 3).toFixed(1) : '0.0';
                                  })()}
                                </td>
                                <td>
                                  <input
                                    className="inline-input"
                                    type="text"
                                    value={inlineEditData.note}
                                    onChange={(e) =>
                                      setInlineEditData((prev) => ({
                                        ...prev,
                                        note: e.target.value,
                                      }))
                                    }
                                  />
                                </td>
                                <td className="inline-actions">
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => saveInlineEdit(score.id)}
                                  >
                                    완료
                                  </button>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={cancelInlineEdit}
                                  >
                                    취소
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                {isAdmin && (
                                  <td className="checkbox-col">
                                    <input
                                      type="checkbox"
                                      checked={selectedScores.includes(
                                        score.id
                                      )}
                                      onChange={() =>
                                        handleSelectScore(score.id)
                                      }
                                      className="select-checkbox"
                                    />
                                  </td>
                                )}
                                <td className="member-name-col">
                                  {score.member_name}
                                </td>
                                <td>{score.score1}</td>
                                <td>{score.score2}</td>
                                <td>{score.score3}</td>
                                <td>
                                  {score.score1 + score.score2 + score.score3}
                                </td>
                                <td>
                                  {(
                                    (score.score1 +
                                      score.score2 +
                                      score.score3) /
                                    3
                                  ).toFixed(1)}
                                </td>
                                <td>{score.note || '-'}</td>
                                {isAdmin && (
                                  <td className="inline-actions">
                                    <button
                                      className="btn btn-sm btn-edit"
                                      onClick={() => startInlineEdit(score)}
                                    >
                                      수정
                                    </button>
                                    <button
                                      className="btn btn-sm btn-delete"
                                      onClick={() => handleDelete(score.id)}
                                      disabled={deleting}
                                    >
                                      {deleting ? (
                                        <>
                                          <div className="loading-spinner"></div>
                                          삭제 중...
                                        </>
                                      ) : (
                                        '삭제'
                                      )}
                                    </button>
                                  </td>
                                )}
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Scores;
