import React, { useState, useEffect, useRef } from 'react';
import { scoreAPI, sheetsAPI, memberAPI, ocrAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Scores.css';

const Scores = () => {
  const { user } = useAuth(); // 현재 사용자 정보
  const isAdmin =
    user && (user.role === 'admin' || user.role === 'super_admin');
  const [scores, setScores] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [selectionBox, setSelectionBox] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // 구글시트 가져오기 관련 상태
  const [showImportForm, setShowImportForm] = useState(false);
  const [importFormData, setImportFormData] = useState({
    spreadsheetUrl: '',
    worksheetName: '',
    confirmDelete: false,
  });

  // 통계 상태
  const [stats, setStats] = useState({
    totalScores: 0,
    averageScore: 0,
    highestScore: 0,
    sectionStats: {},
  });

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

  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    loadScores();
    loadMembers();
  }, []);

  const loadScores = async () => {
    try {
      setLoading(true);
      const response = await scoreAPI.getScores();
      if (response.data.success) {
        setScores(response.data.scores);
        calculateStats(response.data.scores);
      }
    } catch (error) {
      console.error('스코어 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await memberAPI.getMembers();
      if (response.data.success) {
        setMembers(response.data.members);
      }
    } catch (error) {
      console.error('회원 목록 로드 실패:', error);
    }
  };

  const calculateStats = (scoreList) => {
    if (!scoreList || scoreList.length === 0) return;

    const totalScores = scoreList.length;
    const allScores = scoreList
      .flatMap((score) => [score.score1, score.score2, score.score3])
      .filter((s) => s > 0);
    const averageScore =
      allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0;
    const highestScore = Math.max(...allScores, 0);

    // 섹션별 통계 계산
    const sectionStats = {};
    scoreList.forEach((score) => {
      const section = score.section || 'A';
      if (!sectionStats[section]) {
        sectionStats[section] = { count: 0, total: 0, scores: [] };
      }
      sectionStats[section].count++;
      sectionStats[section].total += score.score1 + score.score2 + score.score3;
      sectionStats[section].scores.push(
        score.score1,
        score.score2,
        score.score3
      );
    });

    // 섹션별 평균 계산
    Object.keys(sectionStats).forEach((section) => {
      const scores = sectionStats[section].scores.filter((s) => s > 0);
      sectionStats[section].average =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
    });

    setStats({ totalScores, averageScore, highestScore, sectionStats });
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

    // 전체 게임 기록 (날짜순 정렬)
    const allScoresSorted = memberScores.sort(
      (a, b) => new Date(b.game_date) - new Date(a.created_at)
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
  const groupScoresByDate = (scoreList) => {
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
        return sortOrder === 'desc' ? dateObjB - dateObjA : dateObjA - dateObjB;
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
  };

  // 스코어 로드 시 그룹화 실행
  useEffect(() => {
    if (scores.length > 0) {
      groupScoresByDate(scores);
    }
  }, [scores, sortOrder]);

  // 이미지 업로드 처리 (다중 이미지 지원)
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      setSelectedImages(files);

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
        setImagePreviews(previews);
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
          console.warn(`이미지 ${i + 1} 분석 실패:`, response.data.message);
        }
      }

      if (allResults.length > 0) {
        setOcrResults(allResults);
        setCurrentStep('result');
      } else {
        alert('AI 스코어 인식에 실패했습니다. 이미지를 확인해주세요.');
      }
    } catch (error) {
      console.error('AI 스코어 인식 실패:', error);

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

      let successCount = 0;
      let failCount = 0;
      const errors = [];

      for (let i = 0; i < ocrResults.length; i++) {
        const result = ocrResults[i];
        try {
          await scoreAPI.addScore({
            member_name: result.member_name.trim(),
            game_date:
              result.game_date || new Date().toISOString().split('T')[0],
            score1: parseInt(result.score1) || 0,
            score2: parseInt(result.score2) || 0,
            score3: parseInt(result.score3) || 0,
            note: result.note || '', // 비고 추가
          });
          successCount++;
        } catch (error) {
          failCount++;
          const errorMsg = error.response?.data?.message || error.message;
          errors.push(`${result.member_name || '(이름없음)'}: ${errorMsg}`);
          console.error(
            `스코어 저장 실패 [${i + 1}/${ocrResults.length}]:`,
            error
          );
        }
      }

      if (successCount > 0 && failCount === 0) {
        alert(`✅ ${successCount}명의 스코어가 저장되었습니다.`);
      } else if (successCount > 0 && failCount > 0) {
        alert(
          `일부 저장 완료\n성공: ${successCount}명\n실패: ${failCount}명\n\n실패 내역:\n${errors.join(
            '\n'
          )}`
        );
      } else {
        alert(`❌ 스코어 저장에 실패했습니다.\n\n${errors.join('\n')}`);
        return; // 모두 실패하면 폼을 닫지 않음
      }
      setShowPhotoForm(false);
      setOcrResults([]);
      setSelectedImages([]);
      setImagePreviews([]);
      setCurrentStep('upload');
      loadScores();
    } catch (error) {
      console.error('OCR 결과 저장 실패:', error);
      alert('스코어 저장에 실패했습니다.');
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
      console.error('구글시트 가져오기 실패:', error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        '구글시트 가져오기에 실패했습니다.';
      alert(`오류: ${errorMessage}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
            console.error('행 저장 실패:', entry, err);
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
    } catch (error) {
      console.error('스코어 저장 실패:', error);
    }
  };

  const handleEdit = (score) => {
    setEditingScore(score);
    setFormData({
      member_name: score.member_name,
      game_date: score.game_date,
      score1: score.score1,
      score2: score.score2,
      score3: score.score3,
      note: score.note || '',
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('정말로 이 스코어를 삭제하시겠습니까?')) {
      try {
        await scoreAPI.deleteScore(id);
        loadScores();
      } catch (error) {
        console.error('스코어 삭제 실패:', error);
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
      try {
        let successCount = 0;
        let failCount = 0;

        for (const id of selectedScores) {
          try {
            await scoreAPI.deleteScore(id);
            successCount++;
          } catch (error) {
            console.error(`스코어 ${id} 삭제 실패:`, error);
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
        } else {
          alert('스코어 삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('일괄 삭제 실패:', error);
        alert('스코어 삭제에 실패했습니다.');
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

      cancelInlineEdit();
    } catch (error) {
      console.error('인라인 수정 실패:', error);
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

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="scores-page">
      <div className="page-header">
        <h1>2025 스코어 관리</h1>
        {isAdmin && (
          <div className="header-actions">
            <button
              className="btn btn-info"
              onClick={() => setShowImportForm(true)}
            >
              구글시트 가져오기
            </button>
            <button
              className="btn btn-success"
              onClick={() => setShowPhotoForm(true)}
            >
              AI로 스코어 인식
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              스코어 추가
            </button>
          </div>
        )}
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
                    placeholder="회원명을 입력하거나 선택하세요"
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
              {memberStats && (
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* 구글시트 가져오기 폼 (관리자만) */}
      {isAdmin && showImportForm && (
        <div className="import-section">
          <div className="section-card">
            <h3 className="section-title">구글시트에서 스코어 가져오기</h3>
            <div className="alert alert-warning">
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
              <div className="form-group">
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
              <div className="form-actions">
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
        <div className="photo-section">
          <div className="section-card">
            <h3 className="section-title">AI 스코어 인식</h3>

            {currentStep === 'upload' && (
              <div className="upload-step">
                <div className="form-group">
                  <label>볼링 점수표 사진 선택</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="file-input"
                  />
                  <div className="form-text">
                    JPG, PNG, GIF 파일을 여러 개 선택할 수 있습니다. AI가
                    자동으로 모든 스코어를 인식합니다.
                  </div>
                </div>

                {imagePreviews.length > 0 && (
                  <div className="image-preview-section">
                    <div className="images-grid">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="image-preview-wrapper">
                          <img src={preview} alt={`미리보기 ${index + 1}`} />
                          <button
                            type="button"
                            className="image-remove-btn"
                            onClick={() => {
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
                          <div className="image-number">{index + 1}</div>
                        </div>
                      ))}
                    </div>
                    <div className="preview-actions">
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
                  </div>
                )}

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
                                ❌
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
                  >
                    스코어 저장
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
              {editingScore ? '스코어 수정' : '새 스코어 등록'}
            </h3>
            <form onSubmit={handleSubmit} className="score-form compact-form">
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
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {formEntries.map((entry, index) => (
                    <div className="entry-card" key={index}>
                      <div className="entry-row">
                        <div className="form-group">
                          <label className="sr-only">회원 이름 *</label>
                          <select
                            value={entry.member_name}
                            onChange={(e) =>
                              setFormEntries((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  ...next[index],
                                  member_name: e.target.value,
                                };
                                return next;
                              })
                            }
                            required
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
                          <label className="sr-only">게임 날짜</label>
                          <input
                            type="date"
                            value={entry.game_date}
                            onChange={(e) =>
                              setFormEntries((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  ...next[index],
                                  game_date: e.target.value,
                                };
                                return next;
                              })
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label className="sr-only">1게임</label>
                          <input
                            type="number"
                            min="0"
                            max="300"
                            placeholder="1G"
                            value={entry.score1}
                            onChange={(e) =>
                              setFormEntries((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  ...next[index],
                                  score1: e.target.value,
                                };
                                return next;
                              })
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label className="sr-only">2게임</label>
                          <input
                            type="number"
                            min="0"
                            max="300"
                            placeholder="2G"
                            value={entry.score2}
                            onChange={(e) =>
                              setFormEntries((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  ...next[index],
                                  score2: e.target.value,
                                };
                                return next;
                              })
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label className="sr-only">3게임</label>
                          <input
                            type="number"
                            min="0"
                            max="300"
                            placeholder="3G"
                            value={entry.score3}
                            onChange={(e) =>
                              setFormEntries((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  ...next[index],
                                  score3: e.target.value,
                                };
                                return next;
                              })
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label className="sr-only">비고</label>
                          <input
                            type="text"
                            placeholder="비고"
                            value={entry.note}
                            onChange={(e) =>
                              setFormEntries((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  ...next[index],
                                  note: e.target.value,
                                };
                                return next;
                              })
                            }
                          />
                        </div>
                        {formEntries.length > 1 && (
                          <div className="form-group entry-actions">
                            <button
                              type="button"
                              className="btn btn-danger minus-btn"
                              aria-label="행 삭제"
                              onClick={() =>
                                setFormEntries((prev) =>
                                  prev.filter((_, i) => i !== index)
                                )
                              }
                            >
                              -
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="plus-center">
                    <button
                      type="button"
                      className="btn btn-secondary plus-btn"
                      onClick={() =>
                        setFormEntries((prev) => [
                          ...prev,
                          {
                            member_name: '',
                            game_date: '',
                            score1: '',
                            score2: '',
                            score3: '',
                            note: '',
                          },
                        ])
                      }
                    >
                      +
                    </button>
                  </div>
                </>
              )}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingScore ? '수정' : '등록'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 스코어 목록 */}
      <div className="scores-section">
        <div className="section-card">
          <div className="scores-header">
            <div className="header-left">
              <h3 className="section-title">스코어 목록</h3>
              {selectedScores.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleDeleteSelected}
                >
                  선택 삭제 ({selectedScores.length})
                </button>
              )}
            </div>
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

          {showAllDates ? (
            // 전체 날짜 보기
            <div className="scores-table">
              <table>
                <thead>
                  <tr>
                    {isAdmin && (
                      <th style={{ width: '50px' }}>
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                          className="select-checkbox"
                        />
                      </th>
                    )}
                    <th>회원명</th>
                    <th>게임 날짜</th>
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
                          colSpan={isAdmin ? '9' : '8'}
                          className="date-header"
                        >
                          <div className="date-header-content">
                            <span className="date-text">{group.date}</span>
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
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedScores.includes(score.id)}
                                    onChange={() => handleSelectScore(score.id)}
                                    className="select-checkbox"
                                  />
                                </td>
                              )}
                              <td>
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
                                  type="date"
                                  value={inlineEditData.game_date}
                                  onChange={(e) =>
                                    setInlineEditData((prev) => ({
                                      ...prev,
                                      game_date: e.target.value,
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
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedScores.includes(score.id)}
                                    onChange={() => handleSelectScore(score.id)}
                                    className="select-checkbox"
                                  />
                                </td>
                              )}
                              <td>{score.member_name}</td>
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
                              <td>{score.note || '-'}</td>
                              {isAdmin && (
                                <td>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => startInlineEdit(score)}
                                  >
                                    수정
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDelete(score.id)}
                                  >
                                    삭제
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
                      <span className="date-display">
                        {getCurrentDateGroup().date}
                      </span>
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
                            <th style={{ width: '50px' }}>
                              <input
                                type="checkbox"
                                checked={selectAll}
                                onChange={handleSelectAll}
                                className="select-checkbox"
                              />
                            </th>
                          )}
                          <th>회원명</th>
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
                                  <td>
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
                                <td>
                                  <select
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
                                <td>
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
                                  <td>
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
                                <td>{score.member_name}</td>
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
                                  <td>
                                    <button
                                      className="btn btn-sm btn-secondary"
                                      onClick={() => startInlineEdit(score)}
                                    >
                                      수정
                                    </button>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      onClick={() => handleDelete(score.id)}
                                    >
                                      삭제
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
