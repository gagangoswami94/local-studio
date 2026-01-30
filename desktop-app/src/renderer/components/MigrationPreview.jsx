import React, { useState } from 'react';

/**
 * Migration Preview Component
 * Shows SQL migrations with forward/reverse tabs
 */
const MigrationPreview = ({ migrations }) => {
  const [selectedMigration, setSelectedMigration] = useState(0);
  const [activeTab, setActiveTab] = useState('forward'); // 'forward' | 'reverse'

  if (!migrations || migrations.length === 0) {
    return (
      <div className="migration-preview empty">
        <p className="empty-message">No database migrations required</p>
      </div>
    );
  }

  const migration = migrations[selectedMigration];

  const getMigrationIcon = (type) => {
    const icons = {
      create_table: '➕',
      alter_table: '✏️',
      drop_table: '🗑️',
      add_column: '➕',
      drop_column: '➖',
      change_column_type: '🔄',
      add_index: '🔍',
      drop_index: '❌',
      create_view: '👁️',
      drop_view: '❌'
    };
    return icons[type] || '📝';
  };

  const getRiskClass = (riskLevel) => {
    const classes = {
      critical: 'risk-critical',
      high: 'risk-high',
      medium: 'risk-medium',
      low: 'risk-low'
    };
    return classes[riskLevel] || 'risk-unknown';
  };

  return (
    <div className="migration-preview">
      {/* Migration List */}
      {migrations.length > 1 && (
        <div className="migration-list">
          {migrations.map((mig, idx) => (
            <button
              key={mig.id}
              className={`migration-item ${selectedMigration === idx ? 'active' : ''} ${getRiskClass(mig.riskLevel)}`}
              onClick={() => setSelectedMigration(idx)}
            >
              <span className="migration-icon">{getMigrationIcon(mig.type)}</span>
              <div className="migration-info">
                <span className="migration-name">{mig.id}</span>
                <span className="migration-type">{mig.type ? mig.type.replace(/_/g, ' ') : 'unknown'}</span>
              </div>
              {mig.riskLevel === 'critical' || mig.riskLevel === 'high' ? (
                <span className="warning-badge">⚠️</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* Migration Details */}
      <div className="migration-details">
        <div className="migration-header">
          <div className="migration-title">
            <span className="migration-icon-large">{getMigrationIcon(migration.type)}</span>
            <div>
              <h3>{migration.id}</h3>
              <p className="migration-description">{migration.description}</p>
            </div>
          </div>
          <span className={`risk-badge ${getRiskClass(migration.riskLevel)}`}>
            {migration.riskLevel}
          </span>
        </div>

        {/* Tabs */}
        <div className="migration-tabs">
          <button
            className={`tab ${activeTab === 'forward' ? 'active' : ''}`}
            onClick={() => setActiveTab('forward')}
          >
            <span className="tab-icon">▶️</span>
            Forward Migration
          </button>
          <button
            className={`tab ${activeTab === 'reverse' ? 'active' : ''}`}
            onClick={() => setActiveTab('reverse')}
            disabled={!migration.sql_reverse || migration.sql_reverse.trim() === ''}
          >
            <span className="tab-icon">◀️</span>
            Reverse Migration
            {(!migration.sql_reverse || migration.sql_reverse.trim() === '') && (
              <span className="no-rollback">⚠️ No rollback</span>
            )}
          </button>
        </div>

        {/* SQL Preview */}
        <div className="sql-preview">
          {activeTab === 'forward' ? (
            <pre className="sql-code">
              <code>{migration.sql_forward || '-- SQL forward migration'}</code>
            </pre>
          ) : (
            <pre className="sql-code">
              <code>
                {migration.sql_reverse && migration.sql_reverse.trim() !== ''
                  ? migration.sql_reverse
                  : '-- No reverse migration available'}
              </code>
            </pre>
          )}
        </div>

        {/* Migration Info */}
        <div className="migration-info-panel">
          <div className="info-item">
            <span className="info-label">Type:</span>
            <span className="info-value">{migration.type ? migration.type.replace(/_/g, ' ') : 'unknown'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Risk Level:</span>
            <span className={`info-value ${getRiskClass(migration.riskLevel)}`}>
              {migration.riskLevel}
            </span>
          </div>
          {migration.stepId && (
            <div className="info-item">
              <span className="info-label">Related Step:</span>
              <span className="info-value">{migration.stepId}</span>
            </div>
          )}
          {(!migration.sql_reverse || migration.sql_reverse.trim() === '') && (
            <div className="info-item warning">
              <span className="info-label">⚠️ Warning:</span>
              <span className="info-value">
                This migration cannot be rolled back automatically
              </span>
            </div>
          )}
        </div>

        {/* Impact Analysis */}
        {(migration.type === 'drop_table' || migration.type === 'drop_column' || migration.type === 'truncate_table') && (
          <div className="impact-warning">
            <h4>⚠️ Data Loss Warning</h4>
            <p>
              This migration will <strong>permanently delete data</strong>. Ensure you have:
            </p>
            <ul>
              <li>✓ Backed up the database</li>
              <li>✓ Verified the data is no longer needed</li>
              <li>✓ Coordinated with your team</li>
            </ul>
          </div>
        )}

        {(migration.type === 'alter_table' || migration.type === 'change_column_type') && (
          <div className="impact-info">
            <h4>ℹ️ Schema Change</h4>
            <p>
              This migration will modify the database schema. Ensure:
            </p>
            <ul>
              <li>✓ Existing code is compatible with the changes</li>
              <li>✓ Application is tested with the new schema</li>
              <li>✓ Migration is tested in development first</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default MigrationPreview;
