import React from 'react';

const modalStyle = {
  textAlign: 'center',
  padding: '30px',
  minWidth: '200px',
};

const spinnerStyle = {
  margin: '0 auto 20px',
};

const LoadingModal = ({ isOpen, message }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <div className="loading-spinner" style={spinnerStyle}></div>
        <h3 style={{ margin: 0 }}>{message || '처리 중...'}</h3>
      </div>
    </div>
  );
};

export default LoadingModal;

