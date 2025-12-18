/**
 * 모달 오버레이에서 드래그와 클릭을 구분하는 유틸리티
 * 드래그 중에는 모달이 닫히지 않도록 처리
 */

export const createModalOverlayHandlers = (onClose) => {
  let mouseDownX = null;
  let mouseDownY = null;
  let isDragging = false;
  let mouseDownTarget = null;

  const handleMouseDown = (e) => {
    // 오버레이에서만 마우스 다운 위치 저장
    if (e.target === e.currentTarget) {
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
      mouseDownTarget = e.target;
      isDragging = false;
    }
  };

  const handleMouseMove = (e) => {
    // 마우스가 움직이면 드래그로 간주
    if (mouseDownX !== null && mouseDownY !== null && mouseDownTarget === e.currentTarget) {
      const deltaX = Math.abs(e.clientX - mouseDownX);
      const deltaY = Math.abs(e.clientY - mouseDownY);
      // 5px 이상 움직이면 드래그로 간주
      if (deltaX > 5 || deltaY > 5) {
        isDragging = true;
      }
    }
  };

  const handleMouseUp = (e) => {
    // 마우스 업 시 초기화
    mouseDownX = null;
    mouseDownY = null;
    mouseDownTarget = null;
    // isDragging은 onClick에서 확인 후 초기화
  };

  const handleClick = (e) => {
    // 오버레이에서 클릭했고, 드래그가 아니었을 때만 모달 닫기
    if (e.target === e.currentTarget && !isDragging) {
      onClose();
    }
    // 클릭 후 드래그 상태 초기화
    isDragging = false;
    mouseDownX = null;
    mouseDownY = null;
    mouseDownTarget = null;
  };

  return {
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onClick: handleClick,
  };
};

