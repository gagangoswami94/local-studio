import React, { useState } from 'react';
import PlanSteps from './PlanSteps';
import RiskSummary from './RiskSummary';
import MigrationPreview from './MigrationPreview';

/**
 * Plan Review Component
 * Full-screen modal for reviewing execution plans
 */
const PlanReview = ({ plan, onApprove, onCancel, onModify }) => {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'steps' | 'migrations' | 'risks' | 'dependencies'

  if (!plan) {
    return null;
  }

  const { title, complexity, steps, migrations, tests, totalEstimate, risks, metadata, dependencies, raw } = plan;

  return (
    <div className="plan-review-overlay">
      <div className="plan-review-modal">
        {/* Header */}
        <div className="plan-review-header">
          <div className="header-content">
            <h2>{title || 'Execution Plan Review'}</h2>
            {complexity && (
              <span className={`complexity-badge complexity-${complexity.toLowerCase()}`}>
                {complexity}
              </span>
            )}
          </div>
          <button className="close-button" onClick={onCancel} title="Close">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="plan-review-tabs">
          <button
            className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            <span className="tab-icon">📋</span>
            Summary
          </button>
          <button
            className={`tab ${activeTab === 'steps' ? 'active' : ''}`}
            onClick={() => setActiveTab('steps')}
          >
            <span className="tab-icon">📝</span>
            Steps
            {steps && <span className="tab-count">{steps.length}</span>}
          </button>
          {migrations && migrations.length > 0 && (
            <button
              className={`tab ${activeTab === 'migrations' ? 'active' : ''}`}
              onClick={() => setActiveTab('migrations')}
            >
              <span className="tab-icon">🗄️</span>
              Migrations
              <span className="tab-count">{migrations.length}</span>
            </button>
          )}
          {risks && risks.length > 0 && (
            <button
              className={`tab ${activeTab === 'risks' ? 'active' : ''}`}
              onClick={() => setActiveTab('risks')}
            >
              <span className="tab-icon">⚠️</span>
              Risks
              <span className="tab-count">{risks.length}</span>
            </button>
          )}
          {dependencies && Object.keys(dependencies).length > 0 && (
            <button
              className={`tab ${activeTab === 'dependencies' ? 'active' : ''}`}
              onClick={() => setActiveTab('dependencies')}
            >
              <span className="tab-icon">📦</span>
              Dependencies
            </button>
          )}
        </div>

        {/* Content */}
        <div className="plan-review-content">
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="tab-content summary-content">
              <div className="summary-grid">
                {/* Quick Stats */}
                <div className="summary-card">
                  <h3>📊 Quick Stats</h3>
                  <div className="stats-grid">
                    {complexity && (
                      <div className="stat-item">
                        <span className="stat-label">Complexity:</span>
                        <span className={`stat-value complexity-${complexity.toLowerCase()}`}>
                          {complexity}
                        </span>
                      </div>
                    )}
                    {totalEstimate?.time && (
                      <div className="stat-item">
                        <span className="stat-label">Est. Time:</span>
                        <span className="stat-value">
                          ~{totalEstimate.time.estimatedMinutes} min
                        </span>
                      </div>
                    )}
                    {totalEstimate?.files && (
                      <div className="stat-item">
                        <span className="stat-label">Files Changed:</span>
                        <span className="stat-value">
                          {totalEstimate.files.total}
                        </span>
                      </div>
                    )}
                    {totalEstimate?.tokens && (
                      <div className="stat-item">
                        <span className="stat-label">Token Usage:</span>
                        <span className="stat-value">
                          {totalEstimate.tokens.total.toLocaleString()} / {totalEstimate.tokens.budget.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* File Changes */}
                {totalEstimate?.files && (
                  <div className="summary-card">
                    <h3>📁 File Changes</h3>
                    <div className="file-stats">
                      <div className="file-stat create">
                        <span className="file-icon">➕</span>
                        <span className="file-count">{totalEstimate.files.created}</span>
                        <span className="file-label">Created</span>
                      </div>
                      <div className="file-stat modify">
                        <span className="file-icon">✏️</span>
                        <span className="file-count">{totalEstimate.files.modified}</span>
                        <span className="file-label">Modified</span>
                      </div>
                      <div className="file-stat delete">
                        <span className="file-icon">🗑️</span>
                        <span className="file-count">{totalEstimate.files.deleted}</span>
                        <span className="file-label">Deleted</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Steps Overview */}
                {metadata && (
                  <div className="summary-card">
                    <h3>📝 Plan Overview</h3>
                    <ul className="overview-list">
                      <li>
                        <span className="overview-icon">🎯</span>
                        <strong>{metadata.featuresCount || 0}</strong> feature{metadata.featuresCount !== 1 ? 's' : ''}
                      </li>
                      <li>
                        <span className="overview-icon">📋</span>
                        <strong>{metadata.stepsCount || 0}</strong> step{metadata.stepsCount !== 1 ? 's' : ''}
                      </li>
                      {metadata.migrationsCount > 0 && (
                        <li>
                          <span className="overview-icon">🗄️</span>
                          <strong>{metadata.migrationsCount}</strong> migration{metadata.migrationsCount !== 1 ? 's' : ''}
                        </li>
                      )}
                      {metadata.testsCount > 0 && (
                        <li>
                          <span className="overview-icon">🧪</span>
                          <strong>{metadata.testsCount}</strong> test{metadata.testsCount !== 1 ? 's' : ''}
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Token Budget */}
                {totalEstimate?.tokens && (
                  <div className="summary-card">
                    <h3>🪙 Token Budget</h3>
                    <div className="budget-bar">
                      <div
                        className={`budget-fill ${totalEstimate.tokens.withinBudget ? 'within-budget' : 'over-budget'}`}
                        style={{
                          width: `${Math.min((totalEstimate.tokens.total / totalEstimate.tokens.budget) * 100, 100)}%`
                        }}
                      />
                    </div>
                    <div className="budget-details">
                      <span className="budget-used">
                        {totalEstimate.tokens.total.toLocaleString()} used
                      </span>
                      <span className={`budget-status ${totalEstimate.tokens.withinBudget ? 'good' : 'exceeded'}`}>
                        {totalEstimate.tokens.withinBudget ? '✓ Within Budget' : '⚠️ Over Budget'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Risk Summary Preview */}
              {raw?.riskReport && (
                <div className="risk-preview">
                  <h3>⚠️ Risk Assessment</h3>
                  <RiskSummary riskReport={raw.riskReport} />
                </div>
              )}
            </div>
          )}

          {/* Steps Tab */}
          {activeTab === 'steps' && (
            <div className="tab-content steps-content">
              <PlanSteps steps={steps} />
            </div>
          )}

          {/* Migrations Tab */}
          {activeTab === 'migrations' && (
            <div className="tab-content migrations-content">
              <MigrationPreview migrations={migrations} />
            </div>
          )}

          {/* Risks Tab */}
          {activeTab === 'risks' && (
            <div className="tab-content risks-content">
              <RiskSummary riskReport={raw?.riskReport || { overallScore: 0, level: 'low', risks, warnings: [], recommendation: 'No risk assessment available', safeToAutoApply: false }} />
            </div>
          )}

          {/* Dependencies Tab */}
          {activeTab === 'dependencies' && (
            <div className="tab-content dependencies-content">
              <div className="dependencies-panel">
                <h3>📦 Package Dependencies</h3>

                {dependencies?.install && dependencies.install.length > 0 && (
                  <div className="dependency-section">
                    <h4 className="dependency-heading">
                      <span className="heading-icon">➕</span>
                      Packages to Install
                    </h4>
                    <ul className="dependency-list">
                      {dependencies.install.map((pkg, idx) => (
                        <li key={idx} className="dependency-item install">
                          <span className="pkg-name">{pkg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dependencies?.remove && dependencies.remove.length > 0 && (
                  <div className="dependency-section">
                    <h4 className="dependency-heading">
                      <span className="heading-icon">➖</span>
                      Packages to Remove
                    </h4>
                    <ul className="dependency-list">
                      {dependencies.remove.map((pkg, idx) => (
                        <li key={idx} className="dependency-item remove">
                          <span className="pkg-name">{pkg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dependencies?.update && dependencies.update.length > 0 && (
                  <div className="dependency-section">
                    <h4 className="dependency-heading">
                      <span className="heading-icon">🔄</span>
                      Packages to Update
                    </h4>
                    <ul className="dependency-list">
                      {dependencies.update.map((pkg, idx) => (
                        <li key={idx} className="dependency-item update">
                          <span className="pkg-name">{pkg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(!dependencies || Object.keys(dependencies).length === 0 ||
                  (!dependencies.install?.length && !dependencies.remove?.length && !dependencies.update?.length)) && (
                  <div className="empty-dependencies">
                    <p>No package changes required</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="plan-review-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            <span className="btn-icon">✕</span>
            Cancel
          </button>
          {onModify && (
            <button className="btn btn-tertiary" onClick={onModify}>
              <span className="btn-icon">✏️</span>
              Modify Plan
            </button>
          )}
          <button className="btn btn-primary" onClick={() => onApprove(plan)}>
            <span className="btn-icon">✓</span>
            Approve & Generate
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanReview;
