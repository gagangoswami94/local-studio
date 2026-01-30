import React, { useState } from 'react';

/**
 * Plan Steps Component
 * Accordion-style list of execution steps
 */
const PlanSteps = ({ steps }) => {
  const [expandedSteps, setExpandedSteps] = useState(new Set());

  if (!steps || steps.length === 0) {
    return (
      <div className="plan-steps empty">
        <p className="empty-message">No steps defined</p>
      </div>
    );
  }

  const toggleStep = (stepId) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const expandAll = () => {
    setExpandedSteps(new Set(steps.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  const getActionIcon = (action) => {
    const icons = {
      create: '➕',
      modify: '✏️',
      delete: '🗑️',
      move: '↔️',
      copy: '📋'
    };
    return icons[action] || '📝';
  };

  const getActionClass = (action) => {
    const classes = {
      create: 'action-create',
      modify: 'action-modify',
      delete: 'action-delete',
      move: 'action-move',
      copy: 'action-copy'
    };
    return classes[action] || 'action-default';
  };

  const getRiskClass = (riskLevel) => {
    const classes = {
      critical: 'risk-critical',
      high: 'risk-high',
      medium: 'risk-medium',
      low: 'risk-low'
    };
    return classes[riskLevel] || 'risk-low';
  };

  const getLayerIcon = (layer) => {
    const icons = {
      database: '🗄️',
      backend: '⚙️',
      frontend: '🎨',
      test: '🧪',
      general: '📦'
    };
    return icons[layer] || '📄';
  };

  // Group steps by layer
  const stepsByLayer = steps.reduce((acc, step) => {
    const layer = step.layer || 'general';
    if (!acc[layer]) {
      acc[layer] = [];
    }
    acc[layer].push(step);
    return acc;
  }, {});

  const layerOrder = ['database', 'backend', 'frontend', 'test', 'general'];
  const orderedLayers = layerOrder.filter(layer => stepsByLayer[layer]);

  return (
    <div className="plan-steps">
      {/* Controls */}
      <div className="steps-controls">
        <div className="step-count">
          {steps.length} step{steps.length !== 1 ? 's' : ''}
        </div>
        <div className="expand-controls">
          <button className="btn-link" onClick={expandAll}>
            Expand All
          </button>
          <span className="separator">|</span>
          <button className="btn-link" onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      </div>

      {/* Steps by Layer */}
      {orderedLayers.map(layer => (
        <div key={layer} className="layer-group">
          <div className="layer-header">
            <span className="layer-icon">{getLayerIcon(layer)}</span>
            <span className="layer-name">{layer.charAt(0).toUpperCase() + layer.slice(1)}</span>
            <span className="layer-count">{stepsByLayer[layer].length}</span>
          </div>

          <div className="layer-steps">
            {stepsByLayer[layer].map((step, idx) => {
              const isExpanded = expandedSteps.has(step.id);
              const hasDependencies = step.dependencies && step.dependencies.length > 0;

              return (
                <div
                  key={step.id}
                  className={`step-item ${getActionClass(step.action)} ${getRiskClass(step.riskLevel)} ${isExpanded ? 'expanded' : ''}`}
                >
                  <button
                    className="step-header"
                    onClick={() => toggleStep(step.id)}
                  >
                    <div className="step-header-left">
                      <span className="step-number">{idx + 1}</span>
                      <span className="action-icon">{getActionIcon(step.action)}</span>
                      <div className="step-title">
                        <span className="step-target">{step.target}</span>
                        <span className="step-description">{step.description}</span>
                      </div>
                    </div>
                    <div className="step-header-right">
                      {step.estimatedTokens && (
                        <span className="token-estimate" title="Estimated tokens">
                          🪙 {step.estimatedTokens.toLocaleString()}
                        </span>
                      )}
                      <span className={`risk-badge ${getRiskClass(step.riskLevel)}`}>
                        {step.riskLevel}
                      </span>
                      <span className="expand-icon">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="step-details">
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Action:</span>
                          <span className="detail-value">{step.action}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Layer:</span>
                          <span className="detail-value">
                            {getLayerIcon(step.layer)} {step.layer}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Risk Level:</span>
                          <span className={`detail-value ${getRiskClass(step.riskLevel)}`}>
                            {step.riskLevel}
                          </span>
                        </div>
                        {step.estimatedTokens && (
                          <div className="detail-item">
                            <span className="detail-label">Est. Tokens:</span>
                            <span className="detail-value">
                              {step.estimatedTokens.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {step.description && (
                        <div className="step-description-full">
                          <strong>Description:</strong>
                          <p>{step.description}</p>
                        </div>
                      )}

                      {hasDependencies && (
                        <div className="step-dependencies">
                          <strong>Dependencies:</strong>
                          <div className="dependency-list">
                            {step.dependencies.map(depId => {
                              const depStep = steps.find(s => s.id === depId);
                              return (
                                <div key={depId} className="dependency-item">
                                  <span className="dependency-icon">↳</span>
                                  {depStep ? (
                                    <>
                                      <span className="dependency-target">
                                        {depStep.target}
                                      </span>
                                      <span className="dependency-id">({depId})</span>
                                    </>
                                  ) : (
                                    <span className="dependency-id">{depId}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {step.featureId && (
                        <div className="step-feature">
                          <strong>Feature:</strong> {step.featureId}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Summary Stats */}
      <div className="steps-summary">
        <div className="summary-stat">
          <span className="stat-icon">➕</span>
          <span className="stat-value">
            {steps.filter(s => s.action === 'create').length}
          </span>
          <span className="stat-label">Create</span>
        </div>
        <div className="summary-stat">
          <span className="stat-icon">✏️</span>
          <span className="stat-value">
            {steps.filter(s => s.action === 'modify').length}
          </span>
          <span className="stat-label">Modify</span>
        </div>
        <div className="summary-stat">
          <span className="stat-icon">🗑️</span>
          <span className="stat-value">
            {steps.filter(s => s.action === 'delete').length}
          </span>
          <span className="stat-label">Delete</span>
        </div>
        <div className="summary-stat">
          <span className="stat-icon">🪙</span>
          <span className="stat-value">
            {steps.reduce((sum, s) => sum + (s.estimatedTokens || 0), 0).toLocaleString()}
          </span>
          <span className="stat-label">Total Tokens</span>
        </div>
      </div>
    </div>
  );
};

export default PlanSteps;
