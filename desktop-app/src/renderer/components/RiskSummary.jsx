import React from 'react';

/**
 * Risk Summary Component
 * Displays risk assessment with color-coded severity
 */
const RiskSummary = ({ riskReport }) => {
  if (!riskReport) {
    return (
      <div className="risk-summary risk-unknown">
        <div className="risk-header">
          <span className="risk-icon">⚠️</span>
          <h3>Risk Assessment Unavailable</h3>
        </div>
        <p className="risk-message">No risk analysis available for this plan.</p>
      </div>
    );
  }

  const { overallScore, level, risks, warnings, recommendation, safeToAutoApply, metadata } = riskReport;

  // Get color class based on risk level
  const getRiskClass = (level) => {
    const classes = {
      critical: 'risk-critical',
      high: 'risk-high',
      medium: 'risk-medium',
      low: 'risk-low'
    };
    return classes[level] || 'risk-unknown';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };
    return icons[severity] || '⚪';
  };

  return (
    <div className={`risk-summary ${getRiskClass(level)}`}>
      {/* Risk Header */}
      <div className="risk-header">
        <div className="risk-score">
          <div className={`risk-gauge ${getRiskClass(level)}`}>
            <svg viewBox="0 0 100 100">
              <circle
                className="gauge-bg"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                opacity="0.2"
              />
              <circle
                className="gauge-fill"
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={`${overallScore * 2.83} 283`}
                strokeDashoffset="0"
                transform="rotate(-90 50 50)"
              />
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="24"
                fontWeight="bold"
              >
                {overallScore}
              </text>
            </svg>
          </div>
          <div className="risk-level">
            <span className="level-label">{level.toUpperCase()}</span>
            <span className="level-subtitle">Risk Level</span>
          </div>
        </div>

        {!safeToAutoApply && (
          <div className="approval-required">
            <span className="approval-badge">⚠️ Approval Required</span>
          </div>
        )}
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="risk-recommendation">
          <p>{recommendation}</p>
        </div>
      )}

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="risk-warnings">
          <h4>⚠️ Warnings</h4>
          <ul>
            {warnings.map((warning, idx) => (
              <li key={idx}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Metadata */}
      {metadata && (
        <div className="risk-metadata">
          <div className="risk-stat">
            <span className="stat-label">Total Risks</span>
            <span className="stat-value">{metadata.totalRisks}</span>
          </div>
          {metadata.criticalRisks > 0 && (
            <div className="risk-stat critical">
              <span className="stat-label">Critical</span>
              <span className="stat-value">{metadata.criticalRisks}</span>
            </div>
          )}
          {metadata.highRisks > 0 && (
            <div className="risk-stat high">
              <span className="stat-label">High</span>
              <span className="stat-value">{metadata.highRisks}</span>
            </div>
          )}
          {metadata.mediumRisks > 0 && (
            <div className="risk-stat medium">
              <span className="stat-label">Medium</span>
              <span className="stat-value">{metadata.mediumRisks}</span>
            </div>
          )}
          {metadata.lowRisks > 0 && (
            <div className="risk-stat low">
              <span className="stat-label">Low</span>
              <span className="stat-value">{metadata.lowRisks}</span>
            </div>
          )}
        </div>
      )}

      {/* Detailed Risks */}
      {risks && risks.length > 0 && (
        <div className="risk-list">
          <h4>Identified Risks ({risks.length})</h4>
          {risks.map((risk, idx) => (
            <div key={idx} className={`risk-item ${getRiskClass(risk.severity)}`}>
              <div className="risk-item-header">
                <span className="severity-icon">{getSeverityIcon(risk.severity)}</span>
                <span className="risk-type">{risk.type ? risk.type.replace(/_/g, ' ') : 'risk'}</span>
                <span className="severity-badge">{risk.severity}</span>
              </div>
              <p className="risk-description">{risk.description}</p>
              <div className="risk-details">
                <div className="risk-impact">
                  <strong>Impact:</strong> {risk.impact}
                </div>
                <div className="risk-mitigation">
                  <strong>Mitigation:</strong> {risk.mitigation}
                </div>
              </div>
              {risk.affectedSteps && risk.affectedSteps.length > 0 && (
                <div className="affected-steps">
                  <small>Affects: {risk.affectedSteps.join(', ')}</small>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Safe indicator */}
      {safeToAutoApply && (
        <div className="safe-indicator">
          <span className="safe-badge">✓ Safe to Auto-Apply</span>
          <p>This plan has been assessed as low-risk and can be executed automatically.</p>
        </div>
      )}
    </div>
  );
};

export default RiskSummary;
