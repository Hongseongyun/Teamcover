import React, { useState, useEffect, useRef, useCallback } from 'react';
import { teamAPI, memberAPI } from '../services/api';
import { RotateCcw, Trash2, Save, MoreVertical, Search, Check } from 'lucide-react';
import './TeamAssignment.css';

const TeamAssignment = () => {
  const [players, setPlayers] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  // 평균 점수 캐시 (이름 -> average)
  const [memberAverageMap, setMemberAverageMap] = useState(new Map());
  // 회원별 게임 수 정보 (이름 -> score_count)
  const [memberGameCountMap, setMemberGameCountMap] = useState(new Map());

  const [teamConfig, setTeamConfig] = useState({
    team_count: 3,
    team_size: 6,
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
  const [searchDuplicateAlert, setSearchDuplicateAlert] = useState('');

  // 팀 구성 상태 추적
  const [isTeamConfigured, setIsTeamConfigured] = useState(false);
  const [bulkDuplicateAlert, setBulkDuplicateAlert] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [filteredAutocomplete, setFilteredAutocomplete] = useState([]);

  // 저장된 팀 구성 결과 (최대 3개)
  const [savedTeamConfigs, setSavedTeamConfigs] = useState([]);
  const [selectedSavedConfigIndex, setSelectedSavedConfigIndex] = useState(0);

  // 선수 목록 설정 메뉴 상태
  const [showPlayersMenu, setShowPlayersMenu] = useState(false);
  // 선수 추가 섹션 설정 메뉴 상태
  const [showPlayerInputMenu, setShowPlayerInputMenu] = useState(false);

  // 선수 목록 섹션 ref
  const playersSectionRef = useRef(null);

  // 선수 선택 및 스위칭 시스템 상태
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isPlayerSelected, setIsPlayerSelected] = useState(false);

  // 점수 입력 모달 상태
  const [showScoreInputModal, setShowScoreInputModal] = useState(false);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [memberScores, setMemberScores] = useState({});

  // 게스트 추가 모달 상태
  const [showGuestModal, setShowGuestModal] = useState(false);

  // 모달이 열릴 때 배경 스크롤 막기
  useEffect(() => {
    if (showScoreInputModal || showGuestModal) {
      // 현재 스크롤 위치 저장
      const scrollY = window.scrollY;
      // body 스타일 적용
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        // 모달이 닫힐 때 스크롤 복원
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showScoreInputModal, showGuestModal]);

  // 외부 클릭 시 선수 목록 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !event.target.closest(
          '.action-menu-container[data-item-id="players-settings"]'
        ) &&
        showPlayersMenu
      ) {
        setShowPlayersMenu(false);
      }
      if (
        !event.target.closest(
          '.action-menu-container[data-item-id="player-input-settings"]'
        ) &&
        showPlayerInputMenu
      ) {
        setShowPlayerInputMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPlayersMenu, showPlayerInputMenu]);

  const [guestData, setGuestData] = useState({
    name: '',
    average: '',
    gender: '',
  });
  const [guestErrors, setGuestErrors] = useState({
    name: '',
    average: '',
  });

  // 팀 구성 가능 여부 계산
  const isTeamFormationPossible = () => {
    const totalPlayers = players.length;
    const requiredPlayers = teamConfig.team_count * teamConfig.team_size;
    return totalPlayers === requiredPlayers;
  };

  const loadPlayers = useCallback(async () => {
    try {
      const response = await teamAPI.getPlayers();
      if (response.data.success) {
        // 선수 데이터 구조 변환 (필요한 경우)
        const formattedPlayers = response.data.players.map((player) => {
          if (Array.isArray(player)) {
            // 배열 형태인 경우 객체로 변환
            return {
              name: player[0] || '이름 없음',
              average: parseFloat(player[1]) || 0,
              gender: player[2] || '남',
            };
          }
          return player;
        });

        setPlayers(formattedPlayers);
        calculateStats(formattedPlayers);
      }
    } catch (error) {
      console.error('선수 목록 로드 실패:', error);
    }
  }, []);

  useEffect(() => {
    loadMembers();
    loadPlayers();
  }, [loadPlayers]);

  // 선수 목록이 변경되면 팀 구성 상태 초기화
  useEffect(() => {
    if (isTeamConfigured) {
      setIsTeamConfigured(false);
      setTeams([]);
      setBalancingResult('');
    }
  }, [players.length]); // 선수 수가 변경될 때만 실행

  // 팀 구성 설정이 변경되면 팀 구성 상태 초기화
  useEffect(() => {
    setIsTeamConfigured(false);
    setTeams([]);
    setBalancingResult('');
  }, [teamConfig.team_count, teamConfig.team_size]); // 팀 설정이 변경될 때 실행

  const loadMembers = async () => {
    try {
      const response = await memberAPI.getMembers();
      if (response.data.success) {
        setMembers(response.data.members);
        // 멤버 응답 기반 기본 맵 구성
        const baseMap = new Map();
        response.data.members.forEach((m) => {
          if (
            m &&
            m.name &&
            m.average_score !== null &&
            m.average_score !== undefined
          ) {
            baseMap.set(m.name, Math.round(m.average_score));
          }
        });
        // 일괄 평균 조회로 맵 보강 (가능 시)
        const gameCountMap = new Map();
        try {
          const avgRes = await memberAPI.getAllMembersAverages();
          if (avgRes?.data?.success) {
            // 응답 형식 확인 (averages 배열 또는 members 배열)
            const averagesData = Array.isArray(avgRes.data.averages) 
              ? avgRes.data.averages 
              : Array.isArray(avgRes.data.members) 
              ? avgRes.data.members 
              : [];
            
            averagesData.forEach((a) => {
              const name = a.member_name || a.name;
              const avg = a.average_score ?? a.average;
              const scoreCount = a.score_count || 0;
              
              if (name && avg !== null && avg !== undefined) {
                baseMap.set(name, Math.round(avg));
              }
              
              if (name && scoreCount > 0) {
                gameCountMap.set(name, scoreCount);
              }
            });
          }
        } catch (e) {
          // 무시: 네트워크 실패 시 members만으로 사용
        }
        setMemberAverageMap(baseMap);
        setMemberGameCountMap(gameCountMap);
      }
    } catch (error) {
      // 에러 처리
    }
  };

  // 회원 데이터에서 평균 에버 사용 (최적화: 불필요한 API 호출 제거)
  const calculateAverageFromScores = async (memberName) => {
    try {
      // 회원 목록에서 직접 찾기 (이미 로드되어 있음)
      const member = members.find((m) => m.name === memberName);

      if (member && member.average_score) {
        // 게임 수 정보 가져오기 (저장된 맵에서 조회)
        const gameCount = memberGameCountMap.get(memberName) || 1;
        
        // 회원 데이터의 평균 점수 사용
        setCalculatedAverageInfo({
          period: '정기전 에버',
          gameCount: gameCount,
          isCalculated: true,
          memberName: memberName,
        });
      }
    } catch (error) {
      // 에러 처리
    }
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

      // 에버 정보 표시를 위한 계산
      await calculateAverageFromScores(member.name);

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
        const avgList = await runWithConcurrency(
          nonDuplicateMembers,
          async (member) => ({
            member,
            average: await getMemberAverage(member.name),
          }),
          6
        );
        const withAvg = avgList.filter((x) => x && x.average !== null);
        await runWithConcurrency(
          withAvg,
          async ({ member, average }) =>
            teamAPI.addPlayer({
              name: member.name,
              average,
              gender: member.gender || '',
            }),
          6
        );
      } else {
        // 모든 검색 결과를 순차적으로 추가
        const avgList = await runWithConcurrency(
          searchResults,
          async (member) => ({
            member,
            average: await getMemberAverage(member.name),
          }),
          6
        );
        const withAvg = avgList.filter((x) => x && x.average !== null);
        await runWithConcurrency(
          withAvg,
          async ({ member, average }) =>
            teamAPI.addPlayer({
              name: member.name,
              average,
              gender: member.gender || '',
            }),
          6
        );
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

  const calculateStats = (playerList) => {
    if (!playerList || playerList.length === 0) return;

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
        const avgList = await runWithConcurrency(
          nonDuplicateMembers,
          async (member) => ({
            member,
            average: await getMemberAverage(member.name),
          }),
          6
        );
        const withAvg = avgList.filter((x) => x && x.average !== null);
        await runWithConcurrency(
          withAvg,
          async ({ member, average }) =>
            teamAPI.addPlayer({
              name: member.name,
              average,
              gender: member.gender || '',
            }),
          6
        );
      } else {
        // 모든 선택된 회원 추가
        const avgList = await runWithConcurrency(
          selectedMembers,
          async (member) => ({
            member,
            average: await getMemberAverage(member.name),
          }),
          6
        );
        const membersWithScores = avgList
          .filter((x) => x && x.average !== null)
          .map(({ member, average }) => ({ ...member, average }));
        const membersWithoutScores = avgList
          .filter((x) => !x || x.average === null)
          .map((x) => x?.member)
          .filter(Boolean);

        // 점수가 있는 회원들 먼저 추가
        await runWithConcurrency(
          membersWithScores,
          async (member) =>
            teamAPI.addPlayer({
              name: member.name,
              average: member.average,
              gender: member.gender || '',
            }),
          6
        );

        // 점수가 없는 회원들은 모달로 처리
        if (membersWithoutScores.length > 0) {
          setPendingMembers(membersWithoutScores);
          setMemberScores({});
          setShowScoreInputModal(true);
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
      // 캐시 우선
      if (memberAverageMap && memberAverageMap.has(memberName)) {
        return memberAverageMap.get(memberName);
      }
      // 회원 목록에서 해당 회원 찾기
      const member = members.find((m) => m.name === memberName);

      if (
        member &&
        member.average_score !== null &&
        member.average_score !== undefined
      ) {
        // 저장된 평균 점수가 있으면 반환
        const avg = Math.round(member.average_score);
        setMemberAverageMap((prev) => {
          const next = new Map(prev);
          next.set(memberName, avg);
          return next;
        });
        return avg;
      }

      // 저장된 평균 점수가 없으면 API로 조회
      if (member) {
        const response = await memberAPI.getMemberAverage(member.id);
        if (response.data.success) {
          const avg = Math.round(response.data.average);
          setMemberAverageMap((prev) => {
            const next = new Map(prev);
            next.set(memberName, avg);
            return next;
          });
          return avg;
        }
      }
    } catch (error) {
      console.error('평균 점수 조회 오류:', error);
    }

    // 점수가 없는 경우 null 반환 (사용자 입력 필요)
    return null;
  };

  // 동시성 제한 유틸
  const runWithConcurrency = async (items, worker, limit = 6) => {
    const results = new Array(items.length);
    let index = 0;
    const runners = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (true) {
          const current = index++;
          if (current >= items.length) break;
          try {
            results[current] = await worker(items[current], current);
          } catch (e) {
            results[current] = { error: e };
          }
        }
      }
    );
    await Promise.all(runners);
    return results;
  };

  // 점수 입력 모달 핸들러
  const handleScoreInput = (memberName, score) => {
    setMemberScores((prev) => ({
      ...prev,
      [memberName]: score,
    }));
  };

  // 점수 입력 완료
  const handleScoreInputComplete = async () => {
    try {
      setIsLoading(true);
      setLoadingType('점수 입력된 회원 추가');

      for (const member of pendingMembers) {
        const score = memberScores[member.name];
        if (score && score > 0) {
          const playerData = {
            name: member.name,
            average: parseInt(score),
            gender: member.gender || '',
          };
          await teamAPI.addPlayer(playerData);
        }
      }

      // 모달 닫기
      setShowScoreInputModal(false);
      setPendingMembers([]);
      setMemberScores({});

      // 선수 목록 새로고침
      await loadPlayers();
    } catch (error) {
      console.error('점수 입력된 회원 추가 오류:', error);
    } finally {
      setIsLoading(false);
      setLoadingType('');
    }
  };

  // 점수 입력 취소
  const handleScoreInputCancel = () => {
    setShowScoreInputModal(false);
    setPendingMembers([]);
    setMemberScores({});
  };

  // 게스트 추가 모달 열기
  const handleOpenGuestModal = () => {
    setShowGuestModal(true);
    setGuestData({
      name: '',
      average: '',
      gender: '',
    });
  };

  // 게스트 추가 모달 닫기
  const handleCloseGuestModal = () => {
    setShowGuestModal(false);
    setGuestData({
      name: '',
      average: '',
      gender: '',
    });
    setGuestErrors({
      name: '',
      average: '',
    });
  };

  // 게스트 데이터 입력 핸들러
  const handleGuestDataChange = (field, value) => {
    setGuestData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // 검증 로직
    if (field === 'name') {
      // 한글, 영어, 공백만 허용
      const namePattern = /^[가-힣a-zA-Z\s]*$/;
      if (value && !namePattern.test(value)) {
        setGuestErrors((prev) => ({
          ...prev,
          name: '한글과 영어만 입력 가능합니다.',
        }));
      } else {
        setGuestErrors((prev) => ({
          ...prev,
          name: '',
        }));
      }
    } else if (field === 'average') {
      // 빈 문자열이면 에러 없음
      if (!value) {
        setGuestErrors((prev) => ({
          ...prev,
          average: '',
        }));
      } else {
        // 숫자인지 확인
        const numValue = Number(value);
        if (isNaN(numValue)) {
          setGuestErrors((prev) => ({
            ...prev,
            average: '0~300 사이의 숫자를 입력하세요.',
          }));
        } else if (numValue < 0 || numValue > 300) {
          setGuestErrors((prev) => ({
            ...prev,
            average: '0~300 사이의 숫자를 입력하세요.',
          }));
        } else {
          setGuestErrors((prev) => ({
            ...prev,
            average: '',
          }));
        }
      }
    }
  };

  // 게스트 추가 완료
  const handleAddGuest = async () => {
    if (!guestData.name.trim() || !guestData.average || !guestData.gender) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    // 검증 에러가 있으면 추가 불가
    if (guestErrors.name || guestErrors.average) {
      return;
    }

    try {
      setIsLoading(true);
      setLoadingType('게스트 추가');

      const playerData = {
        name: guestData.name.trim(),
        average: parseInt(guestData.average),
        gender: guestData.gender,
      };

      await teamAPI.addPlayer(playerData);

      // 모달 닫기
      handleCloseGuestModal();

      // 선수 목록 새로고침
      await loadPlayers();
    } catch (error) {
      console.error('게스트 추가 오류:', error);
    } finally {
      setIsLoading(false);
      setLoadingType('');
    }
  };

  const handleDeletePlayer = async (name) => {
    try {
      await teamAPI.deletePlayer({ name });
      loadPlayers();
    } catch (error) {
      console.error('개별 선수 삭제 오류:', error);
    }
  };

  const handleClearPlayers = async () => {
    if (window.confirm('모든 선수를 삭제하시겠습니까?')) {
      try {
        await teamAPI.clearPlayers();
        loadPlayers();
        setTeams([]);
      } catch (error) {
        console.error('전체 선수 삭제 오류:', error);
      }
    }
  };

  const handleMakeTeams = async () => {
    if (players.length === 0) {
      alert('선수를 먼저 추가해주세요.');
      return;
    }

    if (!isTeamFormationPossible()) {
      const requiredPlayers = teamConfig.team_count * teamConfig.team_size;
      alert(
        `인원이 맞지 않습니다. 현재 ${players.length}명, 필요 ${requiredPlayers}명`
      );
      return;
    }

    try {
      setLoading(true);
      setIsBalancing(true);

      // 이미 팀이 구성된 상태인지 확인
      if (isTeamConfigured && teams.length > 0) {
        // 밸런싱 개선: 각 팀의 1시드를 제외한 선수들을 30번 섞고 다시 팀 배정

        // 1단계: 각 팀에서 1시드(가장 높은 에버 선수) 추출 (팀 번호와 함께 저장)
        const firstSeedsByTeam = []; // [{team_number, player}]
        const remainingPlayers = [];

        teams.forEach((team) => {
          // 각 팀의 선수들을 에버 순으로 정렬 (내림차순)
          const sortedTeamPlayers = [...team.players].sort(
            (a, b) => b.average - a.average
          );

          if (sortedTeamPlayers.length > 0) {
            // 1시드 추출 (가장 높은 에버 선수) - 원래 팀 번호와 함께 저장
            firstSeedsByTeam.push({
              team_number: team.team_number,
              player: sortedTeamPlayers[0],
            });

            // 나머지 선수들 추가
            remainingPlayers.push(...sortedTeamPlayers.slice(1));
          }
        });

        // 2단계: 나머지 선수들을 랜덤으로 30번 섞기 (정렬하지 않음!)
        for (let i = 0; i < 30; i++) {
          // Fisher-Yates 셔플 알고리즘
          for (let j = remainingPlayers.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [remainingPlayers[j], remainingPlayers[k]] = [
              remainingPlayers[k],
              remainingPlayers[j],
            ];
          }
        }

        // 3단계: 1시드를 각 팀에 먼저 배치하고, 섞인 나머지 선수들을 배치
        const { team_count, team_size } = teamConfig;
        const newTeams = [];

        // 팀 초기화 및 1시드 배치
        for (let i = 1; i <= team_count; i++) {
          const firstSeed = firstSeedsByTeam.find(
            (seed) => seed.team_number === i
          );
          newTeams.push({
            team_number: i,
            players: firstSeed ? [firstSeed.player] : [],
            total_average: firstSeed ? firstSeed.player.average : 0,
            average_per_player: firstSeed ? firstSeed.player.average : 0,
          });
        }

        // 4단계: 섞인 나머지 선수들을 순서대로 배치 (스네이크 패턴)
        let currentTeam = 0;
        let direction = 1; // 1: 정방향, -1: 역방향

        for (const player of remainingPlayers) {
          // 현재 팀에 자리가 있는지 확인
          if (newTeams[currentTeam].players.length >= team_size) {
            // 방향 전환 (스네이크 패턴)
            if (direction === 1) {
              currentTeam = team_count - 1;
              direction = -1;
            } else {
              currentTeam = 0;
              direction = 1;
            }
          }

          // 자리가 있으면 현재 팀에 배치
          if (newTeams[currentTeam].players.length < team_size) {
            newTeams[currentTeam].players.push(player);
            newTeams[currentTeam].total_average += player.average;
            newTeams[currentTeam].average_per_player =
              newTeams[currentTeam].total_average /
              newTeams[currentTeam].players.length;

            // 다음 팀으로 이동
            currentTeam += direction;

            // 경계 체크
            if (currentTeam < 0) {
              currentTeam = 0;
              direction = 1;
            } else if (currentTeam >= team_count) {
              currentTeam = team_count - 1;
              direction = -1;
            }
          }
        }

        // 5단계: 각 팀의 평균 재계산
        newTeams.forEach((team) => {
          team.total_average = team.players.reduce(
            (sum, player) => sum + player.average,
            0
          );
          team.average_per_player = team.total_average / team.players.length;
        });

        // 6단계: 새로운 규칙에 따른 밸런싱 적용 (1시드는 고정)
        const finalTeams = await balanceTeamsWithNewRules(newTeams);

        // 7단계: 여성 회원 분포 검증
        const validation = validateFemaleDistribution(finalTeams, players);
        if (!validation.isValid) {
          setBalancingResult(`❌ ${validation.message} 다시 시도해주세요.`);
          setTimeout(() => setBalancingResult(''), 5000);
          setLoading(false);
          setIsBalancing(false);
          return;
        }

        // 8단계: 팀 번호 순으로 정렬하여 UI에 설정
        const sortedTeams = finalTeams.sort(
          (a, b) => a.team_number - b.team_number
        );
        setTeams(sortedTeams);

        // 결과 메시지 설정
        const maxDiff =
          Math.max(...sortedTeams.map((t) => t.total_average)) -
          Math.min(...sortedTeams.map((t) => t.total_average));

        if (maxDiff <= 5) {
          setBalancingResult(
            `✅ 밸런싱 개선 완료! 1시드 유지 + 30번 랜덤 셔플 후 재배정 (최대 차이: ${maxDiff}점)`
          );
        } else if (maxDiff <= 10) {
          setBalancingResult(
            `⚠️ 밸런싱 개선 완료. 1시드 유지 + 30번 랜덤 셔플 후 재배정 (최대 차이: ${maxDiff}점)`
          );
        } else {
          setBalancingResult(
            `⚠️ 밸런싱 개선 완료. 1시드 유지 + 30번 랜덤 셔플 후 재배정 (최대 차이: ${maxDiff}점)`
          );
        }

        // 5초 후 메시지 자동 제거
        setTimeout(() => setBalancingResult(''), 5000);

        // 상태 업데이트 완료를 위해 약간의 지연 후 로딩 해제
        setTimeout(() => {
          setLoading(false);
          setIsBalancing(false);
        }, 100);
        return;
      }

      // 새로운 팀 구성 시작

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

      // 2단계: 여성 균등 분배 체크박스에 따른 팀 구성
      const balancedTeams = createBalancedTeams(sortedPlayers);

      // 3단계: 새로운 규칙에 따른 밸런싱 적용
      const finalTeams = await balanceTeamsWithNewRules(balancedTeams);

      // 4단계: 여성 회원 분포 검증
      const validation = validateFemaleDistribution(finalTeams, validPlayers);
      if (!validation.isValid) {
        setBalancingResult(`❌ ${validation.message} 다시 시도해주세요.`);
        setTimeout(() => setBalancingResult(''), 5000);
        setLoading(false);
        setIsBalancing(false);
        return;
      }

      // 5단계: 팀 번호 순으로 정렬하여 UI에 설정
      const sortedTeams = finalTeams.sort(
        (a, b) => a.team_number - b.team_number
      );
      setTeams(sortedTeams);
      setIsTeamConfigured(true); // 팀 구성 완료 상태로 설정

      // 팀 구성 및 밸런싱 완료

      // 6단계: 결과 메시지 설정
      const maxDiff =
        Math.max(...sortedTeams.map((t) => t.total_average)) -
        Math.min(...sortedTeams.map((t) => t.total_average));

      if (maxDiff <= 5) {
        setBalancingResult(
          `✅ 팀 구성 완료! 여성 균등 분배 + 점수 밸런싱 완료 (최대 차이: ${maxDiff}점, 2000회 시도 중 최적 결과)`
        );
      } else if (maxDiff <= 10) {
        setBalancingResult(
          `⚠️ 팀 구성 완료. 여성 균등 분배 완료, 점수 차이: ${maxDiff}점 (2000회 시도 중 최적 결과)`
        );
      } else {
        setBalancingResult(
          `⚠️ 팀 구성 완료. 여성 균등 분배 완료, 점수 차이: ${maxDiff}점 (2000회 시도 중 최적 결과)`
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

  // 팀 구성 결과 저장 함수
  const saveTeamConfig = () => {
    if (teams.length === 0) {
      alert('저장할 팀 구성이 없습니다.');
      return;
    }

    const newConfig = {
      id: Date.now(),
      teams: JSON.parse(JSON.stringify(teams)), // 깊은 복사
      balancingResult: balancingResult,
      savedAt: new Date().toLocaleString('ko-KR'),
    };

    // 빈 자리(삭제된 자리)가 있는지 확인
    const emptyIndex = savedTeamConfigs.findIndex((config) => config === null);

    if (emptyIndex !== -1) {
      // 빈 자리가 있으면 그 자리에 채우기
      const updated = [...savedTeamConfigs];
      updated[emptyIndex] = newConfig;
      setSavedTeamConfigs(updated);
      setSelectedSavedConfigIndex(emptyIndex);
    } else if (savedTeamConfigs.length < 3) {
      // 빈 자리가 없고 3개 미만이면 추가
      setSavedTeamConfigs([...savedTeamConfigs, newConfig]);
      setSelectedSavedConfigIndex(savedTeamConfigs.length); // 새로 저장된 것을 선택
    } else {
      // 3개가 모두 차있으면 가장 오래된 것을 제거하고 새로 추가
      const updated = [...savedTeamConfigs.slice(1), newConfig];
      setSavedTeamConfigs(updated);
      setSelectedSavedConfigIndex(2); // 마지막 인덱스 선택
    }

    const savedCount = savedTeamConfigs.filter((c) => c !== null).length;
    const newCount = emptyIndex !== -1 ? savedCount : savedCount + 1;
    alert(`팀 구성이 저장되었습니다. (${newCount}/3)`);
  };

  // 저장된 팀 구성 삭제 함수
  const deleteSavedTeamConfig = (index) => {
    if (!savedTeamConfigs[index]) return;

    if (window.confirm(`저장 ${index + 1}을 삭제하시겠습니까?`)) {
      const updated = [...savedTeamConfigs];
      updated[index] = null; // null로 표시하여 빈 자리로 만듦
      setSavedTeamConfigs(updated);

      // 삭제된 탭이 현재 선택된 탭이면 다른 탭으로 이동
      if (selectedSavedConfigIndex === index) {
        // 다른 저장된 결과 찾기
        const nextIndex = updated.findIndex((config) => config !== null);
        if (nextIndex !== -1) {
          setSelectedSavedConfigIndex(nextIndex);
        } else {
          // 모든 저장된 결과가 삭제되었으면 첫 번째 인덱스로 (null이지만)
          setSelectedSavedConfigIndex(0);
        }
      }
    }
  };

  // 저장된 팀 구성 불러오기 (더 이상 사용 안 함, 비교용으로만 표시)

  // 여성 회원 분포 검증 함수
  const validateFemaleDistribution = (teams, allPlayers) => {
    // 전체 여성 회원 수 계산
    const totalFemaleCount = allPlayers.filter((p) => p.gender === '여').length;

    // 여성 회원이 없으면 검증 통과
    if (totalFemaleCount === 0) {
      return { isValid: true, message: '' };
    }

    // 팀 수 계산
    const teamCount = teams.length;

    // 각 팀에 최소 여성 회원 수 계산 (전체 여성 수 / 팀 수의 몫)
    const minFemalePerTeam = Math.floor(totalFemaleCount / teamCount);

    // 각 팀의 여성 회원 수 확인
    const teamFemaleCounts = teams.map(
      (team) => team.players.filter((p) => p.gender === '여').length
    );

    // 모든 팀이 최소 여성 회원 수를 만족하는지 확인
    const allTeamsHaveMinFemale = teamFemaleCounts.every(
      (count) => count >= minFemalePerTeam
    );

    if (!allTeamsHaveMinFemale) {
      const teamCountsStr = teamFemaleCounts.join(', ');
      return {
        isValid: false,
        message: `여성 회원 분포 불균형: 각 팀에 최소 ${minFemalePerTeam}명의 여성 회원이 필요하지만, 현재 팀별 여성 수는 [${teamCountsStr}]명입니다.`,
      };
    }

    return { isValid: true, message: '' };
  };

  // 개선된 팀 구성 함수
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

    // 에버 순으로 정렬 (내림차순)
    const playersByAverage = [...sortedPlayers].sort(
      (a, b) => b.average - a.average
    );

    // 항상 여성 균등 분배 + 새로운 규칙 적용
    return createBalancedTeamsWithNewRules(
      teams,
      playersByAverage,
      team_count,
      team_size
    );
  };

  // 새로운 규칙에 따른 팀 구성
  const createBalancedTeamsWithNewRules = (
    teams,
    playersByAverage,
    team_count,
    team_size
  ) => {
    const femalePlayers = playersByAverage.filter((p) => p.gender === '여');
    const malePlayers = playersByAverage.filter((p) => p.gender === '남');

    // 1단계: 여성회원만 따로 스네이크 패턴 적용 (권장 방법)
    distributeFemalePlayersBySnakePattern(
      teams,
      femalePlayers,
      team_count,
      team_size
    );

    // 2단계: 남성회원들을 남은 빈자리에 스네이크 패턴으로 배치
    distributeMalePlayersToEmptySlots(
      teams,
      malePlayers,
      team_count,
      team_size
    );

    // 각 팀의 평균 계산
    teams.forEach((team) => {
      team.average_per_player =
        team.players.length > 0 ? team.total_average / team.players.length : 0;
    });

    return teams;
  };

  // 여성 선수만 따로 스네이크 패턴 적용 (권장 방법)
  const distributeFemalePlayersBySnakePattern = (
    teams,
    femalePlayers,
    team_count,
    team_size
  ) => {
    if (femalePlayers.length === 0) return;

    // 여성 선수들을 에버 순으로 정렬 (내림차순)
    const sortedFemales = [...femalePlayers].sort(
      (a, b) => b.average - a.average
    );

    let teamIndex = 0;
    let direction = 1; // 1: 순방향, -1: 역방향

    for (let i = 0; i < sortedFemales.length; i++) {
      const female = sortedFemales[i];

      // 팀에 여성 선수 배치
      teams[teamIndex].players.push(female);
      teams[teamIndex].total_average += female.average;

      // 다음 팀 인덱스 계산 (스네이크 패턴)
      teamIndex += direction;

      // 경계에서 방향 전환
      if (teamIndex >= team_count) {
        teamIndex = team_count - 1;
        direction = -1;
      } else if (teamIndex < 0) {
        teamIndex = 0;
        direction = 1;
      }
    }
  };

  // 남성 선수들을 남은 빈자리에 최적화된 방식으로 배치
  const distributeMalePlayersToEmptySlots = (
    teams,
    malePlayers,
    team_count,
    team_size
  ) => {
    if (malePlayers.length === 0) return;

    // 남성 선수들을 에버 순으로 정렬 (내림차순)
    const sortedMales = [...malePlayers].sort((a, b) => b.average - a.average);

    for (let i = 0; i < sortedMales.length; i++) {
      const male = sortedMales[i];

      // 현재 가장 낮은 총점을 가진 팀 찾기
      let lowestTeamIndex = 0;
      let lowestTotal = teams[0].total_average;

      for (let j = 0; j < team_count; j++) {
        if (
          teams[j].players.length < team_size &&
          teams[j].total_average < lowestTotal
        ) {
          lowestTotal = teams[j].total_average;
          lowestTeamIndex = j;
        }
      }

      // 가장 낮은 팀에 남성 선수 배치
      teams[lowestTeamIndex].players.push(male);
      teams[lowestTeamIndex].total_average += male.average;
    }
  };

  // 팀 간 선수 스위칭 시도 (새로운 규칙)
  const tryTeamSwap = (team1, team2, teams, teamConfig) => {
    const team1Index = teams.findIndex(
      (t) => t.team_number === team1.teamNumber
    );
    const team2Index = teams.findIndex(
      (t) => t.team_number === team2.teamNumber
    );

    if (team1Index === -1 || team2Index === -1) return null;

    const team1Players = teams[team1Index].players;
    const team2Players = teams[team2Index].players;

    let bestSwap = null;
    let bestImprovement = 0;

    // 모든 선수 조합 시도
    for (let i = 0; i < team1Players.length; i++) {
      for (let j = 0; j < team2Players.length; j++) {
        const player1 = team1Players[i];
        const player2 = team2Players[j];

        // 5번 규칙: 여성회원은 여성회원끼리만 바꿀 수 있음
        if (player1.gender !== player2.gender) {
          continue;
        }

        // 여성 균등 분배 체크 시 성비 확인 (기본 적용)
        const team1FemaleCount = team1Players.filter(
          (p) => p.gender === '여'
        ).length;
        const team2FemaleCount = team2Players.filter(
          (p) => p.gender === '여'
        ).length;

        // 스위칭 후 성비 변화 계산
        const newTeam1FemaleCount =
          team1FemaleCount -
          (player1.gender === '여' ? 1 : 0) +
          (player2.gender === '여' ? 1 : 0);
        const newTeam2FemaleCount =
          team2FemaleCount -
          (player2.gender === '여' ? 1 : 0) +
          (player1.gender === '여' ? 1 : 0);

        // 1번 규칙: 여성 회원 차이가 2명 이상 나면 안 됨
        if (Math.abs(newTeam1FemaleCount - newTeam2FemaleCount) > 1) {
          continue;
        }

        // 스위칭 후 점수 차이 계산
        const currentDiff = Math.abs(team1.totalAverage - team2.totalAverage);
        const newTeam1Total =
          team1.totalAverage - player1.average + player2.average;
        const newTeam2Total =
          team2.totalAverage - player2.average + player1.average;
        const newDiff = Math.abs(newTeam1Total - newTeam2Total);

        const improvement = currentDiff - newDiff;

        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestSwap = {
            team1Index,
            team2Index,
            player1: { ...player1, originalIndex: i },
            player2: { ...player2, originalIndex: j },
            improvement,
          };
        }
      }
    }

    return bestSwap;
  };

  // 팀 간 선수 스위칭 실행
  const executeTeamSwap = (swapData, teams) => {
    const { team1Index, team2Index, player1, player2 } = swapData.result;

    // 팀1에서 player1 제거하고 player2 추가
    teams[team1Index].players = teams[team1Index].players.filter(
      (p, index) => index !== player1.originalIndex
    );
    teams[team1Index].players.push(player2);
    teams[team1Index].total_average = teams[team1Index].players.reduce(
      (sum, p) => sum + p.average,
      0
    );
    teams[team1Index].average_per_player =
      teams[team1Index].total_average / teams[team1Index].players.length;

    // 팀2에서 player2 제거하고 player1 추가
    teams[team2Index].players = teams[team2Index].players.filter(
      (p, index) => index !== player2.originalIndex
    );
    teams[team2Index].players.push(player1);
    teams[team2Index].total_average = teams[team2Index].players.reduce(
      (sum, p) => sum + p.average,
      0
    );
    teams[team2Index].average_per_player =
      teams[team2Index].total_average / teams[team2Index].players.length;
  };

  // 3팀 스위칭 (4번 규칙: 같은 선수끼리 바꾸는 경우)
  const tryThreeTeamSwap = (teams, teamConfig) => {
    const teamStats = teams.map((team) => ({
      teamNumber: team.team_number,
      totalAverage: team.total_average,
      averagePerPlayer: team.average_per_player,
      playerCount: team.players.length,
      players: team.players,
    }));

    // 팀별 총점 정렬 (내림차순)
    teamStats.sort((a, b) => b.totalAverage - a.totalAverage);

    const highTeam = teamStats[0];
    const lowTeam = teamStats[teamStats.length - 1];
    const middleTeam = teamStats[1];

    // 최고점 팀의 하위 선수와 최저점 팀의 하위 선수 찾기
    const highTeamLowestPlayer = highTeam.players.reduce((lowest, player) =>
      player.average < lowest.average ? player : lowest
    );
    const lowTeamLowestPlayer = lowTeam.players.reduce((lowest, player) =>
      player.average < lowest.average ? player : lowest
    );

    // 중간 팀의 하위 선수 찾기
    const middleTeamLowestPlayer = middleTeam.players.reduce((lowest, player) =>
      player.average < lowest.average ? player : lowest
    );

    // 3팀 스위칭 시도: 최고점팀 하위 ↔ 중간팀 하위, 중간팀 하위 ↔ 최저점팀 하위
    const highTeamIndex = teams.findIndex(
      (t) => t.team_number === highTeam.teamNumber
    );
    const middleTeamIndex = teams.findIndex(
      (t) => t.team_number === middleTeam.teamNumber
    );
    const lowTeamIndex = teams.findIndex(
      (t) => t.team_number === lowTeam.teamNumber
    );

    // 1차 스위칭: 최고점팀 하위 ↔ 중간팀 하위
    const firstSwapImprovement = calculateThreeTeamSwapImprovement(
      highTeam,
      middleTeam,
      highTeamLowestPlayer,
      middleTeamLowestPlayer
    );

    // 2차 스위칭: 중간팀 하위 ↔ 최저점팀 하위
    const secondSwapImprovement = calculateThreeTeamSwapImprovement(
      middleTeam,
      lowTeam,
      middleTeamLowestPlayer,
      lowTeamLowestPlayer
    );

    if (
      firstSwapImprovement > 0 &&
      firstSwapImprovement > secondSwapImprovement
    ) {
      // 1차 스위칭 실행
      executeThreeTeamSwap(
        teams,
        highTeamIndex,
        middleTeamIndex,
        highTeamLowestPlayer,
        middleTeamLowestPlayer
      );
      return true;
    } else if (secondSwapImprovement > 0) {
      // 2차 스위칭 실행
      executeThreeTeamSwap(
        teams,
        middleTeamIndex,
        lowTeamIndex,
        middleTeamLowestPlayer,
        lowTeamLowestPlayer
      );
      return true;
    }

    return false;
  };

  // 3팀 스위칭 개선도 계산
  const calculateThreeTeamSwapImprovement = (
    team1,
    team2,
    player1,
    player2
  ) => {
    const currentDiff = Math.abs(team1.totalAverage - team2.totalAverage);
    const newTeam1Total =
      team1.totalAverage - player1.average + player2.average;
    const newTeam2Total =
      team2.totalAverage - player2.average + player1.average;
    const newDiff = Math.abs(newTeam1Total - newTeam2Total);

    return currentDiff - newDiff;
  };

  // 3팀 스위칭 실행
  const executeThreeTeamSwap = (
    teams,
    team1Index,
    team2Index,
    player1,
    player2
  ) => {
    // 팀1에서 player1 제거하고 player2 추가
    teams[team1Index].players = teams[team1Index].players.filter(
      (p) => !(p.name === player1.name && p.average === player1.average)
    );
    teams[team1Index].players.push(player2);
    teams[team1Index].total_average = teams[team1Index].players.reduce(
      (sum, p) => sum + p.average,
      0
    );
    teams[team1Index].average_per_player =
      teams[team1Index].total_average / teams[team1Index].players.length;

    // 팀2에서 player2 제거하고 player1 추가
    teams[team2Index].players = teams[team2Index].players.filter(
      (p) => !(p.name === player2.name && p.average === player2.average)
    );
    teams[team2Index].players.push(player1);
    teams[team2Index].total_average = teams[team2Index].players.reduce(
      (sum, p) => sum + p.average,
      0
    );
    teams[team2Index].average_per_player =
      teams[team2Index].total_average / teams[team2Index].players.length;
  };

  // 전체 최적화 시도 (모든 선수 조합 검토)
  const tryGlobalOptimization = (teams, teamConfig) => {
    const teamStats = teams.map((team) => ({
      teamNumber: team.team_number,
      totalAverage: team.total_average,
      averagePerPlayer: team.average_per_player,
      playerCount: team.players.length,
      players: team.players,
    }));

    // 현재 최대 차이 계산
    const currentMaxDiff =
      Math.max(...teamStats.map((t) => t.totalAverage)) -
      Math.min(...teamStats.map((t) => t.totalAverage));

    let bestSwap = null;
    let bestImprovement = 0;

    // 모든 팀 조합에서 모든 선수 조합 시도
    for (let i = 0; i < teamStats.length - 1; i++) {
      for (let j = i + 1; j < teamStats.length; j++) {
        const team1 = teamStats[i];
        const team2 = teamStats[j];

        const team1Index = teams.findIndex(
          (t) => t.team_number === team1.teamNumber
        );
        const team2Index = teams.findIndex(
          (t) => t.team_number === team2.teamNumber
        );

        // 모든 선수 조합 시도
        for (let k = 0; k < team1.players.length; k++) {
          for (let l = 0; l < team2.players.length; l++) {
            const player1 = team1.players[k];
            const player2 = team2.players[l];

            // 여성 균등 분배 체크 시 성비 확인
            if (teamConfig.balanceByGender) {
              // 5번 규칙: 여성회원은 여성회원끼리만 바꿀 수 있음
              if (player1.gender !== player2.gender) {
                continue;
              }

              const team1FemaleCount = team1.players.filter(
                (p) => p.gender === '여'
              ).length;
              const team2FemaleCount = team2.players.filter(
                (p) => p.gender === '여'
              ).length;

              // 스위칭 후 성비 변화 계산
              const newTeam1FemaleCount =
                team1FemaleCount -
                (player1.gender === '여' ? 1 : 0) +
                (player2.gender === '여' ? 1 : 0);
              const newTeam2FemaleCount =
                team2FemaleCount -
                (player2.gender === '여' ? 1 : 0) +
                (player1.gender === '여' ? 1 : 0);

              // 1번 규칙: 여성 회원 차이가 2명 이상 나면 안 됨
              if (Math.abs(newTeam1FemaleCount - newTeam2FemaleCount) > 1) {
                continue;
              }
            }

            // 스위칭 후 전체 최대 차이 계산
            const newTeam1Total =
              team1.totalAverage - player1.average + player2.average;
            const newTeam2Total =
              team2.totalAverage - player2.average + player1.average;

            // 새로운 팀 점수 배열 생성
            const newTeamTotals = teamStats.map((team, index) => {
              if (index === i) return newTeam1Total;
              if (index === j) return newTeam2Total;
              return team.totalAverage;
            });

            const newMaxDiff =
              Math.max(...newTeamTotals) - Math.min(...newTeamTotals);
            const improvement = currentMaxDiff - newMaxDiff;

            if (improvement > bestImprovement) {
              bestImprovement = improvement;
              bestSwap = {
                team1Index,
                team2Index,
                player1: { ...player1, originalIndex: k },
                player2: { ...player2, originalIndex: l },
                improvement,
              };
            }
          }
        }
      }
    }

    // 최적의 스위칭 실행
    if (bestSwap && bestImprovement > 0) {
      executeGlobalSwap(teams, bestSwap);
      return true;
    }

    return false;
  };

  // 전체 최적화 스위칭 실행
  const executeGlobalSwap = (teams, swapData) => {
    const { team1Index, team2Index, player1, player2 } = swapData;

    // 팀1에서 player1 제거하고 player2 추가
    teams[team1Index].players = teams[team1Index].players.filter(
      (p, index) => index !== player1.originalIndex
    );
    teams[team1Index].players.push(player2);
    teams[team1Index].total_average = teams[team1Index].players.reduce(
      (sum, p) => sum + p.average,
      0
    );
    teams[team1Index].average_per_player =
      teams[team1Index].total_average / teams[team1Index].players.length;

    // 팀2에서 player2 제거하고 player1 추가
    teams[team2Index].players = teams[team2Index].players.filter(
      (p, index) => index !== player2.originalIndex
    );
    teams[team2Index].players.push(player1);
    teams[team2Index].total_average = teams[team2Index].players.reduce(
      (sum, p) => sum + p.average,
      0
    );
    teams[team2Index].average_per_player =
      teams[team2Index].total_average / teams[team2Index].players.length;
  };

  // 개선된 점수 밸런싱 함수
  // eslint-disable-next-line no-unused-vars
  const balanceTeamsByScore = async (teamsToBalance) => {
    if (teamsToBalance.length < 2) return teamsToBalance;

    const teams = [...teamsToBalance];
    let bestTeams = [...teams];
    let bestMaxDiff = Number.MAX_SAFE_INTEGER;

    // 1시드 선수들 식별 (변경 불가)
    const seedPlayers = new Set();
    teams.forEach((team) => {
      if (team.players.length > 0) {
        const firstPlayer = team.players[0];
        seedPlayers.add(
          `${firstPlayer.name}-${firstPlayer.average}-${firstPlayer.gender}`
        );
      }
    });

    // 밸런싱 시도 (최대 2000회로 증가)
    let attempt = 0;
    const maxAttempts = 2000;

    while (attempt < maxAttempts) {
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
        bestTeams = JSON.parse(JSON.stringify(teams));
      }

      // 목표 달성 시 종료 (8점 이하로 설정)
      if (currentMaxDiff <= 8) {
        break;
      }

      // 모든 팀 조합에서 스위칭 시도 (더 적극적인 밸런싱)
      let bestTeamSwap = null;
      let bestTeamImprovement = 0;

      for (let i = 0; i < teamStats.length - 1; i++) {
        for (let j = i + 1; j < teamStats.length; j++) {
          const team1 = teamStats[i];
          const team2 = teamStats[j];

          // 두 팀 간의 스위칭 시도

          // 스위칭 시도
          const swapResult = tryTeamSwap(team1, team2, teams, teamConfig);
          if (swapResult && swapResult.improvement > bestTeamImprovement) {
            bestTeamImprovement = swapResult.improvement;
            bestTeamSwap = { team1: team1, team2: team2, result: swapResult };
          }
        }
      }

      if (bestTeamSwap) {
        // 최적의 스위칭 실행
        executeTeamSwap(bestTeamSwap, teams);
        continue;
      }

      // 3팀 스위칭 시도 (4번 규칙)
      if (tryThreeTeamSwap(teams, teamConfig)) {
        continue;
      }

      // 전체 최적화 시도 (모든 선수 조합 검토)
      if (tryGlobalOptimization(teams, teamConfig)) {
        continue;
      }

      // 기존 방식도 시도 (최고점 팀과 최저점 팀)
      const highTeam = teamStats[0];
      const lowTeam = teamStats[teamStats.length - 1];

      let bestSwap = null;
      let bestImprovement = 0;

      // 모든 선수 필터링 (1시드 제외) - 성별 상관없이 모든 선수 시도
      const highTeamAllPlayers = highTeam.players.filter(
        (p) => !seedPlayers.has(`${p.name}-${p.average}-${p.gender}`)
      );
      const lowTeamAllPlayers = lowTeam.players.filter(
        (p) => !seedPlayers.has(`${p.name}-${p.average}-${p.gender}`)
      );

      // 에버 낮은 선수부터 스위칭 시도
      const sortedHighPlayers = highTeamAllPlayers.sort(
        (a, b) => a.average - b.average
      );
      const sortedLowPlayers = lowTeamAllPlayers.sort(
        (a, b) => a.average - b.average
      );

      for (const highPlayer of sortedHighPlayers) {
        for (const lowPlayer of sortedLowPlayers) {
          // 여성 인원 균등성 유지 확인 (완화된 조건)
          const highTeamFemaleCount = highTeam.players.filter(
            (p) => p.gender === '여'
          ).length;
          const lowTeamFemaleCount = lowTeam.players.filter(
            (p) => p.gender === '여'
          ).length;

          // 여성 균등 분배 체크박스 상태에 따른 처리
          // 여성 균등 분배는 기본 적용 (차이 1명까지 허용)
          const maxFemaleDiff = 1;
          if (
            Math.abs(highTeamFemaleCount - lowTeamFemaleCount) > maxFemaleDiff
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
        const highTeamIndex = teams.findIndex(
          (t) => t.team_number === bestSwap.player1.sourceTeam
        );
        const lowTeamIndex = teams.findIndex(
          (t) => t.team_number === bestSwap.player2.sourceTeam
        );

        if (highTeamIndex !== -1 && lowTeamIndex !== -1) {
          // 팀 1에서 player1 제거하고 player2 추가
          teams[highTeamIndex].players = teams[highTeamIndex].players.filter(
            (p) =>
              !(
                p.name === bestSwap.player1.name &&
                p.average === bestSwap.player1.average
              )
          );
          teams[highTeamIndex].players.push(bestSwap.player2);
          teams[highTeamIndex].total_average = teams[
            highTeamIndex
          ].players.reduce((sum, p) => sum + p.average, 0);
          teams[highTeamIndex].average_per_player =
            teams[highTeamIndex].total_average /
            teams[highTeamIndex].players.length;

          // 팀 2에서 player2 제거하고 player1 추가
          teams[lowTeamIndex].players = teams[lowTeamIndex].players.filter(
            (p) =>
              !(
                p.name === bestSwap.player2.name &&
                p.average === bestSwap.player2.average
              )
          );
          teams[lowTeamIndex].players.push(bestSwap.player1);
          teams[lowTeamIndex].total_average = teams[
            lowTeamIndex
          ].players.reduce((sum, p) => sum + p.average, 0);
          teams[lowTeamIndex].average_per_player =
            teams[lowTeamIndex].total_average /
            teams[lowTeamIndex].players.length;

          // 팀당 인원 수 검증
          const { team_size } = teamConfig;
          if (
            teams[highTeamIndex].players.length !== team_size ||
            teams[lowTeamIndex].players.length !== team_size
          ) {
            console.error('팀 인원 수 불일치 발생:', {
              team1: teams[highTeamIndex].players.length,
              team2: teams[lowTeamIndex].players.length,
              expected: team_size,
            });
          }
        }
      } else {
        break; // 더 이상 개선할 수 없으면 종료
      }
    }

    return bestTeams;
  };

  // 새로운 규칙에 따른 밸런싱 함수
  const balanceTeamsWithNewRules = async (teamsToBalance) => {
    if (teamsToBalance.length < 2) return teamsToBalance;

    const teams = [...teamsToBalance];
    let bestTeams = [...teams];
    let bestMaxDiff = Number.MAX_SAFE_INTEGER;

    // 무한 루프 방지를 위한 변수들
    let noImprovementCount = 0;
    const maxNoImprovement = 50; // 50번 연속 개선 없으면 다른 방법 시도
    let lastSwapHash = '';
    let sameSwapCount = 0;
    const maxSameSwap = 10; // 같은 교체를 10번 반복하면 강제로 다른 방법 시도

    // 3단계: 총합 에버가 제일 낮은 팀과 가장 높은 팀의 선수를 교체
    // 4단계: 3번을 계속 반복 (2000회 시도)
    let attempt = 0;
    const maxAttempts = 2000;

    while (attempt < maxAttempts) {
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

      // 복합 목표 함수 계산 (최대 차이 + 분산 고려)
      const currentMaxDiff =
        teamStats[0].totalAverage -
        teamStats[teamStats.length - 1].totalAverage;

      // 분산 계산
      const teamAverages = teamStats.map((team) => team.totalAverage);
      const mean =
        teamAverages.reduce((sum, avg) => sum + avg, 0) / teamAverages.length;
      const variance =
        teamAverages.reduce((sum, avg) => sum + Math.pow(avg - mean, 2), 0) /
        teamAverages.length;
      const standardDeviation = Math.sqrt(variance);

      // 복합 점수 (최대 차이 + 분산의 10%)
      const compositeScore = currentMaxDiff + standardDeviation * 0.1;

      // 현재 결과가 최적이면 저장
      if (compositeScore < bestMaxDiff) {
        bestMaxDiff = compositeScore;
        bestTeams = JSON.parse(JSON.stringify(teams));
        noImprovementCount = 0; // 개선이 있었으므로 카운터 리셋
        console.log(
          `🎯 새로운 최적해 발견! 최대 차이: ${currentMaxDiff}점, 표준편차: ${standardDeviation.toFixed(
            2
          )}점, 복합점수: ${compositeScore.toFixed(2)}점`
        );
      } else {
        noImprovementCount++;
      }

      // 4번 규칙: 5점 이내 달성 시 계속 진행 (2000번 모두 시도)
      if (currentMaxDiff <= 5) {
        // 최적 결과 찾았으나 계속 시도
      }

      // 무한 루프 방지: 개선이 없으면 다른 방법 시도
      if (noImprovementCount >= maxNoImprovement) {
        noImprovementCount = 0;

        // 강제로 랜덤한 팀 조합에서 교체 시도
        if (tryRandomTeamSwap(teams)) {
          continue;
        }

        // 그래도 안 되면 강제로 선수 셔플
        if (tryForcedShuffle(teams)) {
          continue;
        }

        // 마지막 수단: 현재까지의 최적해로 복원
        Object.assign(teams, bestTeams);
        break;
      }

      // 3단계: 총합 에버가 제일 낮은 팀과 가장 높은 팀의 선수를 교체
      const highTeam = teamStats[0];
      const lowTeam = teamStats[teamStats.length - 1];

      // 모든 팀 쌍에서 교체 시도 (강화된 교체 전략)
      let bestSwapFound = false;
      let bestSwap = null;
      let bestImprovement = 0;

      // 모든 팀 조합에서 최적의 교체 찾기
      for (let i = 0; i < teamStats.length - 1; i++) {
        for (let j = i + 1; j < teamStats.length; j++) {
          const team1 = teamStats[i];
          const team2 = teamStats[j];

          const swapResult = tryGenderSpecificSwap(team1, team2, teams);
          if (swapResult) {
            const improvement = calculateSwapImprovement(
              team1,
              team2,
              swapResult.player1,
              swapResult.player2
            );
            if (improvement > bestImprovement) {
              bestImprovement = improvement;
              bestSwap = { team1, team2, swapResult };
              bestSwapFound = true;
            }
          }
        }
      }

      if (bestSwapFound) {
        // 중복 교체 방지: 같은 교체인지 확인
        const currentSwapHash = `${bestSwap.swapResult.player1.name}-${bestSwap.swapResult.player2.name}`;
        if (currentSwapHash === lastSwapHash) {
          sameSwapCount++;
          if (sameSwapCount >= maxSameSwap) {
            console.log(
              `⚠️ 같은 교체를 ${maxSameSwap}번 반복. 다른 방법 시도...`
            );
            sameSwapCount = 0;
            lastSwapHash = '';

            // 다른 팀 조합으로 교체 시도
            if (tryAlternativeSwap(teams, highTeam, lowTeam)) {
              continue;
            }

            // 고급 스위칭 시도
            if (tryAdvancedSwap(teams)) {
              continue;
            }

            // 더 이상 개선할 수 없으면 종료
            break;
          }
        } else {
          sameSwapCount = 0;
          lastSwapHash = currentSwapHash;
        }

        executeGenderSpecificSwap(teams, bestSwap.swapResult);
        continue;
      }

      // 5번 규칙: 똑같은 회원끼리의 교체가 반복되면, 그 팀의 다음으로 차이가 적게 나는 회원이나, 다른 팀에서 근소한 차이나는 사람이랑 교체
      if (tryAlternativeSwap(teams, highTeam, lowTeam)) {
        continue;
      }

      // 7번 규칙: 6번보다 더 좋은 방법이 있다면 시도해도 좋다
      if (tryAdvancedSwap(teams)) {
        continue;
      }

      // 2000회 시도 완료 시 최적 결과 반환
      if (attempt >= maxAttempts) {
        break;
      }

      // 더 이상 개선할 수 없으면 종료
      break;
    }

    // 최종 결과 반환 전 여성 회원 분포 검증
    // 전체 선수 정보 추출
    const allPlayers = bestTeams.flatMap((team) => team.players);
    const validation = validateFemaleDistribution(bestTeams, allPlayers);

    if (!validation.isValid) {
      // 검증 실패 시 원본 팀 구성 반환 (밸런싱 전 상태)
      console.warn(
        '⚠️ 밸런싱 후 여성 회원 분포가 깨졌습니다. 원본 팀 구성 유지.'
      );
      return teamsToBalance;
    }

    return bestTeams;
  };

  // 기존 팀 상태에서 추가 밸런싱하는 함수
  const rebalanceExistingTeams = async (existingTeams) => {
    // 기존 팀 데이터를 복사
    const teams = JSON.parse(JSON.stringify(existingTeams));

    // 팀별 총점과 평균 재계산
    teams.forEach((team) => {
      team.total_average = team.players.reduce(
        (sum, player) => sum + player.average,
        0
      );
      team.average_per_player = team.total_average / team.players.length;
    });

    // 밸런싱 전 상태 저장 (비교용)
    const beforeTeams = JSON.parse(JSON.stringify(teams));

    // 1단계: 다중 시작으로 공격적인 밸런싱 시도 (최적 해 선택)
    const restarts = 10;
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let r = 0; r < restarts; r++) {
      // 각 재시도마다 약간의 무작위 셔플로 시작 다양화
      const seedTeams = JSON.parse(JSON.stringify(teams));
      seedTeams.forEach((t) => t.players.sort(() => Math.random() - 0.5));
      const candidate = await aggressiveRebalance(seedTeams, {
        timeLimitMs: 1400,
      });
      const totals = candidate.map((t) =>
        t.players.reduce((s, p) => s + p.average, 0)
      );
      const maxDiff = Math.max(...totals) - Math.min(...totals);
      const mean = totals.reduce((s, v) => s + v, 0) / totals.length;
      const variance =
        totals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / totals.length;
      const stdev = Math.sqrt(variance);
      const composite = maxDiff + stdev * 0.2; // 최대차 우선 + 분산 가중(강화)
      if (composite < bestScore) {
        bestScore = composite;
        best = candidate;
        // 조기 종료: 최대 차이 0 달성 시 즉시 채택
        if (maxDiff === 0) {
          break;
        }
      }
    }

    // 2단계: 기존 밸런싱 로직으로 추가 최적화
    await balanceTeamsWithNewRules(best);
    return best; // 수정된 teams 배열 반환
  };

  // 공격적인 밸런싱 함수 (더 정밀한 최적화)
  const aggressiveRebalance = async (teams, options = {}) => {
    const teamsCopy = JSON.parse(JSON.stringify(teams));

    // 목적함수: 최대 차이 + 표준편차 가중
    const computeTotals = (ts) =>
      ts.map((t) => t.players.reduce((s, p) => s + p.average, 0));
    const scoreOfTotals = (totals) => {
      const maxDiff = Math.max(...totals) - Math.min(...totals);
      const mean = totals.reduce((s, v) => s + v, 0) / totals.length;
      const variance =
        totals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / totals.length;
      const stdev = Math.sqrt(variance);
      return maxDiff + stdev * 0.1; // 복합 점수(낮을수록 좋음)
    };

    // 성비 제약: 팀당 여성 수를 균등(floor/ceil) 유지
    const totalFemales = teamsCopy
      .map((t) => t.players.filter((p) => p.gender === '여').length)
      .reduce((a, b) => a + b, 0);
    const teamCount = teamsCopy.length || 1;
    const minFemales = Math.floor(totalFemales / teamCount);
    const maxFemales = Math.ceil(totalFemales / teamCount);
    const getFemaleCount = (team) =>
      team.players.filter((p) => p.gender === '여').length;

    // 성비 편차 함수 (범위 내면 0, 벗어나면 거리)
    const deviation = (cnt) =>
      cnt < minFemales
        ? minFemales - cnt
        : cnt > maxFemales
        ? cnt - maxFemales
        : 0;

    // 0단계: 성비 사전 균등화 (초기 상태가 깨져 있어도 탐색 시작 가능하게)
    // surplus팀(여초과) ↔ deficit팀(여부족) 간 여↔남 교체를 우선 수행
    for (let iter = 0; iter < 100; iter++) {
      let surplusIndex = -1;
      let deficitIndex = -1;
      let maxSurplus = 0;
      let maxDeficit = 0;

      teamsCopy.forEach((t, idx) => {
        const f = getFemaleCount(t);
        const over = Math.max(0, f - maxFemales);
        const under = Math.max(0, minFemales - f);
        if (over > maxSurplus) {
          maxSurplus = over;
          surplusIndex = idx;
        }
        if (under > maxDeficit) {
          maxDeficit = under;
          deficitIndex = idx;
        }
      });

      if (maxSurplus === 0 && maxDeficit === 0) break; // 모두 범위 내
      if (surplusIndex === -1 || deficitIndex === -1) break; // 교정 불가

      const surplusTeam = teamsCopy[surplusIndex];
      const deficitTeam = teamsCopy[deficitIndex];

      const female = surplusTeam.players.find((p) => p.gender === '여');
      const male = deficitTeam.players.find((p) => p.gender !== '여');
      if (!female || !male) break;

      // 점수 영향 최소화를 위해 간단 교체 적용
      surplusTeam.players = surplusTeam.players.map((p) =>
        p === female ? male : p
      );
      deficitTeam.players = deficitTeam.players.map((p) =>
        p === male ? female : p
      );

      // 총합 갱신
      surplusTeam.total_average = surplusTeam.players.reduce(
        (s, p) => s + p.average,
        0
      );
      deficitTeam.total_average = deficitTeam.players.reduce(
        (s, p) => s + p.average,
        0
      );
    }

    // 초기 점수
    teamsCopy.forEach(
      (t) => (t.total_average = t.players.reduce((s, p) => s + p.average, 0))
    );
    let totals = computeTotals(teamsCopy);
    let bestTeams = JSON.parse(JSON.stringify(teamsCopy));
    let bestScore = scoreOfTotals(totals);

    // 어닐링 파라미터
    const timeLimitMs = Math.max(500, options.timeLimitMs || 2500); // 탐색 시간 제한(기본 상향)
    const start = Date.now();
    let temperature = 5 + bestScore * 0.02; // 초기 온도
    const cooling = 0.997; // 더 천천히 냉각하여 탐색 심화
    // 현재 점수(수용 기준)
    let currentScore = bestScore;

    // 빠른 후보 추출: 팀 쌍을 라운드로빈, 같은 성별만 교체
    while (Date.now() - start < timeLimitMs) {
      let improved = false;

      for (let i = 0; i < teamsCopy.length; i++) {
        for (let j = i + 1; j < teamsCopy.length; j++) {
          const team1 = teamsCopy[i];
          const team2 = teamsCopy[j];

          // 무작위 소수 후보 선택(로컬 검색 가속)
          const candidates1 = team1.players
            .slice()
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.min(7, team1.players.length));
          const candidates2 = team2.players
            .slice()
            .sort(() => Math.random() - 0.5)
            .slice(0, Math.min(7, team2.players.length));

          let localBest = null;
          let localBestDelta = 0;

          for (const p1 of candidates1) {
            for (const p2 of candidates2) {
              // 성비 제약 검사: 교체 후 여성 수가 [minFemales, maxFemales] 내인지 확인
              const t1Fem = getFemaleCount(team1);
              const t2Fem = getFemaleCount(team2);
              let t1FemNew = t1Fem;
              let t2FemNew = t2Fem;
              if (p1.gender === '여' && p2.gender !== '여') {
                t1FemNew -= 1;
                t2FemNew += 1;
              } else if (p1.gender !== '여' && p2.gender === '여') {
                t1FemNew += 1;
                t2FemNew -= 1;
              }
              // 성비 제약: 범위 내 유지가 아니라, 편차 합이 감소/유지되면 허용 (불가피한 교정 경로 허용)
              const devBefore = deviation(t1Fem) + deviation(t2Fem);
              const devAfter = deviation(t1FemNew) + deviation(t2FemNew);
              if (devAfter > devBefore) {
                continue; // 성비 편차가 악화되면 제외
              }

              const t1New = team1.total_average - p1.average + p2.average;
              const t2New = team2.total_average - p2.average + p1.average;
              const newTotals = totals.slice();
              newTotals[i] = t1New;
              newTotals[j] = t2New;
              const newScore = scoreOfTotals(newTotals);
              const delta = currentScore - newScore; // 현재 기준 개선도

              if (delta > localBestDelta) {
                localBestDelta = delta;
                localBest = { i, j, p1, p2, t1New, t2New, newTotals, newScore };
              }
            }
          }

          // 로컬 최적 스왑 시도 (어닐링 허용 포함)
          if (localBest) {
            const shouldAccept =
              localBestDelta > 0 ||
              Math.exp(localBestDelta / Math.max(temperature, 1e-6)) >
                Math.random();
            if (shouldAccept) {
              // 실제 교체 적용
              team1.players = team1.players.map((p) =>
                p === localBest.p1 ? localBest.p2 : p
              );
              team2.players = team2.players.map((p) =>
                p === localBest.p2 ? localBest.p1 : p
              );
              team1.total_average = localBest.t1New;
              team2.total_average = localBest.t2New;
              totals = localBest.newTotals;

              const acceptedScore = localBest.newScore;
              currentScore = acceptedScore; // 현재 상태 갱신
              if (acceptedScore < bestScore) {
                bestScore = acceptedScore;
                bestTeams = JSON.parse(JSON.stringify(teamsCopy));
                // 조기 종료: 현 상태에서 최대 차이 0이라면 반환
                const currentTotals = totals;
                const currentMaxDiff =
                  Math.max(...currentTotals) - Math.min(...currentTotals);
                if (currentMaxDiff === 0) {
                  bestTeams.forEach((team) => {
                    team.total_average = team.players.reduce(
                      (sum, p) => sum + p.average,
                      0
                    );
                    team.average_per_player =
                      team.total_average / team.players.length;
                  });
                  return bestTeams;
                }
              }
              improved = improved || localBestDelta > 0;
            }
          }

          if (Date.now() - start >= timeLimitMs) break;
        }
        if (Date.now() - start >= timeLimitMs) break;
      }

      // 냉각
      temperature *= cooling;
      if (!improved && temperature < 0.1) break; // 수렴
    }

    // 평균 재계산
    bestTeams.forEach((team) => {
      team.total_average = team.players.reduce((sum, p) => sum + p.average, 0);
      team.average_per_player = team.total_average / team.players.length;
    });

    return bestTeams;
  };

  // 6번 규칙: 보조 스왑 탐색 (성비 편차가 악화되지 않는 한 허용)
  const tryGenderSpecificSwap = (highTeam, lowTeam, teams) => {
    // 성별 동일 제약 제거, 대신 성비 편차 악화 금지
    const getFemaleCount = (teamPlayers) =>
      teamPlayers.filter((p) => p.gender === '여').length;
    const teamsArr = teams;
    const highIndex = teamsArr.findIndex(
      (t) => t.team_number === highTeam.teamNumber
    );
    const lowIndex = teamsArr.findIndex(
      (t) => t.team_number === lowTeam.teamNumber
    );
    if (highIndex === -1 || lowIndex === -1) return null;

    const totalFemales = teamsArr.reduce(
      (acc, t) => acc + getFemaleCount(t.players),
      0
    );
    const teamCount = teamsArr.length || 1;
    const minFem = Math.floor(totalFemales / teamCount);
    const maxFem = Math.ceil(totalFemales / teamCount);
    const deviation = (cnt) =>
      cnt < minFem ? minFem - cnt : cnt > maxFem ? cnt - maxFem : 0;

    let bestSwap = null;
    let bestImprovement = 0;

    for (const p1 of highTeam.players) {
      for (const p2 of lowTeam.players) {
        // 교체 후 성비 체크: 편차 합이 줄거나 같으면 허용
        const highFem = getFemaleCount(highTeam.players);
        const lowFem = getFemaleCount(lowTeam.players);
        let highFemNew = highFem;
        let lowFemNew = lowFem;
        if (p1.gender === '여' && p2.gender !== '여') {
          highFemNew -= 1;
          lowFemNew += 1;
        } else if (p1.gender !== '여' && p2.gender === '여') {
          highFemNew += 1;
          lowFemNew -= 1;
        }
        const devBefore = deviation(highFem) + deviation(lowFem);
        const devAfter = deviation(highFemNew) + deviation(lowFemNew);
        if (devAfter > devBefore) continue;

        const improvement = calculateSwapImprovement(highTeam, lowTeam, p1, p2);
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestSwap = { player1: p1, player2: p2 };
        }
      }
    }

    return bestSwap;
  };

  // 스위칭 개선도 계산
  const calculateSwapImprovement = (
    highTeam,
    lowTeam,
    highPlayer,
    lowPlayer
  ) => {
    const currentDiff = Math.abs(highTeam.totalAverage - lowTeam.totalAverage);
    const newHighTotal =
      highTeam.totalAverage - highPlayer.average + lowPlayer.average;
    const newLowTotal =
      lowTeam.totalAverage - lowPlayer.average + highPlayer.average;
    const newDiff = Math.abs(newHighTotal - newLowTotal);

    return currentDiff - newDiff;
  };

  // 성별별 스위칭 실행
  const executeGenderSpecificSwap = (teams, swapData) => {
    const { player1, player2 } = swapData;

    const highTeamIndex = teams.findIndex((t) =>
      t.players.some(
        (p) => p.name === player1.name && p.average === player1.average
      )
    );
    const lowTeamIndex = teams.findIndex((t) =>
      t.players.some(
        (p) => p.name === player2.name && p.average === player2.average
      )
    );

    if (highTeamIndex !== -1 && lowTeamIndex !== -1) {
      // 팀1에서 player1 제거하고 player2 추가
      teams[highTeamIndex].players = teams[highTeamIndex].players.filter(
        (p) => !(p.name === player1.name && p.average === player1.average)
      );
      teams[highTeamIndex].players.push(player2);
      teams[highTeamIndex].total_average = teams[highTeamIndex].players.reduce(
        (sum, p) => sum + p.average,
        0
      );
      teams[highTeamIndex].average_per_player =
        teams[highTeamIndex].total_average /
        teams[highTeamIndex].players.length;

      // 팀2에서 player2 제거하고 player1 추가
      teams[lowTeamIndex].players = teams[lowTeamIndex].players.filter(
        (p) => !(p.name === player2.name && p.average === player2.average)
      );
      teams[lowTeamIndex].players.push(player1);
      teams[lowTeamIndex].total_average = teams[lowTeamIndex].players.reduce(
        (sum, p) => sum + p.average,
        0
      );
      teams[lowTeamIndex].average_per_player =
        teams[lowTeamIndex].total_average / teams[lowTeamIndex].players.length;
    }
  };

  // 5번 규칙: 대안 스위칭 (다른 팀과의 교체)
  const tryAlternativeSwap = (teams, highTeam, lowTeam) => {
    // 중간 팀과의 교체 시도
    const teamStats = teams.map((team) => ({
      teamNumber: team.team_number,
      totalAverage: team.total_average,
      players: team.players,
    }));

    const middleTeam = teamStats.find(
      (t) =>
        t.teamNumber !== highTeam.teamNumber &&
        t.teamNumber !== lowTeam.teamNumber
    );
    if (!middleTeam) return false;

    // highTeam ↔ middleTeam 교체 시도
    const swap1 = tryGenderSpecificSwap(highTeam, middleTeam, teams);
    if (swap1) {
      executeGenderSpecificSwap(teams, swap1);
      return true;
    }

    // lowTeam ↔ middleTeam 교체 시도
    const swap2 = tryGenderSpecificSwap(lowTeam, middleTeam, teams);
    if (swap2) {
      executeGenderSpecificSwap(teams, swap2);
      return true;
    }

    return false;
  };

  // 7번 규칙: 고급 스위칭 (3팀 이상의 복합 교체)
  const tryAdvancedSwap = (teams) => {
    // 모든 팀 조합에서 최적의 교체 찾기
    const teamStats = teams.map((team) => ({
      teamNumber: team.team_number,
      totalAverage: team.total_average,
      players: team.players,
    }));

    let bestSwap = null;
    let bestImprovement = 0;

    for (let i = 0; i < teamStats.length - 1; i++) {
      for (let j = i + 1; j < teamStats.length; j++) {
        const swap = tryGenderSpecificSwap(teamStats[i], teamStats[j], teams);
        if (swap) {
          const improvement = calculateSwapImprovement(
            teamStats[i],
            teamStats[j],
            swap.player1,
            swap.player2
          );
          if (improvement > bestImprovement) {
            bestImprovement = improvement;
            bestSwap = swap;
          }
        }
      }
    }

    if (bestSwap) {
      executeGenderSpecificSwap(teams, bestSwap);
      return true;
    }

    return false;
  };

  // 무한 루프 방지를 위한 랜덤 팀 교체
  const tryRandomTeamSwap = (teams) => {
    const teamStats = teams.map((team) => ({
      teamNumber: team.team_number,
      totalAverage: team.total_average,
      players: team.players,
    }));

    // 랜덤하게 두 팀 선택
    const team1Index = Math.floor(Math.random() * teamStats.length);
    let team2Index = Math.floor(Math.random() * teamStats.length);
    while (team2Index === team1Index) {
      team2Index = Math.floor(Math.random() * teamStats.length);
    }

    const team1 = teamStats[team1Index];
    const team2 = teamStats[team2Index];

    const swap = tryGenderSpecificSwap(team1, team2, teams);
    if (swap) {
      executeGenderSpecificSwap(teams, swap);
      return true;
    }

    return false;
  };

  // 강제 셔플 (극단적인 상황에서 사용)
  const tryForcedShuffle = (teams) => {
    // 모든 선수를 수집
    const allPlayers = [];
    teams.forEach((team) => {
      allPlayers.push(...team.players);
    });

    // 선수들을 랜덤하게 섞기
    for (let i = allPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
    }

    // 팀들을 초기화하고 다시 배치
    teams.forEach((team) => {
      team.players = [];
      team.total_average = 0;
    });

    // 스네이크 패턴으로 재배치
    let playerIndex = 0;
    let direction = 1;
    let currentTeam = 0;

    while (playerIndex < allPlayers.length) {
      if (teams[currentTeam].players.length >= teamConfig.team_size) {
        currentTeam = (currentTeam + 1) % teams.length;
        continue;
      }

      teams[currentTeam].players.push(allPlayers[playerIndex]);
      teams[currentTeam].total_average += allPlayers[playerIndex].average;
      playerIndex++;

      if (direction === 1) {
        if (currentTeam === teams.length - 1) {
          direction = -1;
        } else {
          currentTeam++;
        }
      } else {
        if (currentTeam === 0) {
          direction = 1;
        } else {
          currentTeam--;
        }
      }
    }

    // 평균 재계산
    teams.forEach((team) => {
      team.average_per_player = team.total_average / team.players.length;
    });

    return true;
  };

  // 자동 팀 밸런싱 함수 (사용하지 않음)
  // eslint-disable-next-line no-unused-vars
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

  // eslint-disable-next-line no-unused-vars
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
          <div className="section-header">
            <h3 className="section-title">선수 추가</h3>
            <div className="section-actions">
              <div className="action-menu-container" data-item-id="player-input-settings">
                <button
                  className="btn btn-icon-only players-settings-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlayerInputMenu(!showPlayerInputMenu);
                  }}
                  title="설정"
                >
                  <MoreVertical size={20} />
                </button>
                {showPlayerInputMenu && (
                  <div className="action-menu-dropdown">
                    <button
                      className="action-menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPlayerInputMenu(false);
                        handleOpenGuestModal();
                      }}
                    >
                      게스트 추가
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 회원 검색 */}
          <div className="search-section">
            <div className="search-input-row">
              <div className="search-group">
                <h4>회원 검색</h4>
                <div className="form-group">
                  <div className="search-input-group">
                    <input
                      type="text"
                      placeholder="회원 이름을 입력하세요"
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
                    <button
                      className="btn btn-icon-only search-icon-btn"
                      onClick={handleSearchAndAdd}
                      disabled={isLoading && loadingType === '회원 검색'}
                      title="검색"
                    >
                      {isLoading && loadingType === '회원 검색' ? (
                        <div className="loading-spinner"></div>
                      ) : (
                        <Search size={18} />
                      )}
                    </button>
                  </div>

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
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 검색 결과 - 검색 입력란 바로 아래 표시 */}
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
                      className="btn btn-secondary btn-sm btn-icon-only"
                      onClick={() => setSearchResults([])}
                      disabled={searchResults.length === 0 || isLoading}
                      title="목록 초기화"
                    >
                      <RotateCcw size={16} />
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
                      <div className="member-info">
                        <div className="member-name">
                          {member.name}
                          {member.gender && (
                            <span
                              className={`gender-badge ${
                                member.gender === '남'
                                  ? 'male'
                                  : member.gender === '여'
                                  ? 'female'
                                  : ''
                              }`}
                            >
                              {member.gender}
                            </span>
                          )}
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
                      <div className="search-result-actions">
                        {/* 추가 버튼 */}
                        <button
                          className="search-result-add-btn"
                          onClick={() => handleAddSingleMember(member)}
                          disabled={isLoading || isDuplicatePlayer(member.name)}
                          title={
                            isLoading && loadingType === '개별 추가'
                              ? '추가 중...'
                              : isDuplicatePlayer(member.name)
                              ? '이미 추가됨'
                              : '추가'
                          }
                        >
                          {isLoading && loadingType === '개별 추가' ? (
                            <div className="loading-spinner"></div>
                          ) : (
                            <Check size={18} />
                          )}
                        </button>
                        {/* 제거 버튼 */}
                        <button
                          className="player-delete-btn"
                          onClick={() => {
                            setSearchResults((prev) =>
                              prev.filter((result) => result.id !== member.id)
                            );
                          }}
                          title="검색 결과에서 제거"
                        >
                          ×
                        </button>
                      </div>
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
                      <div className="member-name">
                        {member.name}
                        {member.gender && (
                          <span
                            className={`gender-badge ${
                              member.gender === '남'
                                ? 'male'
                                : member.gender === '여'
                                ? 'female'
                                : ''
                            }`}
                          >
                            {member.gender}
                          </span>
                        )}
                      </div>
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
                className="btn btn-secondary btn-icon-only"
                onClick={clearSelectedMembers}
                disabled={selectedMembers.length === 0}
                title="선택 초기화"
              >
                <RotateCcw size={18} />
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
              <div
                className="action-menu-container"
                data-item-id="players-settings"
              >
                <button
                  className="btn btn-icon-only players-settings-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPlayersMenu(!showPlayersMenu);
                  }}
                  title="설정"
                >
                  <MoreVertical size={20} />
                </button>
                {showPlayersMenu && (
                  <div className="action-menu-dropdown">
                    <button
                      className="action-menu-item action-menu-item-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPlayersMenu(false);
                        handleClearPlayers();
                      }}
                      disabled={players.length === 0}
                    >
                      전체 삭제
                    </button>
                  </div>
                )}
              </div>
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
                      <div className="player-name">
                        {playerName}
                        {playerGender && (
                          <span
                            className={`gender-badge ${
                              playerGender === '남'
                                ? 'male'
                                : playerGender === '여'
                                ? 'female'
                                : ''
                            }`}
                          >
                            {playerGender}
                          </span>
                        )}
                      </div>
                      <div className="player-average">{playerAverage} 에버</div>
                    </div>
                    <button
                      className="player-delete-btn"
                      onClick={() => handleDeletePlayer(playerName)}
                      title="삭제"
                    >
                      ×
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
                disabled={
                  loading ||
                  isBalancing ||
                  players.length === 0 ||
                  !isTeamFormationPossible()
                }
              >
                {loading ? (
                  '팀 구성 중...'
                ) : isBalancing ? (
                  <>
                    <span className="loading-spinner"></span>
                    밸런싱 중...
                  </>
                ) : !isTeamFormationPossible() ? (
                  `인원 불일치 (${players.length}명 / ${
                    teamConfig.team_count * teamConfig.team_size
                  }명 필요)`
                ) : isTeamConfigured ? (
                  '밸런싱 개선'
                ) : (
                  '팀 구성하기'
                )}
              </button>
            </div>
          </div>

          {/* 팀 결과 */}
          {teams.length > 0 && (
            <div className="teams-result">
              {/* 현재 결과 */}
              <div className="current-result-section">
                <div className="teams-result-header">
                  <h4>현재 결과</h4>
                  <div className="team-config-actions">
                    <button
                      className="btn btn-icon-only save-icon-btn"
                      onClick={saveTeamConfig}
                      title={(() => {
                        const emptyIndex = savedTeamConfigs.findIndex(
                          (c) => c === null
                        );
                        const saveIndex =
                          emptyIndex !== -1
                            ? emptyIndex + 1
                            : savedTeamConfigs.length + 1;
                        return `현재 결과를 저장${saveIndex} 에 저장`;
                      })()}
                    >
                      <Save size={18} />
                    </button>
                  </div>
                </div>

                {/* 밸런싱 결과 메시지 */}
                {balancingResult && (
                  <div className="balancing-result-message">
                    {balancingResult}
                  </div>
                )}

                <div className="teams-grid">
                  {teams
                    .slice()
                    .sort((a, b) => a.team_number - b.team_number)
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
                                <span className="player-name">
                                  {player.name}
                                </span>
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

              {/* 저장된 결과들 */}
              {savedTeamConfigs.length > 0 && (
                <div className="saved-results-section">
                  <h4 className="saved-results-title">저장된 결과</h4>

                  {/* 저장된 결과 탭 */}
                  <div className="saved-configs-tabs">
                    {savedTeamConfigs.map((config, index) => {
                      if (config === null) {
                        return (
                          <button
                            key={`empty-${index}`}
                            className="tab-button empty-tab"
                            disabled
                          >
                            저장 {index + 1} (비어있음)
                          </button>
                        );
                      }
                      return (
                        <button
                          key={config.id}
                          className={`tab-button ${
                            selectedSavedConfigIndex === index ? 'active' : ''
                          }`}
                          onClick={() => setSelectedSavedConfigIndex(index)}
                        >
                          저장 {index + 1}
                        </button>
                      );
                    })}
                  </div>

                  {/* 선택된 저장된 결과 표시 */}
                  {savedTeamConfigs[selectedSavedConfigIndex] && (
                    <div className="saved-config-item">
                      <div className="saved-config-header">
                        <div className="saved-config-header-right">
                          <button
                            className="btn btn-icon-only delete-icon-btn"
                            onClick={() =>
                              deleteSavedTeamConfig(selectedSavedConfigIndex)
                            }
                            title="삭제"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="teams-grid">
                        {savedTeamConfigs[selectedSavedConfigIndex].teams
                          .slice()
                          .sort((a, b) => a.team_number - b.team_number)
                          .map((team, teamIndex) => (
                            <div
                              key={teamIndex}
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
                                    <div key={pIndex} className="team-player">
                                      <span className="player-name">
                                        {player.name}
                                      </span>
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* 점수 입력 모달 */}
      {showScoreInputModal && (
        <div className="modal-overlay">
          <div className="modal-content score-input-modal">
            <div className="modal-header">
              <h3>점수 입력</h3>
              <p>다음 회원들의 평균 점수를 입력해주세요.</p>
            </div>
            <div className="modal-body">
              {pendingMembers.map((member) => (
                <div key={member.id} className="score-input-row">
                  <div className="member-info">
                    <span className="member-name">{member.name}</span>
                    <span className="member-gender">
                      ({member.gender || '미지정'})
                    </span>
                  </div>
                  <div className="score-input-group">
                    <input
                      type="number"
                      min="0"
                      max="300"
                      placeholder="평균 점수"
                      value={memberScores[member.name] || ''}
                      onChange={(e) =>
                        handleScoreInput(member.name, e.target.value)
                      }
                      className="score-input"
                    />
                    <span className="score-unit">점</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={handleScoreInputCancel}
              >
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleScoreInputComplete}
                disabled={pendingMembers.some(
                  (member) =>
                    !memberScores[member.name] || memberScores[member.name] <= 0
                )}
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 게스트 추가 모달 */}
      {showGuestModal && (
        <div className="modal-overlay">
          <div className="modal-content guest-modal">
            <div className="modal-header">
              <h3>게스트 추가</h3>
              <button
                type="button"
                className="modal-close-button"
                onClick={handleCloseGuestModal}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>이름</label>
                <input
                  type="text"
                  placeholder="게스트 이름을 입력하세요"
                  value={guestData.name}
                  onChange={(e) =>
                    handleGuestDataChange('name', e.target.value)
                  }
                  className={`form-input ${guestErrors.name ? 'error' : ''}`}
                />
                {guestErrors.name && (
                  <div className="error-message">{guestErrors.name}</div>
                )}
              </div>
              <div className="form-group">
                <label>평균 점수</label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  placeholder="평균 점수를 입력하세요"
                  value={guestData.average}
                  onChange={(e) =>
                    handleGuestDataChange('average', e.target.value)
                  }
                  className={`form-input ${guestErrors.average ? 'error' : ''}`}
                />
                {guestErrors.average && (
                  <div className="error-message">{guestErrors.average}</div>
                )}
              </div>
              <div className="form-group">
                <label>성별</label>
                <div className="gender-options">
                  <button
                    type="button"
                    className={`gender-option ${
                      guestData.gender === '남' ? 'active' : ''
                    }`}
                    onClick={() => handleGuestDataChange('gender', '남')}
                  >
                    남
                  </button>
                  <button
                    type="button"
                    className={`gender-option ${
                      guestData.gender === '여' ? 'active' : ''
                    }`}
                    onClick={() => handleGuestDataChange('gender', '여')}
                  >
                    여
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={handleAddGuest}
                disabled={
                  !guestData.name.trim() ||
                  !guestData.average ||
                  !guestData.gender ||
                  guestErrors.name ||
                  guestErrors.average
                }
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamAssignment;
