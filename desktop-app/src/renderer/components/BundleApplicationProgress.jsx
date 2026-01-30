import React, { useState, useEffect } from 'react';
import './BundleApplicationProgress.css';

/**
 * BundleApplicationProgress Component
 * Shows real-time progress of bundle application
 *
 * Props:
 * - onProgress: Function - Progress event handler
 * - onComplete: Function - Called when application completes
 * - onError: Function - Called when application fails
 */
const BundleApplicationProgress = ({ onProgress, onComplete, onError }) => {
  const [currentStep, setCurrentStep] = useState('starting');
  const [steps, setSteps] = useState([
    { id: 'unpacking', label: 'Unpacking bundle', status: 'pending' },
    { id: 'snapshot', label: 'Creating snapshot', status: 'pending' },
    { id: 'validating', label: 'Validating changes', status: 'pending' },
    { id: 'pre_commands', label: 'Running pre-commands', status: 'pending' },
    { id: 'files', label: 'Applying files', status: 'pending' },
    { id: 'migrations', label: 'Running migrations', status: 'pending' },
    { id: 'post_commands', label: 'Running post-commands', status: 'pending' },
    { id: 'verifying', label: 'Verifying application', status: 'pending' }
  ]);
  const [currentFile, setCurrentFile] = useState(null);
  const [fileProgress, setFileProgress] = useState({ current: 0, total: 0 });
  const [currentMigration, setCurrentMigration] = useState(null);
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Register progress handler
  useEffect(() => {
    if (onProgress) {
      onProgress((step, data) => {
        handleProgress(step, data);
      });
    }
  }, [onProgress]);

  const handleProgress = (step, data) => {
    console.log('[BundleApplicationProgress]', step, data);

    // Update current step
    setCurrentStep(step);

    // Update step status
    const updateStepStatus = (stepId, status) => {
      setSteps(prev => prev.map(s =>
        s.id === stepId ? { ...s, status } : s
      ));
    };

    switch (step) {
      case 'unpacking':
        updateStepStatus('unpacking', 'in_progress');
        break;

      case 'unpacked':
        updateStepStatus('unpacking', 'complete');
        break;

      case 'snapshot_creating':
        updateStepStatus('snapshot', 'in_progress');
        break;

      case 'snapshot_created':
        updateStepStatus('snapshot', 'complete');
        break;

      case 'validating':
        updateStepStatus('validating', 'in_progress');
        break;

      case 'conflicts_detected':
        updateStepStatus('validating', 'warning');
        break;

      case 'validated':
        updateStepStatus('validating', 'complete');
        break;

      case 'pre_commands_running':
        updateStepStatus('pre_commands', 'in_progress');
        break;

      case 'pre_commands_complete':
        updateStepStatus('pre_commands', 'complete');
        break;

      case 'files_applying':
        updateStepStatus('files', 'in_progress');
        setFileProgress({ current: 0, total: data.total });
        break;

      case 'file_applying':
        setCurrentFile(data.file);
        setFileProgress({ current: data.index + 1, total: data.total });
        break;

      case 'file_applied':
        setCurrentFile(null);
        break;

      case 'files_applied':
        updateStepStatus('files', 'complete');
        setCurrentFile(null);
        break;

      case 'migrations_running':
        updateStepStatus('migrations', 'in_progress');
        setMigrationProgress({ current: 0, total: data.total });
        break;

      case 'migration_start':
        setCurrentMigration(data.migration);
        setMigrationProgress({ current: data.index + 1, total: data.total });
        break;

      case 'migration_complete':
        setCurrentMigration(null);
        break;

      case 'migrations_complete':
        updateStepStatus('migrations', 'complete');
        setCurrentMigration(null);
        break;

      case 'post_commands_running':
        updateStepStatus('post_commands', 'in_progress');
        break;

      case 'post_commands_complete':
        updateStepStatus('post_commands', 'complete');
        break;

      case 'verifying':
        updateStepStatus('verifying', 'in_progress');
        break;

      case 'verified':
        updateStepStatus('verifying', 'complete');
        break;

      case 'complete':
        // All steps complete
        if (onComplete) {
          onComplete(data);
        }
        break;

      case 'error':
        // Application failed
        setError(data);
        updateStepStatus(getStepIdFromCurrentStep(currentStep), 'error');

        if (onError) {
          onError(data);
        }
        break;

      case 'rollback_starting':
        setIsRollingBack(true);
        break;

      case 'rollback_complete':
        setIsRollingBack(false);
        break;

      case 'rollback_failed':
        setIsRollingBack(false);
        break;

      default:
        break;
    }
  };

  const getStepIdFromCurrentStep = (step) => {
    if (step.includes('file')) return 'files';
    if (step.includes('migration')) return 'migrations';
    if (step.includes('command')) return 'pre_commands';
    if (step.includes('validate')) return 'validating';
    if (step.includes('snapshot')) return 'snapshot';
    if (step.includes('verify')) return 'verifying';
    return 'unpacking';
  };

  return (
    <div className="bundle-application-progress">
      <div className="application-progress-header">
        <h3>
          {isRollingBack ? '⏪ Rolling Back Changes' : '📦 Applying Bundle'}
        </h3>
      </div>

      {/* Steps */}
      <div className="application-steps">
        {steps.map(step => (
          <div
            key={step.id}
            className={`application-step ${step.status}`}
          >
            <div className="step-icon">
              {step.status === 'complete' && '✓'}
              {step.status === 'in_progress' && '◐'}
              {step.status === 'error' && '✗'}
              {step.status === 'warning' && '⚠'}
              {step.status === 'pending' && '○'}
            </div>
            <div className="step-label">{step.label}</div>
            {step.status === 'in_progress' && (
              <div className="step-spinner"></div>
            )}
          </div>
        ))}
      </div>

      {/* Current Operation */}
      <div className="current-operation">
        {currentFile && (
          <div className="operation-detail">
            <div className="operation-label">Applying file:</div>
            <div className="operation-value">{currentFile}</div>
            <div className="operation-progress">
              {fileProgress.current} / {fileProgress.total}
            </div>
          </div>
        )}

        {currentMigration && (
          <div className="operation-detail">
            <div className="operation-label">Running migration:</div>
            <div className="operation-value">{currentMigration}</div>
            <div className="operation-progress">
              {migrationProgress.current} / {migrationProgress.total}
            </div>
          </div>
        )}

        {isRollingBack && (
          <div className="operation-detail rollback">
            <div className="operation-label">⏪ Rolling back changes...</div>
            <div className="operation-value">
              Restoring workspace to previous state
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && !isRollingBack && (
        <div className="application-error">
          <div className="error-icon">✗</div>
          <div className="error-content">
            <div className="error-message">{error.message}</div>
            <div className="error-step">Failed at: {error.step}</div>
          </div>
        </div>
      )}

      {/* File Progress Bar */}
      {fileProgress.total > 0 && !error && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(fileProgress.current / fileProgress.total) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default BundleApplicationProgress;
