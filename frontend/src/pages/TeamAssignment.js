import React, { useState, useEffect, useRef } from 'react';
import { teamAPI, memberAPI, scoreAPI } from '../services/api';
import './TeamAssignment.css';

const TeamAssignment = () => {
  const [players, setPlayers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);

  const [teamConfig, setTeamConfig] = useState({
    team_count: 2,
    team_size: 4,
  });

  // 계산된 에버 정보 상태
  const [calculatedAverageInfo, setCalculatedAverageInfo] = useState({
    period: '',
    gameCount: 0,
    isCalculated: false,
  });

  // 선택된 회원들 상태
  const [selectedMembers, setSelectedMembers] = useState([]);

  // 검색 관련 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [highlightedMemberId, setHighlightedMemberId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState('');
  const [isBalancing, setIsBalancing] = useState(false);
  const [balancingResult, setBalancingResult] = useState('');
  const [duplicateAlert, setDuplicateAlert] = useState('');
  const [searchDuplicateAlert, setSearchDuplicateAlert] = useState('');
  const [bulkDuplicateAlert, setBulkDuplicateAlert] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [filteredAutocomplete, setFilteredAutocomplete] = useState([]);

  // 선수 목록 섹션 ref
  const playersSectionRef = useRef(null);

  // 팀 구성 옵션
  const [teamOptions, setTeamOptions] = useState({
    balanceByGender: true,
    balanceByLevel: true,
    allowUnevenTeams: false,
  });

  // 선수 선택 및 스위칭 시스템 상태
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isPlayerSelected, setIsPlayerSelected] = useState(false);
  const [hoveredTeam, setHoveredTeam] = useState(null);

  // 통계 상태
  const [stats, setStats] = useState({
    totalPlayers: 0,
    averageScore: 0,
    genderDistribution: { male: 0, female: 0 },
    levelDistribution: {},
  });

  useEffect(() => {
    loadMembers();
    loadPlayers();
  }, []);

  const loadMembers = async () => {
    try {
      const response = await memberAPI.getMembers();
      if (response.data.success) {
        setMembers(response.data.members);
      }
    } catch (error) {
      // 에러 처리
    }
  };

  // 스코어 기록에서 평균 에버 계산 (표시용 미리보기)
  const calculateAverageFromScores = async (memberName) => {
    try {
      const response = await scoreAPI.getScores();
      const data = response.data;

      if (data.success) {
        const memberScores = data.scores.filter(
          (score) => score.member_name === memberName
        );

        if (memberScores.length > 0) {
          // 날짜별로 정렬
          const sortedScores = memberScores.sort(
            (a, b) => new Date(a.game_date) - new Date(b.game_date)
          );

          // 요구사항: 2025년 7월 이후 > 없으면 2025년 1~6월 > 없으면 2024년
          const targetYear = 2025;
          const getDate = (s) => new Date(s.game_date || s.created_at);

          // 1) 2025년 7월 이후
          let targetScores = sortedScores.filter((score) => {
            const d = getDate(score);
            if (isNaN(d)) return false;
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            return y === targetYear && m >= 7;
          });

          // 2) 없으면 2025년 1~6월
          if (targetScores.length === 0) {
            targetScores = sortedScores.filter((score) => {
              const d = getDate(score);
              if (isNaN(d)) return false;
              const y = d.getFullYear();
              const m = d.getMonth() + 1;
              return y === targetYear && m >= 1 && m <= 6;
            });
          }

          // 3) 없으면 2024년 전체
          if (targetScores.length === 0) {
            targetScores = sortedScores.filter((score) => {
              const d = getDate(score);
              if (isNaN(d)) return false;
              const y = d.getFullYear();
              return y === 2024;
            });
          }

          // 평균 에버 계산
          if (targetScores.length > 0) {
            const allScores = targetScores
              .flatMap((score) => [score.score1, score.score2, score.score3])
              .filter((score) => score > 0);

            if (allScores.length > 0) {
              const averageScore = Math.round(
                allScores.reduce((sum, score) => sum + score, 0) /
                  allScores.length
              );

              // 계산된 기간 정보 저장 (2025 기준)
              const periodInfo = getPeriodInfo(targetScores);
              setCalculatedAverageInfo({
                period: periodInfo,
                gameCount: targetScores.length,
                isCalculated: true,
                memberName: memberName,
              });

              // 평균 에버 계산
            }
          }
        }
      }
    } catch (error) {
      // 에러 처리
    }
  };

  // 기간 정보 반환 함수
  const getPeriodInfo = (scores) => {
    if (!scores || scores.length === 0) return '';
    const targetYear = 2025;
    const getDate = (s) => new Date(s.game_date || s.created_at);
    const months = scores
      .map((s) => getDate(s))
      .filter((d) => !isNaN(d))
      .map((d) => ({ y: d.getFullYear(), m: d.getMonth() + 1 }));

    const hasAfterJuly = months.some((d) => d.y === targetYear && d.m >= 7);
    if (hasAfterJuly) return `${targetYear}년 7월 이후`;

    const hasJanToJune = months.some(
      (d) => d.y === targetYear && d.m >= 1 && d.m <= 6
    );
    if (hasJanToJune) return `${targetYear}년 1월~6월`;

    const hasYear2024 = months.some((d) => d.y === 2024);
    if (hasYear2024) return `2024년`;

    return '';
  };

  // 선수 목록으로 스크롤하는 함수
  const scrollToPlayersSection = () => {
    if (playersSectionRef.current) {
      playersSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  // 회원 선택/해제 함수
  const toggleMemberSelection = (member) => {
    setSelectedMembers((prev) => {
      const isSelected = prev.some((selected) => selected.id === member.id);
      if (isSelected) {
        // 이미 선택된 경우 해제
        return prev.filter((selected) => selected.id !== member.id);
      } else {
        // 선택되지 않은 경우 추가
        return [...prev, member];
      }
    });
  };

  // 선택된 회원 초기화
  const clearSelectedMembers = () => {
    setSelectedMembers([]);
  };

  // 회원 검색 함수 (중복 쌓기)
  const handleSearchAndAdd = () => {
    if (!searchQuery.trim()) return;

    const query = searchQuery.toLowerCase();
    const results = members.filter((member) =>
      member.name.toLowerCase().includes(query)
    );

    // 기존 검색 결과에 새로운 결과 추가 (중복 제거)
    setSearchResults((prevResults) => {
      const newResults = [...prevResults];

      results.forEach((newMember) => {
        const isDuplicate = newResults.some(
          (existingMember) => existingMember.id === newMember.id
        );

        if (!isDuplicate) {
          newResults.push(newMember);
        }
      });

      return newResults;
    });

    // 검색 결과가 있으면 첫 번째 회원의 에버 정보 미리 계산
    if (results.length > 0) {
      calculateAverageFromScores(results[0].name);

      // 검색된 회원을 회원 목록에서 찾아서 하이라이트
      const foundMember = members.find((member) =>
        member.name.toLowerCase().includes(query)
      );

      if (foundMember) {
        setHighlightedMemberId(foundMember.id);

        // 3초 후 하이라이트 제거
        setTimeout(() => {
          setHighlightedMemberId(null);
        }, 3000);
      }
    }

    // 검색어 초기화
    setSearchQuery('');
  };

  // 단일 회원 추가 함수
  const handleAddSingleMember = async (member) => {
    try {
      // 중복 검사
      if (isDuplicatePlayer(member.name)) {
        // 중복 발견 시 검색 결과 아래에 알림 표시
        const duplicateMessage = `${member.name}님은 이미 선수 목록에 존재합니다.`;
        setSearchDuplicateAlert(duplicateMessage);

        // 5초 후 알림 메시지 제거
        setTimeout(() => {
          setSearchDuplicateAlert('');
        }, 5000);
        return;
      }

      setIsLoading(true);
      setLoadingType('개별 추가');

      // 저장된 평균 에버 가져오기
      const average = await getMemberAverage(member.name);

      await teamAPI.addPlayer({
        name: member.name,
        average: average,
        gender: member.gender || '',
      });

      // 해당 회원을 검색 결과에서 제거
      setSearchResults((prevResults) =>
        prevResults.filter((result) => result.id !== member.id)
      );

      // 선수 목록 새로고침
      await loadPlayers();

      // 검색 입력란 초기화
      setSearchQuery('');

      // 추가 후 선수 목록으로 스크롤
      setTimeout(() => {
        scrollToPlayersSection();
      }, 100);
    } catch (error) {
      // 에러 처리
    } finally {
      setIsLoading(false);
      setLoadingType('');
    }
  };

  // 중복 검사 함수
  const isDuplicatePlayer = (memberName) => {
    return players.some((player) => {
      if (Array.isArray(player)) {
        return player[0] === memberName;
      } else if (typeof player === 'object' && player !== null) {
        return player.name === memberName;
      }
      return false;
    });
  };

  // 회원이 선수 목록에 있는지 확인하는 함수
  const isMemberInPlayerList = (memberName) => {
    return players.some((player) => {
      if (Array.isArray(player)) {
        return player[0] === memberName;
      } else if (typeof player === 'object' && player !== null) {
        return player.name === memberName;
      }
      return false;
    });
  };

  // 자동완성 필터링 함수
  const filterAutocomplete = (query) => {
    if (!query.trim()) {
      setFilteredAutocomplete([]);
      setShowAutocomplete(false);
      return;
    }

    const filtered = members
      .filter((member) =>
        member.name.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 5); // 최대 5개까지만 표시

    setFilteredAutocomplete(filtered);
    setShowAutocomplete(filtered.length > 0);
  };

  // 자동완성에서 검색 결과로 이동하는 함수
  const handleAutocompleteToSearch = (member) => {
    // 중복 검사
    if (isDuplicatePlayer(member.name)) {
      const duplicateMessage = `${member.name}님은 이미 선수 목록에 존재합니다.`;
      setSearchDuplicateAlert(duplicateMessage);

      // 5초 후 알림 메시지 제거
      setTimeout(() => {
        setSearchDuplicateAlert('');
      }, 5000);
      return;
    }

    // 이미 검색 결과에 있는지 확인
    const isAlreadyInSearch = searchResults.some(
      (result) => result.id === member.id
    );
    if (isAlreadyInSearch) {
      return; // 이미 있으면 추가하지 않음
    }

    // 검색 결과에 추가
    setSearchResults((prev) => [...prev, member]);

    // 검색어 설정
    setSearchQuery(member.name);

    // 자동완성 목록 숨김
    setShowAutocomplete(false);

    // 검색 결과 섹션으로 스크롤
    setTimeout(() => {
      const searchSection = document.querySelector('.search-section');
      if (searchSection) {
        searchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // 검색 결과 전체 추가 함수
  const handleAddAllSearchResults = async () => {
    if (searchResults.length === 0) return;

    try {
      setIsLoading(true);
      setLoadingType('전체 추가');

      // 중복 검사
      const duplicateMembers = searchResults.filter((member) =>
        isDuplicatePlayer(member.name)
      );

      if (duplicateMembers.length > 0) {
        // 로딩 상태 즉시 해제하여 알림이 보이도록 함
        setIsLoading(false);
        setLoadingType('');

        const duplicateNames = duplicateMembers.map((m) => m.name).join(', ');
        const duplicateMessage = `다음 회원들은 이미 선수 목록에 존재합니다:\n${duplicateNames}\n\n중복된 회원은 추가되지 않습니다.`;
        setSearchDuplicateAlert(duplicateMessage);

        // 5초 후 알림 메시지 제거
        setTimeout(() => {
          setSearchDuplicateAlert('');
        }, 5000);

        // 중복되지 않은 회원만 필터링
        const nonDuplicateMembers = searchResults.filter(
          (member) => !isDuplicatePlayer(member.name)
        );

        if (nonDuplicateMembers.length === 0) {
          return; // 이미 로딩 상태 해제됨
        }

        // 중복되지 않은 회원들만 추가 (다시 로딩 상태 설정)
        setIsLoading(true);
        setLoadingType('중복되지 않은 회원 추가');

        for (const member of nonDuplicateMembers) {
          const average = await getMemberAverage(member.name);

          await teamAPI.addPlayer({
            name: member.name,
            average: average,
            gender: member.gender || '',
          });
        }
      } else {
        // 모든 검색 결과를 순차적으로 추가
        for (const member of searchResults) {
          const average = await getMemberAverage(member.name);

          const playerData = {
            name: member.name,
            average: average,
            gender: member.gender || '',
          };

          await teamAPI.addPlayer(playerData);
        }
      }

      // 검색 결과 초기화
      setSearchResults([]);

      // 선수 목록 새로고침
      await loadPlayers();

      // 검색 입력란 초기화
      setSearchQuery('');

      // 검색 결과에서 선수 목록에 추가된 회원들 제거
      setSearchResults((prevResults) =>
        prevResults.filter((member) => !isMemberInPlayerList(member.name))
      );

      // 추가 후 선수 목록으로 스크롤
      setTimeout(() => {
        scrollToPlayersSection();
      }, 100);
    } catch (error) {
      // 에러 처리
    } finally {
      setIsLoading(false);
      setLoadingType('');
    }
  };

  const loadPlayers = async () => {
    try {
      const response = await teamAPI.getPlayers();
      if (response.data.success) {
        // 선수 데이터 구조 변환 (필요한 경우)
        const formattedPlayers = response.data.players.map((player) => {
          if (Array.isArray(player)) {
            // 배열 형태인 경우 객체로 변환
            return {
              name: player[0] || '이름 없음',
              average: parseInt(player[1]) || 0,
              gender: player[2] || '미지정',
            };
          } else if (typeof player === 'object' && player !== null) {
            // 객체 형태인 경우 그대로 사용
            return {
              name: player.name || player.player_name || '이름 없음',
              average: parseInt(player.average || player.average_score || 0),
              gender: player.gender || '미지정',
            };
          } else {
            // 기타 형태인 경우 기본값 설정
            return {
              name: '이름 없음',
              average: 0,
              gender: '미지정',
            };
          }
        });

        setPlayers(formattedPlayers);
        calculateStats(formattedPlayers);
      }
    } catch (error) {
      // 에러 처리
    }
  };

  const calculateStats = (playerList) => {
    if (!playerList || playerList.length === 0) return;

    const totalPlayers = playerList.length;
    const totalScore = playerList.reduce(
      (sum, player) => sum + (player.average || 0),
      0
    );
    const averageScore =
      totalPlayers > 0 ? Math.round(totalScore / totalPlayers) : 0;

    const genderDistribution = { male: 0, female: 0 };
    const levelDistribution = {};

    playerList.forEach((player) => {
      const gender = player.gender || '미지정';
      if (gender === '남') genderDistribution.male++;
      else if (gender === '여') genderDistribution.female++;

      const average = player.average || 0;
      let level = '초급';
      if (average >= 180) level = '프로';
      else if (average >= 160) level = '고급';
      else if (average >= 140) level = '중급';
      else if (average >= 120) level = '초급';

      levelDistribution[level] = (levelDistribution[level] || 0) + 1;
    });

    setStats({
      totalPlayers,
      averageScore,
      genderDistribution,
      levelDistribution,
    });
  };

  const handleBulkAdd = async () => {
    if (selectedMembers.length === 0) {
      alert('선택된 회원이 없습니다.');
      return;
    }

    try {
      setIsLoading(true);
      setLoadingType('선택된 회원 추가');

      // 중복 검사
      const duplicateMembers = selectedMembers.filter((member) =>
        isDuplicatePlayer(member.name)
      );

      if (duplicateMembers.length > 0) {
        // 로딩 상태 즉시 해제하여 알림이 보이도록 함
        setIsLoading(false);
        setLoadingType('');

        const duplicateNames = duplicateMembers.map((m) => m.name).join(', ');
        const duplicateMessage = `다음 회원들은 이미 선수 목록에 존재합니다:\n${duplicateNames}\n\n중복된 회원은 추가되지 않습니다.`;
        setBulkDuplicateAlert(duplicateMessage);

        // 5초 후 알림 메시지 제거
        setTimeout(() => {
          setBulkDuplicateAlert('');
        }, 5000);

        // 중복되지 않은 회원만 필터링
        const nonDuplicateMembers = selectedMembers.filter(
          (member) => !isDuplicatePlayer(member.name)
        );

        if (nonDuplicateMembers.length === 0) {
          return; // 이미 로딩 상태 해제됨
        }

        // 중복되지 않은 회원들만 추가 (다시 로딩 상태 설정)
        setIsLoading(true);
        setLoadingType('중복되지 않은 회원 추가');

        for (const member of nonDuplicateMembers) {
          const average = await getMemberAverage(member.name);

          await teamAPI.addPlayer({
            name: member.name,
            average: average,
            gender: member.gender || '',
          });
        }
      } else {
        // 모든 선택된 회원 추가
        for (const member of selectedMembers) {
          const average = await getMemberAverage(member.name);

          const playerData = {
            name: member.name,
            average: average,
            gender: member.gender || '',
          };

          await teamAPI.addPlayer(playerData);
        }
      }

      // 선택된 회원 초기화
      setSelectedMembers([]);

      // 선수 목록 새로고침
      await loadPlayers();

      // 검색 입력란 초기화
      setSearchQuery('');

      // 선택된 회원들이 선수 목록에 추가되었으므로 선택 상태 해제
      setSelectedMembers((prevSelected) =>
        prevSelected.filter((member) => !isMemberInPlayerList(member.name))
      );

      // 대량 추가 후 잠시 대기 후 스크롤 (데이터 로드 완료 후)
      setTimeout(() => {
        scrollToPlayersSection();
      }, 100);
    } catch (error) {
      // 에러 처리
    } finally {
      setIsLoading(false);
      setLoadingType('');
    }
  };

  // 회원의 저장된 평균 에버 가져오기 (선수 추가용)
  const getMemberAverage = async (memberName) => {
    try {
      // 회원 목록에서 해당 회원 찾기
      const member = members.find((m) => m.name === memberName);

      if (
        member &&
        member.average_score !== null &&
        member.average_score !== undefined
      ) {
        // 저장된 평균 점수가 있으면 반환
        return Math.round(member.average_score);
      }

      // 저장된 평균 점수가 없으면 API로 조회
      if (member) {
        const response = await memberAPI.getMemberAverage(member.id);
        if (response.data.success) {
          return Math.round(response.data.average);
        }
      }
    } catch (error) {
      console.error('평균 점수 조회 오류:', error);
    }

    // 기본값 반환 (스코어 기록이 없는 경우)
    return Math.floor(Math.random() * 100) + 100;
  };

  const handleDeletePlayer = async (name) => {
    try {
      await teamAPI.deletePlayer({ name });
      loadPlayers();
    } catch (error) {
      // 에러 처리
    }
  };

  const handleClearPlayers = async () => {
    if (window.confirm('모든 선수를 삭제하시겠습니까?')) {
      try {
        await teamAPI.clearPlayers();
        loadPlayers();
        setTeams([]);
      } catch (error) {
        // 에러 처리
      }
    }
  };

  const handleMakeTeams = async () => {
    if (players.length === 0) {
      alert('선수를 먼저 추가해주세요.');
      return;
    }

    try {
      setLoading(true);
      setIsBalancing(true);

      // 팀 구성 및 밸런싱 시작

      // 1단계: 여성 인원 균등 분배를 위한 선수 정렬

      // 선수 데이터 유효성 검사
      if (!players || players.length === 0) {
        throw new Error('선수 데이터가 없습니다.');
      }

      // 필수 필드가 없는 선수 필터링
      const validPlayers = players.filter(
        (p) => p && p.name && p.gender && p.average !== undefined
      );

      if (validPlayers.length === 0) {
        throw new Error('유효한 선수 데이터가 없습니다.');
      }

      // 유효한 선수 데이터 확인

      const sortedPlayers = [...validPlayers].sort((a, b) => {
        // 여성 선수를 우선으로 정렬
        if (a.gender === '여' && b.gender !== '여') return -1;
        if (a.gender !== '여' && b.gender === '여') return 1;
        // 성별이 같으면 평균 점수로 정렬 (내림차순)
        return b.average - a.average;
      });

      // 선수 정렬 완료 (여성 우선)
      sortedPlayers.map((p) => `${p.name}(${p.gender}, ${p.average})`);

      // 2단계: 여성 인원 균등 분배로 팀 구성
      const balancedTeams = createBalancedTeams(sortedPlayers);

      // 3단계: 점수 밸런싱 적용
      const finalTeams = await balanceTeamsByScore(balancedTeams);

      // 4단계: 팀 번호 순으로 정렬하여 UI에 설정
      const sortedTeams = finalTeams.sort(
        (a, b) => a.team_number - b.team_number
      );
      setTeams(sortedTeams);

      // 팀 구성 및 밸런싱 완료

      // 5단계: 결과 메시지 설정
      const maxDiff =
        Math.max(...sortedTeams.map((t) => t.total_average)) -
        Math.min(...sortedTeams.map((t) => t.total_average));

      if (maxDiff <= 10) {
        setBalancingResult(
          `✅ 팀 구성 완료! 여성 인원 균등 분배 + 점수 밸런싱 완료 (최대 차이: ${maxDiff}점)`
        );
      } else {
        setBalancingResult(
          `⚠️ 팀 구성 완료. 여성 인원 균등 분배 완료, 점수 차이: ${maxDiff}점`
        );
      }

      // 5초 후 메시지 자동 제거
      setTimeout(() => setBalancingResult(''), 5000);
    } catch (error) {
      setBalancingResult('❌ 팀 구성 실패');
      setTimeout(() => setBalancingResult(''), 3000);
    } finally {
      setLoading(false);
      setIsBalancing(false);
    }
  };

  // 여성 인원 균등 분배로 팀 구성하는 함수
  const createBalancedTeams = (sortedPlayers) => {
    if (!sortedPlayers || sortedPlayers.length === 0) {
      throw new Error('정렬된 선수 데이터가 없습니다.');
    }

    const { team_count, team_size } = teamConfig;
    const teams = [];

    // 팀 초기화
    for (let i = 1; i <= team_count; i++) {
      teams.push({
        team_number: i,
        players: [],
        total_average: 0,
        average_per_player: 0,
      });
    }

    // [규칙 1] 상위 에버 선수들은 서로 다른 팀으로 시드 배치
    const topSeedCount = Math.min(team_count, sortedPlayers.length);
    const topByAverage = [...sortedPlayers].sort(
      (a, b) => b.average - a.average
    );
    for (let i = 0; i < topSeedCount; i++) {
      const seed = topByAverage[i];
      const targetTeamIndex = i % team_count;
      teams[targetTeamIndex].players.push(seed);
      teams[targetTeamIndex].total_average += seed.average;
    }
    // 시드로 배정된 선수 제거 후 나머지 분배 로직 수행
    const seededIds = new Set(
      topByAverage
        .slice(0, topSeedCount)
        .map((p) => `${p.name}-${p.average}-${p.gender}`)
    );
    const remainingPlayers = sortedPlayers.filter(
      (p) => !seededIds.has(`${p.name}-${p.average}-${p.gender}`)
    );

    // 여성 선수들을 먼저 균등 분배 (시드 제외 후 분배)
    const femalePlayers = remainingPlayers.filter((p) => p.gender === '여');
    const femalePerTeam = Math.floor(femalePlayers.length / team_count);
    const remainingFemales = femalePlayers.length % team_count;

    // 여성 선수 분배

    let femaleIndex = 0;
    for (let teamIndex = 0; teamIndex < team_count; teamIndex++) {
      const currentTeam = teams[teamIndex];

      // 기본 여성 인원 할당
      for (let i = 0; i < femalePerTeam; i++) {
        if (femaleIndex < femalePlayers.length) {
          currentTeam.players.push(femalePlayers[femaleIndex]);
          currentTeam.total_average += femalePlayers[femaleIndex].average;
          femaleIndex++;
        }
      }

      // 남은 여성 인원을 앞쪽 팀부터 할당
      if (remainingFemales > 0 && teamIndex < remainingFemales) {
        if (femaleIndex < femalePlayers.length) {
          currentTeam.players.push(femalePlayers[femaleIndex]);
          currentTeam.total_average += femalePlayers[femaleIndex].average;
          femaleIndex++;
        }
      }
    }

    // 남성 선수들을 남은 자리에 분배 (시드 제외 후 분배)
    const malePlayers = remainingPlayers.filter((p) => p.gender === '남');
    let maleIndex = 0;

    for (let teamIndex = 0; teamIndex < team_count; teamIndex++) {
      const currentTeam = teams[teamIndex];

      // 팀이 가득 찰 때까지 남성 선수 추가
      while (
        currentTeam.players.length < team_size &&
        maleIndex < malePlayers.length
      ) {
        currentTeam.players.push(malePlayers[maleIndex]);
        currentTeam.total_average += malePlayers[maleIndex].average;
        maleIndex++;
      }
    }

    // 각 팀의 평균 계산
    teams.forEach((team) => {
      team.average_per_player =
        team.players.length > 0 ? team.total_average / team.players.length : 0;
    });

    // 여성 인원 균등 분배 완료
    teams.map((t) => ({
      teamNumber: t.team_number,
      femaleCount: t.players.filter((p) => p.gender === '여').length,
      maleCount: t.players.filter((p) => p.gender === '남').length,
      totalAverage: t.total_average,
    }));

    return teams;
  };

  // 점수 밸런싱을 위한 함수 (근소한 차이의 남자 회원 스위칭)
  const balanceTeamsByScore = async (teamsToBalance) => {
    if (teamsToBalance.length < 2) return teamsToBalance;

    // 점수 밸런싱 시작 (근소한 차이의 남자 회원 스위칭)

    const teams = [...teamsToBalance];
    let bestTeams = [...teams]; // 최적 결과 저장
    let bestMaxDiff = Number.MAX_SAFE_INTEGER;
    let bestAttempt = 0;

    // 상위 시드 선수들 식별 (각 팀의 첫 번째 선수들)
    const seedPlayers = new Set();
    teams.forEach((team) => {
      if (team.players.length > 0) {
        const firstPlayer = team.players[0];
        seedPlayers.add(
          `${firstPlayer.name}-${firstPlayer.average}-${firstPlayer.gender}`
        );
      }
    });
    // 시드 선수들 (스위칭 제외)

    // [규칙 2] 최대 점수 차이가 5점 이하가 될 때까지 반복 (안전 가드 포함)
    let attempt = 0;
    const hardLimit = 3000; // 무한 반복 방지를 위한 하드 가드
    while (attempt < hardLimit) {
      attempt++;

      // 현재 팀 상태 분석
      const teamStats = teams.map((team) => ({
        teamNumber: team.team_number,
        totalAverage: team.total_average,
        averagePerPlayer: team.average_per_player,
        playerCount: team.players.length,
        players: team.players,
      }));

      // 팀별 총점 정렬 (내림차순)
      teamStats.sort((a, b) => b.totalAverage - a.totalAverage);

      // 최대 점수 차이 계산
      const currentMaxDiff =
        teamStats[0].totalAverage -
        teamStats[teamStats.length - 1].totalAverage;

      // 현재 결과가 최적이면 저장
      if (currentMaxDiff < bestMaxDiff) {
        bestMaxDiff = currentMaxDiff;
        bestTeams = JSON.parse(JSON.stringify(teams)); // 깊은 복사
        bestAttempt = attempt;
      }

      // 목표: 5점 이하 달성 시 종료
      if (currentMaxDiff <= 5) {
        break;
      }

      // 최고점 팀과 최저점 팀에서 근소한 차이의 남자 회원 스위칭 찾기
      const highTeam = teamStats[0];
      const lowTeam = teamStats[teamStats.length - 1];

      let bestSwap = null;
      let bestScoreImprovement = 0;

      // 남자 회원만 필터링 (여성 인원 균등성 유지) + 시드 선수 제외
      const highTeamMales = highTeam.players.filter(
        (p) =>
          p.gender === '남' &&
          !seedPlayers.has(`${p.name}-${p.average}-${p.gender}`)
      );
      const lowTeamMales = lowTeam.players.filter(
        (p) =>
          p.gender === '남' &&
          !seedPlayers.has(`${p.name}-${p.average}-${p.gender}`)
      );

      // 모든 가능한 남자 회원 조합 시도
      for (const highPlayer of highTeamMales) {
        for (const lowPlayer of lowTeamMales) {
          // 근소한 차이 조건: 큰 팀의 회원이 작은 팀의 회원보다 에버가 근소하게 낮음
          const scoreDiff = highPlayer.average - lowPlayer.average;
          if (scoreDiff >= 0) continue; // 큰 팀의 회원이 작은 팀의 회원보다 에버가 높거나 같으면 건너뛰기

          // 여성 인원 균등성 체크
          const highTeamFemaleCount = highTeam.players.filter(
            (p) => p.gender === '여'
          ).length;
          const lowTeamFemaleCount = lowTeam.players.filter(
            (p) => p.gender === '여'
          ).length;

          // 스위칭 후 여성 인원 균등성 유지 여부 확인
          const highTeamNewFemaleCount = highTeamFemaleCount;
          const lowTeamNewFemaleCount = lowTeamFemaleCount;

          // 여성 인원 균등성 유지 조건 체크
          const totalFemales = teams.reduce(
            (sum, t) => sum + t.players.filter((p) => p.gender === '여').length,
            0
          );
          const maxFemaleDiff = 1; // 여성 인원 차이는 최대 1명까지 허용

          if (
            Math.abs(highTeamNewFemaleCount - lowTeamNewFemaleCount) >
            maxFemaleDiff
          ) {
            continue; // 여성 인원 균등성 유지 불가능한 스위칭은 건너뛰기
          }

          // 스위칭 후 점수 차이 계산
          const highTeamNewTotal =
            highTeam.totalAverage - highPlayer.average + lowPlayer.average;
          const lowTeamNewTotal =
            lowTeam.totalAverage - lowPlayer.average + highPlayer.average;
          const newDiff = Math.abs(highTeamNewTotal - lowTeamNewTotal);

          // 현재 점수 차이와 비교
          const improvement = currentMaxDiff - newDiff;

          if (improvement > bestScoreImprovement) {
            bestScoreImprovement = improvement;
            bestSwap = {
              player1: { ...highPlayer, sourceTeam: highTeam.teamNumber },
              player2: { ...lowPlayer, sourceTeam: lowTeam.teamNumber },
            };
          }
        }
      }

      if (bestSwap && bestScoreImprovement > 0) {
        // 스위칭 실행 (팀 데이터 직접 업데이트)
        const updatedTeams = teams.map((team) => {
          if (team.team_number === bestSwap.player1.sourceTeam) {
            // 팀 1에서 player1 제거하고 player2 추가
            const filteredPlayers = team.players.filter(
              (p) =>
                !(
                  p.name === bestSwap.player1.name &&
                  p.average === bestSwap.player1.average
                )
            );
            const newPlayers = [...filteredPlayers, bestSwap.player2];
            const newTotalAverage = newPlayers.reduce(
              (sum, p) => sum + p.average,
              0
            );
            const newAveragePerPlayer =
              newPlayers.length > 0 ? newTotalAverage / newPlayers.length : 0;

            return {
              ...team,
              players: newPlayers,
              total_average: newTotalAverage,
              average_per_player: newAveragePerPlayer,
            };
          } else if (team.team_number === bestSwap.player2.sourceTeam) {
            // 팀 2에서 player2 제거하고 player1 추가
            const filteredPlayers = team.players.filter(
              (p) =>
                !(
                  p.name === bestSwap.player2.name &&
                  p.average === bestSwap.player2.average
                )
            );
            const newPlayers = [...filteredPlayers, bestSwap.player1];
            const newTotalAverage = newPlayers.reduce(
              (sum, p) => sum + p.average,
              0
            );
            const newAveragePerPlayer =
              newPlayers.length > 0 ? newTotalAverage / newPlayers.length : 0;

            return {
              ...team,
              players: newPlayers,
              total_average: newTotalAverage,
              average_per_player: newAveragePerPlayer,
            };
          }
          return team;
        });

        // 팀 데이터 업데이트
        Object.assign(teams, updatedTeams);

        // 잠시 대기 (UI 업데이트를 위해)
        await new Promise((resolve) => setTimeout(resolve, 20));
      } else {
        // 개선 스왑이 없으면 랜덤 섞기로 새로운 기회 생성
        await shuffleTeamsRandomly(teams);
      }
    }

    // 최적 결과로 복원
    Object.assign(teams, bestTeams);

    // 점수 밸런싱 완료
    return teams;
  };

  // 팀을 랜덤하게 섞는 함수 (새로운 기회 생성)
  const shuffleTeamsRandomly = async (teams) => {
    // 여성 인원 균등성 유지하면서 남성 선수들만 랜덤하게 섞기
    const allTeams = [...teams];

    // 각 팀의 여성 선수는 그대로 두고, 남성 선수들만 수집
    const allMalePlayers = [];
    allTeams.forEach((team) => {
      const malePlayers = team.players.filter((p) => p.gender === '남');
      allMalePlayers.push(...malePlayers);
    });

    // 남성 선수들을 랜덤하게 섞기
    for (let i = allMalePlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allMalePlayers[i], allMalePlayers[j]] = [
        allMalePlayers[j],
        allMalePlayers[i],
      ];
    }

    // 섞인 남성 선수들을 다시 팀에 분배
    let maleIndex = 0;
    allTeams.forEach((team) => {
      const femalePlayers = team.players.filter((p) => p.gender === '여');
      const maleCount = team.players.length - femalePlayers.length;

      // 새로운 남성 선수들로 교체
      const newMalePlayers = allMalePlayers.slice(
        maleIndex,
        maleIndex + maleCount
      );
      maleIndex += maleCount;

      // 팀 재구성
      team.players = [...femalePlayers, ...newMalePlayers];
      team.total_average = team.players.reduce((sum, p) => sum + p.average, 0);
      team.average_per_player =
        team.players.length > 0 ? team.total_average / team.players.length : 0;
    });

    // 팀 랜덤 섞기 완료
  };

  // 자동 팀 밸런싱 함수
  const autoBalanceTeams = async (teamsToBalance = teams) => {
    if (teamsToBalance.length < 2) return;

    setIsBalancing(true);

    let maxDiff = 0;
    let attempts = 0;
    const maxAttempts = 50; // 무한 루프 방지

    do {
      // 현재 팀 밸런싱 상태 분석
      const teamStats = teamsToBalance.map((team) => ({
        teamNumber: team.team_number,
        totalAverage: team.total_average,
        averagePerPlayer: team.average_per_player,
        playerCount: team.players.length,
        players: team.players,
      }));

      // 팀별 총점 정렬 (내림차순)
      teamStats.sort((a, b) => b.totalAverage - a.totalAverage);

      // 최대 점수 차이 계산
      maxDiff =
        teamStats[0].totalAverage -
        teamStats[teamStats.length - 1].totalAverage;

      // 밸런싱 시도

      if (maxDiff <= 10) {
        break;
      }

      // 최고점 팀과 최저점 팀에서 스위칭 가능한 선수 조합 찾기
      const highTeam = teamStats[0];
      const lowTeam = teamStats[teamStats.length - 1];

      let bestSwap = null;
      let bestImprovement = 0;

      // 모든 가능한 선수 조합 시도
      const highTeamNonSeeds = highTeam.players;
      const lowTeamNonSeeds = lowTeam.players;

      for (const highPlayer of highTeamNonSeeds) {
        for (const lowPlayer of lowTeamNonSeeds) {
          // 스위칭 후 점수 차이 계산
          const highTeamNewTotal =
            highTeam.totalAverage - highPlayer.average + lowPlayer.average;
          const lowTeamNewTotal =
            lowTeam.totalAverage - lowPlayer.average + highPlayer.average;
          const newDiff = Math.abs(highTeamNewTotal - lowTeamNewTotal);

          // 현재 점수 차이와 비교
          const improvement = maxDiff - newDiff;

          if (improvement > bestImprovement) {
            bestImprovement = improvement;
            bestSwap = {
              player1: { ...highPlayer, sourceTeam: highTeam.teamNumber },
              player2: { ...lowPlayer, sourceTeam: lowTeam.teamNumber },
            };
          }
        }
      }

      if (bestSwap && bestImprovement > 0) {
        // 스위칭 실행
        switchPlayers(bestSwap.player1, bestSwap.player2);

        // 잠시 대기 (UI 업데이트를 위해)
        await new Promise((resolve) => setTimeout(resolve, 100));
      } else {
        break;
      }

      attempts++;
    } while (maxDiff > 10 && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      // 최대 시도 횟수 도달. 밸런싱 중단
    }

    // 최종 밸런싱 결과 출력
    const finalTeamStats = teamsToBalance.map((team) => ({
      teamNumber: team.team_number,
      totalAverage: team.total_average,
      playerCount: team.players.length,
    }));

    finalTeamStats.sort((a, b) => b.totalAverage - a.totalAverage);
    const finalMaxDiff =
      finalTeamStats[0].totalAverage -
      finalTeamStats[finalTeamStats.length - 1].totalAverage;

    // 밸런싱 결과 메시지 설정
    if (finalMaxDiff <= 10) {
      setBalancingResult(
        `✅ 팀 밸런싱 완료! 최대 점수 차이: ${finalMaxDiff}점 (${attempts}회 시도)`
      );
    } else {
      setBalancingResult(
        `⚠️ 밸런싱 완료. 최대 점수 차이: ${finalMaxDiff}점 (${attempts}회 시도)`
      );
    }

    // 5초 후 메시지 자동 제거
    setTimeout(() => setBalancingResult(''), 5000);

    setIsBalancing(false);
  };

  // 선수 선택 및 스위칭 시스템 함수들
  const handlePlayerClick = (player, sourceTeam) => {
    if (!isPlayerSelected) {
      // 첫 번째 선수 선택
      selectPlayer(player, sourceTeam);
    } else {
      // 두 번째 선수 선택 - 스위칭 시도
      if (
        selectedPlayer.playerId ===
        `${sourceTeam}-${player.name}-${player.average}`
      ) {
        // 같은 선수 클릭 - 선택 해제
        deselectPlayer();
      } else {
        // 다른 선수 클릭 - 스위칭 실행
        switchPlayers(selectedPlayer, { player, sourceTeam });
      }
    }
  };

  const selectPlayer = (player, sourceTeam) => {
    const playerData = {
      playerId: `${sourceTeam}-${player.name}-${player.average}`,
      player: { ...player },
      sourceTeam: sourceTeam,
    };

    setSelectedPlayer(playerData);
    setIsPlayerSelected(true);

    // 선수 선택
  };

  const deselectPlayer = () => {
    setSelectedPlayer(null);
    setIsPlayerSelected(false);

    // 선수 선택 해제
  };

  const switchPlayers = (player1, player2) => {
    const switchData = {
      player1: player1.player.name,
      team1: player1.sourceTeam,
      player2: player2.player.name,
      team2: player2.sourceTeam,
    };

    // 같은 팀 내에서의 스위칭은 의미가 없음
    if (player1.sourceTeam === player2.sourceTeam) {
      deselectPlayer();
      return;
    }

    // 두 선수를 서로 다른 팀으로 정확히 스위칭

    // 스위칭을 한 번에 처리
    const updatedTeams = teams.map((team) => {
      if (team.team_number === player1.sourceTeam) {
        // 팀 1에서 player1 제거하고 player2 추가
        const filteredPlayers = team.players.filter(
          (p) =>
            !(
              p.name === player1.player.name &&
              p.average === player1.player.average
            )
        );
        const newPlayers = [...filteredPlayers, player2.player];
        const newTotalAverage = newPlayers.reduce(
          (sum, p) => sum + p.average,
          0
        );
        const newAveragePerPlayer =
          newPlayers.length > 0 ? newTotalAverage / newPlayers.length : 0;

        // 팀 업데이트

        return {
          ...team,
          players: newPlayers,
          total_average: newTotalAverage,
          average_per_player: newAveragePerPlayer,
        };
      } else if (team.team_number === player2.sourceTeam) {
        // 팀 2에서 player2 제거하고 player1 추가
        const filteredPlayers = team.players.filter(
          (p) =>
            !(
              p.name === player2.player.name &&
              p.average === player2.player.average
            )
        );
        const newPlayers = [...filteredPlayers, player1.player];
        const newTotalAverage = newPlayers.reduce(
          (sum, p) => sum + p.average,
          0
        );
        const newAveragePerPlayer =
          newPlayers.length > 0 ? newTotalAverage / newPlayers.length : 0;

        // 팀 업데이트

        return {
          ...team,
          players: newPlayers,
          total_average: newTotalAverage,
          average_per_player: newAveragePerPlayer,
        };
      }
      return team;
    });

    // 팀 순서 유지 (팀 번호 순으로 정렬)
    const sortedTeams = updatedTeams.sort(
      (a, b) => a.team_number - b.team_number
    );
    setTeams(sortedTeams);

    // 선수 스위칭 완료

    // 선택 상태 초기화
    deselectPlayer();
  };

  const movePlayerToTeam = (playerData, targetTeam) => {
    const updatedTeams = teams.map((team) => {
      if (team.team_number === playerData.sourceTeam) {
        // 원본 팀에서 선수 제거
        const filteredPlayers = team.players.filter(
          (p) =>
            !(
              p.name === playerData.player.name &&
              p.average === playerData.player.average
            )
        );

        const newTotalAverage = filteredPlayers.reduce(
          (sum, p) => sum + p.average,
          0
        );
        const newAveragePerPlayer =
          filteredPlayers.length > 0
            ? newTotalAverage / filteredPlayers.length
            : 0;

        // 팀에서 선수 제거

        return {
          ...team,
          players: filteredPlayers,
          total_average: newTotalAverage,
          average_per_player: newAveragePerPlayer,
        };
      } else if (team.team_number === targetTeam) {
        // 대상 팀에 선수 추가
        const newPlayers = [...team.players, playerData.player];
        const newTotalAverage = newPlayers.reduce(
          (sum, p) => sum + p.average,
          0
        );
        const newAveragePerPlayer = newTotalAverage / newPlayers.length;

        // 팀에 선수 추가

        return {
          ...team,
          players: newPlayers,
          total_average: newTotalAverage,
          average_per_player: newAveragePerPlayer,
        };
      }
      return team;
    });

    // 팀 순서 유지 (팀 번호 순으로 정렬)
    const sortedTeams = updatedTeams.sort(
      (a, b) => a.team_number - b.team_number
    );
    setTeams(sortedTeams);
  };

  return (
    <div className="team-assignment-page">
      <div className="page-header">
        <h1>팀 배정</h1>
      </div>

      {/* 선수 입력 섹션 */}
      <div className="player-input-section">
        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <p>{loadingType} 중...</p>
            </div>
          </div>
        )}

        <div className="section-card">
          <h3 className="section-title">선수 추가</h3>

          {/* 회원 검색 */}
          <div className="search-section">
            <div className="search-header">
              <h4>회원 검색 및 추가</h4>
            </div>
            <div className="search-input-row">
              <div className="form-group search-group">
                <label>회원 검색</label>
                <input
                  type="text"
                  placeholder="회원 이름을 입력하세요 (엔터키로 검색)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    filterAutocomplete(e.target.value);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchAndAdd();
                      setShowAutocomplete(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowAutocomplete(false);
                      e.target.blur();
                    }
                  }}
                  onFocus={() => {
                    if (searchQuery.trim()) {
                      filterAutocomplete(searchQuery);
                    } else {
                      // 빈 검색어일 때도 모든 회원 표시 (최대 5개)
                      const allMembers = members.slice(0, 5);
                      setFilteredAutocomplete(allMembers);
                      setShowAutocomplete(allMembers.length > 0);
                    }
                  }}
                  onBlur={() => {
                    // 약간의 지연을 두어 클릭 이벤트가 처리되도록 함
                    setTimeout(() => setShowAutocomplete(false), 200);
                  }}
                  className="search-input"
                />

                {/* 자동완성 목록 */}
                {showAutocomplete && (
                  <div className="autocomplete-list">
                    {filteredAutocomplete.map((member) => (
                      <div
                        key={member.id}
                        className="autocomplete-item"
                        onClick={() => {
                          handleAutocompleteToSearch(member);
                        }}
                      >
                        <div className="autocomplete-member-info">
                          <span className="autocomplete-name">
                            {member.name}
                          </span>
                          <span className="autocomplete-gender">
                            {member.gender || '미지정'}
                          </span>
                        </div>
                        <span className="autocomplete-indicator">
                          클릭하여 검색 결과에 추가
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="search-results">
                <div className="search-results-header">
                  <h5>검색 결과 ({searchResults.length}명)</h5>
                  <div className="search-results-actions">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={handleAddAllSearchResults}
                      disabled={searchResults.length === 0 || isLoading}
                    >
                      {isLoading && loadingType === '전체 추가'
                        ? '추가 중...'
                        : `전체 추가 (${searchResults.length}명)`}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSearchResults([])}
                      disabled={searchResults.length === 0 || isLoading}
                    >
                      목록 초기화
                    </button>
                  </div>
                </div>
                <div className="search-results-grid">
                  {searchResults.map((member) => (
                    <div
                      key={member.id}
                      className={`search-result-card ${
                        isDuplicatePlayer(member.name) ? 'duplicate' : ''
                      }`}
                    >
                      {/* 제거 버튼 */}
                      <button
                        className="remove-member-btn"
                        onClick={() => {
                          setSearchResults((prev) =>
                            prev.filter((result) => result.id !== member.id)
                          );
                        }}
                        title="검색 결과에서 제거"
                      >
                        ×
                      </button>

                      <div className="member-info">
                        <div className="member-name">{member.name}</div>
                        <div className="member-gender">
                          {member.gender || '미지정'}
                        </div>
                        {calculatedAverageInfo.isCalculated &&
                          calculatedAverageInfo.memberName === member.name && (
                            <div className="average-info">
                              <small className="info-text">
                                📊 {calculatedAverageInfo.period} 기록 (
                                {calculatedAverageInfo.gameCount}게임) 기반
                              </small>
                            </div>
                          )}
                      </div>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleAddSingleMember(member)}
                        disabled={isLoading || isDuplicatePlayer(member.name)}
                      >
                        {isLoading && loadingType === '개별 추가'
                          ? '추가 중...'
                          : isDuplicatePlayer(member.name)
                          ? '이미 추가됨'
                          : '추가'}
                      </button>
                    </div>
                  ))}
                </div>

                {/* 검색 결과 전체 추가 시 중복 알림을 검색 결과 아래에 표시 */}
                {searchDuplicateAlert && (
                  <div className="duplicate-alert search-duplicate-alert">
                    <div className="alert-content">
                      <span className="alert-icon">⚠️</span>
                      <div className="alert-text">
                        {searchDuplicateAlert.split('\n').map((line, index) => (
                          <div key={index}>{line}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 대량 입력 */}
          <div className="bulk-input-section">
            <div className="bulk-header">
              <h4>회원 선택 ({selectedMembers.length}명 선택됨)</h4>
            </div>

            <div className="members-grid">
              {members.map((member) => {
                const isSelected = selectedMembers.some(
                  (selected) => selected.id === member.id
                );
                return (
                  <div
                    key={member.id}
                    className={`member-card ${
                      isSelected ? 'selected' : 'unselected'
                    } ${
                      highlightedMemberId === member.id ? 'highlighted' : ''
                    } ${isMemberInPlayerList(member.name) ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!isMemberInPlayerList(member.name)) {
                        toggleMemberSelection(member);
                      }
                    }}
                    data-member-id={member.id}
                  >
                    <div className="member-info">
                      <div className="member-name">{member.name}</div>
                      <div className="member-gender">
                        {member.gender || '미지정'}
                      </div>
                    </div>
                    <div className="selection-indicator">
                      {isMemberInPlayerList(member.name)
                        ? '✓'
                        : isSelected
                        ? '✓'
                        : '+'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 버튼들을 목록 아래로 이동 */}
            <div className="bulk-actions-bottom">
              <button
                className="btn btn-success"
                onClick={handleBulkAdd}
                disabled={selectedMembers.length === 0 || isLoading}
              >
                {isLoading && loadingType === '선택된 회원 추가'
                  ? '추가 중...'
                  : `선택된 회원 추가 (${selectedMembers.length}명)`}
              </button>
              <button
                className="btn btn-secondary"
                onClick={clearSelectedMembers}
                disabled={selectedMembers.length === 0}
              >
                선택 초기화
              </button>
            </div>

            {/* 선택된 회원 추가 시 중복 알림을 버튼 아래에 표시 */}
            {bulkDuplicateAlert && (
              <div className="duplicate-alert bulk-duplicate-alert">
                <div className="alert-content">
                  <span className="alert-icon">⚠️</span>
                  <div className="alert-text">
                    {bulkDuplicateAlert.split('\n').map((line, index) => (
                      <div key={index}>{line}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 선수 목록 */}
      <div className="players-section" ref={playersSectionRef}>
        <div className="section-card">
          <div className="section-header">
            <h3 className="section-title">선수 목록 ({players.length}명)</h3>
            <div className="section-actions">
              <button
                className="btn btn-danger"
                onClick={handleClearPlayers}
                disabled={players.length === 0}
              >
                전체 삭제
              </button>
            </div>
          </div>

          {players.length > 0 ? (
            <div className="players-grid">
              {players.map((player, index) => {
                // 선수 데이터 구조에 따라 접근 방식 결정
                const playerName = Array.isArray(player)
                  ? player[0]
                  : player.name;
                const playerAverage = Array.isArray(player)
                  ? player[1]
                  : player.average;
                const playerGender = Array.isArray(player)
                  ? player[2]
                  : player.gender;

                return (
                  <div key={index} className="player-card">
                    <div className="player-info">
                      <div className="player-name">{playerName}</div>
                      <div className="player-average">{playerAverage} 에버</div>
                      <div className="player-gender">{playerGender || '-'}</div>
                    </div>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeletePlayer(playerName)}
                    >
                      삭제
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-players">등록된 선수가 없습니다.</div>
          )}
        </div>
      </div>

      {/* 팀 구성 */}
      <div className="team-config-section">
        <div className="section-card">
          <h3 className="section-title">팀 구성</h3>

          <div className="team-config">
            <div className="team-config-row">
              <div className="form-group">
                <label>팀 수</label>
                <input
                  type="number"
                  value={teamConfig.team_count}
                  onChange={(e) =>
                    setTeamConfig({
                      ...teamConfig,
                      team_count: parseInt(e.target.value),
                    })
                  }
                  min="2"
                  max="10"
                />
              </div>
              <div className="form-group">
                <label>팀당 인원</label>
                <input
                  type="number"
                  value={teamConfig.team_size}
                  onChange={(e) =>
                    setTeamConfig({
                      ...teamConfig,
                      team_size: parseInt(e.target.value),
                    })
                  }
                  min="2"
                  max="8"
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleMakeTeams}
                disabled={loading || isBalancing || players.length === 0}
              >
                {loading ? (
                  '팀 구성 중...'
                ) : isBalancing ? (
                  <>
                    <span className="loading-spinner"></span>
                    밸런싱 중...
                  </>
                ) : (
                  '팀 구성하기'
                )}
              </button>

              <label className="gender-balance-option">
                <input
                  type="checkbox"
                  checked={teamOptions.balanceByGender}
                  onChange={(e) =>
                    setTeamOptions({
                      ...teamOptions,
                      balanceByGender: e.target.checked,
                    })
                  }
                />
                <span>여성 인원 균등 분배</span>
              </label>
            </div>
          </div>

          {/* 팀 결과 */}
          {teams.length > 0 && (
            <div className="teams-result">
              <h4>팀 구성 결과</h4>

              {/* 밸런싱 결과 메시지 */}
              {balancingResult && (
                <div className="balancing-result-message">
                  {balancingResult}
                </div>
              )}

              <div className="teams-grid">
                {teams
                  .slice()
                  .sort((a, b) => b.total_average - a.total_average)
                  .map((team, index) => (
                    <div
                      key={index}
                      className="team-card"
                      data-team-number={team.team_number}
                    >
                      <div className="team-header">
                        <h5>팀 {team.team_number}</h5>
                        <div className="team-stats">
                          <span>총 에버: {team.total_average}</span>
                          <span>
                            평균: {team.average_per_player.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="team-players">
                        {team.players
                          .slice()
                          .sort((a, b) => b.average - a.average)
                          .map((player, pIndex) => (
                            <div
                              key={pIndex}
                              className={`team-player ${
                                selectedPlayer &&
                                selectedPlayer.playerId ===
                                  `${team.team_number}-${player.name}-${player.average}`
                                  ? 'selected'
                                  : ''
                              }`}
                              onClick={() =>
                                handlePlayerClick(player, team.team_number)
                              }
                            >
                              <span className="player-name">{player.name}</span>
                              <span className="player-average">
                                {player.average}
                              </span>
                              <span className="player-gender">
                                {player.gender || '-'}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamAssignment;
