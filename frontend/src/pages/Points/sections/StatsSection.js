import React from 'react';
import { Line } from 'react-chartjs-2';

/**
 * 포인트 통계 섹션 컴포넌트
 */
const StatsSection = ({
  stats,
  formatNumber,
  prepareChartData,
  chartOptions,
}) => {
  return (
    <div className="stats-section">
      <div className="stats-grid">
        <div className="stat-card stat-success">
          <div className="stat-number">{formatNumber(stats.totalEarned)}</div>
          <div className="stat-label">총 적립</div>
        </div>
        <div className="stat-card stat-danger">
          <div className="stat-number">{formatNumber(stats.totalUsed)}</div>
          <div className="stat-label">총 사용</div>
        </div>
        <div className="stat-card stat-primary">
          <div className="stat-number">{formatNumber(stats.totalBalance)}</div>
          <div className="stat-label">잔여 포인트</div>
        </div>
        <div className="stat-card stat-info">
          <div className="stat-number">{stats.activeMembers}</div>
          <div className="stat-label">활동 회원</div>
        </div>
      </div>

      {/* 월별 통계 */}
      {Object.keys(stats.monthlyStats).length > 0 && (
        <div className="monthly-stats">
          <div className="section-card">
            <h3 className="section-title">월별 포인트 현황</h3>

            {/* 그래프 섹션 */}
            <div className="monthly-chart-section">
              <div className="chart-container">
                <Line data={prepareChartData()} options={chartOptions} />
              </div>
            </div>

            {/* 카드 섹션 */}
            <div className="monthly-stats-grid">
              {Object.entries(stats.monthlyStats)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-8)
                .map(([month, data]) => (
                  <div key={month} className="monthly-stat-card">
                    <h4>{month}</h4>
                    <div className="monthly-stat-content">
                      <div className="monthly-stat-row">
                        <span className="label">적립</span>
                        <span className="value earned">
                          +{formatNumber(data.earned)}
                        </span>
                      </div>
                      <div className="monthly-stat-row">
                        <span className="label">사용</span>
                        <span className="value used">
                          -{formatNumber(data.used)}
                        </span>
                      </div>
                      <div className="monthly-stat-row net">
                        <span className="label">순증감</span>
                        <span
                          className={`value ${
                            data.earned - data.used >= 0 ? 'positive' : 'negative'
                          }`}
                        >
                          {data.earned - data.used >= 0 ? '+' : ''}
                          {formatNumber(data.earned - data.used)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsSection;

