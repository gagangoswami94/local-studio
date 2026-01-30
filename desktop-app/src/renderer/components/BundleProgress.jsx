import React, { useState, useEffect } from 'react';
import './BundleProgress.css';

/**
 * Bundle Progress Component
 * Shows real-time progress of bundle generation with phase tracking,
 * validation checks, token usage, and approval handling
 */
const BundleProgress = ({ taskId, onCancel, onApproval }) => {
  const [phase, setPhase] = useState('starting');
  const [phaseProgress, setPhaseProgress] = useState({
    analyze: 'pending',
    plan: 'pending',
    generate: 'pending',
    validate: 'pending'
  });
  const [currentCheck, setCurrentCheck] = useState(null);
  const [checks, setChecks] = useState([]);
  const [metrics, setMetrics] = useState({
    tokensUsed: 0,
    estimatedCost: 0,
    timeElapsed: 0
  });
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Start time tracking
    const startTime = Date.now();
    const timer = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        timeElapsed: Math.floor((Date.now() - startTime) / 1000)
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handle progress events from API
  const handleProgressEvent = (type, data) => {
    console.log('[BundleProgress] Event:', type, data);

    switch (type) {
      case 'task_start':
        setPhase('analyzing');
        setPhaseProgress(prev => ({ ...prev, analyze: 'in_progress' }));
        break;

      case 'code_analyzing':
        if (data.status === 'started') {
          setPhase('analyzing');
          setPhaseProgress(prev => ({ ...prev, analyze: 'in_progress' }));
        } else if (data.status === 'completed') {
          setPhaseProgress(prev => ({ ...prev, analyze: 'complete' }));
        }
        break;

      case 'code_planning':
        if (data.status === 'started') {
          setPhase('planning');
          setPhaseProgress(prev => ({ ...prev, plan: 'in_progress' }));
        } else if (data.status === 'completed') {
          setPhaseProgress(prev => ({ ...prev, plan: 'complete' }));
        }
        break;

      case 'approval_required':
        setPhase('approval');
        setApprovalRequest({
          plan: data.plan,
          riskAssessment: data.riskAssessment,
          estimatedTime: data.estimatedTime,
          filesAffected: data.filesAffected,
          migrations: data.migrations
        });
        break;

      case 'approval_received':
        setApprovalRequest(null);
        setPhase('generating');
        break;

      case 'code_generating':
        if (data.status === 'started') {
          setPhase('generating');
          setPhaseProgress(prev => ({ ...prev, generate: 'in_progress' }));
        } else if (data.status === 'completed') {
          setPhaseProgress(prev => ({ ...prev, generate: 'complete' }));
        }
        break;

      case 'code_validating':
        if (data.status === 'started') {
          setPhase('validating');
          setPhaseProgress(prev => ({ ...prev, validate: 'in_progress' }));
        }
        break;

      case 'validation_check_start':
        setCurrentCheck(data.check);
        setChecks(prev => [
          ...prev.filter(c => c.name !== data.check),
          { name: data.check, status: 'running', level: data.level }
        ]);
        break;

      case 'validation_check_complete':
        setChecks(prev => prev.map(c =>
          c.name === data.check
            ? { ...c, status: data.passed ? 'passed' : 'failed', message: data.message }
            : c
        ));
        setCurrentCheck(null);
        break;

      case 'validation_summary':
        setPhaseProgress(prev => ({ ...prev, validate: 'complete' }));
        if (data.suggestions && data.suggestions.length > 0) {
          setError({ type: 'validation', suggestions: data.suggestions });
        }
        break;

      case 'task_complete':
        setPhase('complete');
        setMetrics(prev => ({
          ...prev,
          tokensUsed: data.tokensUsed || 0,
          estimatedCost: calculateCost(data.tokensUsed || 0)
        }));
        break;

      case 'task_error':
        setPhase('error');
        setError({ type: 'error', message: data.error, phase: data.phase });
        break;

      default:
        // Log unknown events
        console.log('[BundleProgress] Unknown event:', type);
    }
  };

  // Calculate cost from tokens
  const calculateCost = (tokens) => {
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;
    const inputCost = (inputTokens / 1000000) * 3;
    const outputCost = (outputTokens / 1000000) * 15;
    return inputCost + outputCost;
  };

  // Format time
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  // Get phase icon
  const getPhaseIcon = (status) => {
    if (status === 'complete') return '✓';
    if (status === 'in_progress') return '◐';
    if (status === 'pending') return '○';
    return '○';
  };

  // Get check icon
  const getCheckIcon = (status) => {
    if (status === 'passed') return '✓';
    if (status === 'failed') return '✗';
    if (status === 'running') return '◐';
    return '○';
  };

  // Expose handleProgressEvent to parent via ref or callback
  useEffect(() => {
    if (window.__bundleProgressHandler) {
      window.__bundleProgressHandler.off(taskId);
    }
    window.__bundleProgressHandler = {
      on: (id, handler) => {
        if (id === taskId) {
          window.__bundleProgressCallback = handler;
        }
      },
      off: (id) => {
        if (id === taskId) {
          window.__bundleProgressCallback = null;
        }
      },
      emit: (type, data) => {
        if (window.__bundleProgressCallback) {
          window.__bundleProgressCallback(type, data);
        }
      }
    };
    window.__bundleProgressCallback = handleProgressEvent;

    return () => {
      if (window.__bundleProgressHandler) {
        window.__bundleProgressHandler.off(taskId);
      }
    };
  }, [taskId]);

  return (
    <div className="bundle-progress">
      <div className="bundle-progress-header">
        <h3>Generating Bundle</h3>
        <div className="bundle-progress-actions">
          {phase !== 'complete' && phase !== 'error' && (
            <button className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Phase Progress */}
      <div className="phase-progress">
        <div className={`phase ${phaseProgress.analyze === 'in_progress' ? 'active' : ''} ${phaseProgress.analyze === 'complete' ? 'complete' : ''}`}>
          <span className="phase-icon">{getPhaseIcon(phaseProgress.analyze)}</span>
          <span className="phase-name">Analyze</span>
        </div>
        <div className="phase-separator">→</div>
        <div className={`phase ${phaseProgress.plan === 'in_progress' ? 'active' : ''} ${phaseProgress.plan === 'complete' ? 'complete' : ''}`}>
          <span className="phase-icon">{getPhaseIcon(phaseProgress.plan)}</span>
          <span className="phase-name">Plan</span>
        </div>
        <div className="phase-separator">→</div>
        <div className={`phase ${phaseProgress.generate === 'in_progress' ? 'active' : ''} ${phaseProgress.generate === 'complete' ? 'complete' : ''}`}>
          <span className="phase-icon">{getPhaseIcon(phaseProgress.generate)}</span>
          <span className="phase-name">Generate</span>
        </div>
        <div className="phase-separator">→</div>
        <div className={`phase ${phaseProgress.validate === 'in_progress' ? 'active' : ''} ${phaseProgress.validate === 'complete' ? 'complete' : ''}`}>
          <span className="phase-icon">{getPhaseIcon(phaseProgress.validate)}</span>
          <span className="phase-name">Validate</span>
        </div>
      </div>

      {/* Current Phase Details */}
      <div className="phase-details">
        {phase === 'analyzing' && (
          <div className="phase-message">
            <div className="spinner"></div>
            <span>Analyzing request and gathering context...</span>
          </div>
        )}

        {phase === 'planning' && (
          <div className="phase-message">
            <div className="spinner"></div>
            <span>Creating implementation plan...</span>
          </div>
        )}

        {phase === 'generating' && (
          <div className="phase-message">
            <div className="spinner"></div>
            <span>Generating code, tests, and migrations...</span>
          </div>
        )}

        {phase === 'validating' && (
          <div className="validation-checks">
            <div className="phase-message">
              <div className="spinner"></div>
              <span>Running validation checks...</span>
            </div>
            {checks.length > 0 && (
              <div className="checks-list">
                {checks.map(check => (
                  <div key={check.name} className={`check check-${check.status}`}>
                    <span className="check-icon">{getCheckIcon(check.status)}</span>
                    <span className="check-name">{check.name}</span>
                    {check.message && <span className="check-message">{check.message}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {phase === 'complete' && (
          <div className="phase-message success">
            <span className="success-icon">✓</span>
            <span>Bundle generation complete!</span>
          </div>
        )}

        {phase === 'error' && error && (
          <div className="phase-message error">
            <span className="error-icon">✗</span>
            <div>
              <div>Error in {error.phase || 'unknown'} phase:</div>
              <div className="error-details">{error.message}</div>
              {error.suggestions && error.suggestions.length > 0 && (
                <div className="error-suggestions">
                  <div className="suggestions-title">Suggestions:</div>
                  {error.suggestions.map((s, i) => (
                    <div key={i} className="suggestion">
                      <div className="suggestion-title">{s.title}</div>
                      <div className="suggestion-description">{s.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Approval Request */}
      {approvalRequest && (
        <div className="approval-request">
          <div className="approval-header">
            <span className="approval-icon">⚠️</span>
            <h4>Plan Approval Required</h4>
          </div>
          <div className="approval-details">
            <div className="risk-level risk-{approvalRequest.riskAssessment.level}">
              Risk Level: {approvalRequest.riskAssessment.level.toUpperCase()}
            </div>
            <div className="approval-stats">
              <div>Files affected: {approvalRequest.filesAffected}</div>
              <div>Migrations: {approvalRequest.migrations}</div>
              <div>Estimated time: {approvalRequest.estimatedTime} minutes</div>
            </div>
            {approvalRequest.riskAssessment.reasons && (
              <div className="risk-reasons">
                <div className="reasons-title">Risk factors:</div>
                <ul>
                  {approvalRequest.riskAssessment.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="approval-actions">
            <button className="btn-approve" onClick={() => onApproval && onApproval(true)}>
              Approve Plan
            </button>
            <button className="btn-reject" onClick={() => onApproval && onApproval(false)}>
              Reject Plan
            </button>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="bundle-metrics">
        <div className="metric">
          <span className="metric-label">Tokens Used:</span>
          <span className="metric-value">{metrics.tokensUsed.toLocaleString()}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Estimated Cost:</span>
          <span className="metric-value">${metrics.estimatedCost.toFixed(4)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Time Elapsed:</span>
          <span className="metric-value">{formatTime(metrics.timeElapsed)}</span>
        </div>
      </div>
    </div>
  );
};

export default BundleProgress;
