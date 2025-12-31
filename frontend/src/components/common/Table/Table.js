import React from 'react';
import './Table.css';

/**
 * 공통 Table 컴포넌트
 *
 * @param {Array} columns - 컬럼 정의 배열 [{key, label, className, sortable, width, render}]
 * @param {Array} data - 테이블 데이터 배열
 * @param {function} renderRow - 커스텀 row 렌더링 함수 (선택)
 * @param {string} sortField - 현재 정렬 필드
 * @param {string} sortOrder - 현재 정렬 순서 ('asc' | 'desc')
 * @param {function} onSort - 정렬 변경 핸들러
 * @param {boolean} loading - 로딩 상태
 * @param {string} emptyMessage - 데이터 없을 때 메시지
 * @param {string} className - 추가 CSS 클래스
 * @param {function} getRowClassName - row별 클래스 계산 함수
 * @param {function} getRowKey - row별 key 계산 함수
 */
const Table = ({
  columns = [],
  data = [],
  renderRow,
  sortField,
  sortOrder,
  onSort,
  loading = false,
  emptyMessage = '데이터가 없습니다.',
  className = '',
  getRowClassName,
  getRowKey,
}) => {
  const handleSort = (columnKey) => {
    if (onSort) {
      onSort(columnKey);
    }
  };

  const renderSortIndicator = (column) => {
    if (!column.sortable || sortField !== column.key) {
      return null;
    }
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  const renderHeaderCell = (column) => {
    const isSortable = column.sortable && onSort;
    const headerProps = {
      key: column.key,
      className: `${column.className || ''} ${isSortable ? 'sortable' : ''}`.trim(),
      style: column.width ? { width: column.width } : undefined,
    };

    if (isSortable) {
      headerProps.onClick = () => handleSort(column.key);
      headerProps.style = {
        ...headerProps.style,
        cursor: 'pointer',
        userSelect: 'none',
      };
    }

    return (
      <th {...headerProps}>
        {column.label}
        {renderSortIndicator(column)}
      </th>
    );
  };

  const renderCell = (row, column, rowIndex) => {
    if (column.render) {
      return (
        <td key={column.key} className={column.className || ''}>
          {column.render(row, rowIndex)}
        </td>
      );
    }
    return (
      <td key={column.key} className={column.className || ''}>
        {row[column.key]}
      </td>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={columns.length} className="table-loading">
            <div className="loading-spinner"></div>
            <span>로딩 중...</span>
          </td>
        </tr>
      );
    }

    if (!data || data.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="table-empty">
            {emptyMessage}
          </td>
        </tr>
      );
    }

    return data.map((row, index) => {
      const rowKey = getRowKey ? getRowKey(row, index) : row.id || index;
      const rowClassName = getRowClassName ? getRowClassName(row, index) : '';

      if (renderRow) {
        return renderRow(row, index, rowKey, rowClassName);
      }

      return (
        <tr key={rowKey} className={rowClassName}>
          {columns.map((column) => renderCell(row, column, index))}
        </tr>
      );
    });
  };

  return (
    <div className={`common-table-container ${className}`}>
      <table className="common-table">
        <thead>
          <tr>{columns.map(renderHeaderCell)}</tr>
        </thead>
        <tbody>{renderBody()}</tbody>
      </table>
    </div>
  );
};

export default Table;

