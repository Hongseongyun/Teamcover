import React, { useState, useEffect, useRef } from 'react';
import { scoreAPI, sheetsAPI, memberAPI } from '../services/api';
import './Scores.css';

const Scores = () => {
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
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [ocrResults, setOcrResults] = useState([]);
  const [currentStep, setCurrentStep] = useState('upload'); // upload, selection, result
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

  // 페이징 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortOrder, setSortOrder] = useState('desc'); // desc: 최신순, asc: 오래된순

  // 날짜별 그룹화된 스코어 상태
  const [groupedScores, setGroupedScores] = useState([]);

  // 날짜별 좌우 페이징 상태
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const [showAllDates, setShowAllDates] = useState(false);

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

  const toggleDateView = () => {
    setShowAllDates(!showAllDates);
    if (!showAllDates) {
      setCurrentDateIndex(0); // 단일 날짜 보기로 전환 시 첫 번째 날짜로
    }
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

  // 이미지 업로드 처리
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
        setCurrentStep('upload');
      };
      reader.readAsDataURL(file);
    }
  };

  // 이미지 분석 시작
  const handleAnalyzeImage = async () => {
    if (!selectedImage) return;

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setOcrResults(data.results);
        setCurrentStep('result');
      }
    } catch (error) {
      console.error('AI 스코어 인식 실패:', error);
      alert('AI 스코어 인식에 실패했습니다.');
    }
  };

  // OCR 결과를 스코어로 저장
  const handleSaveOcrResults = async () => {
    try {
      for (const result of ocrResults) {
        await scoreAPI.addScore({
          member_name: result.member_name,
          game_date: result.game_date || new Date().toISOString().split('T')[0],
          score1: result.score1,
          score2: result.score2,
          score3: result.score3,
          note: 'AI로 자동 인식',
        });
      }

      alert(`${ocrResults.length}개의 스코어가 저장되었습니다.`);
      setShowPhotoForm(false);
      setOcrResults([]);
      setSelectedImage(null);
      setImagePreview(null);
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
      </div>

      {/* 개인별 검색 섹션 */}
      <div className="member-search-section">
        <div className="section-card">
          <h3 className="section-title">개인별 스코어 검색</h3>

          {showMemberSearch ? (
            <div className="search-form">
              <div className="search-row">
                <div className="form-group">
                  <select
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                  >
                    <option value="">회원을 선택하세요</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.name}>
                        {member.name}
                      </option>
                    ))}
                  </select>
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

      {/* 구글시트 가져오기 폼 */}
      {showImportForm && (
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

      {/* 사진으로 스코어 등록 폼 */}
      {showPhotoForm && (
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
                    onChange={handleImageUpload}
                    className="file-input"
                  />
                  <div className="form-text">
                    JPG, PNG, GIF 파일을 선택해주세요. AI가 자동으로 스코어를
                    인식합니다.
                  </div>
                </div>

                {imagePreview && (
                  <div className="image-preview">
                    <img src={imagePreview} alt="미리보기" />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAnalyzeImage}
                    >
                      AI 스코어 인식
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentStep === 'result' && ocrResults.length > 0 && (
              <div className="result-step">
                <h4>AI 인식 결과</h4>
                <div className="ocr-summary">
                  <p>인식된 회원 수: {ocrResults.length}명</p>
                </div>

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
                      </tr>
                    </thead>
                    <tbody>
                      {ocrResults.map((result, index) => (
                        <tr key={index}>
                          <td>{result.member_name}</td>
                          <td>{result.score1}</td>
                          <td>{result.score2}</td>
                          <td>{result.score3}</td>
                          <td>
                            {result.score1 + result.score2 + result.score3}
                          </td>
                          <td>
                            {(
                              (result.score1 + result.score2 + result.score3) /
                              3
                            ).toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

      {/* 스코어 추가/수정 폼 */}
      {showAddForm && (
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
            <h3 className="section-title">스코어 목록</h3>
            <div className="view-toggle">
              <button
                className={`btn ${
                  showAllDates ? 'btn-primary' : 'btn-secondary'
                }`}
                onClick={toggleDateView}
              >
                {showAllDates ? '단일 날짜 보기' : '전체 보기'}
              </button>
            </div>
          </div>

          {showAllDates ? (
            // 전체 날짜 보기
            <div className="scores-table">
              <table>
                <thead>
                  <tr>
                    <th>회원명</th>
                    <th>게임 날짜</th>
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
                  {getPaginatedGroups().map((group) => (
                    <React.Fragment key={group.date}>
                      {/* 날짜 헤더 행 */}
                      <tr className="date-header-row">
                        <td colSpan="9" className="date-header">
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
                        {getCurrentDateGroup().scores.map((score) => (
                          <tr key={score.id} className="score-row">
                            {inlineEditingId === score.id ? (
                              <>
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
