import React from 'react';
import usePanelStore from '../store/panelStore';
import TerminalPanel from './panels/TerminalPanel';
import ProblemsPanel from './panels/ProblemsPanel';
import OutputPanel from './panels/OutputPanel';
import DebugConsolePanel from './panels/DebugConsolePanel';

const TABS = [
  { id: 'terminal', label: 'Terminal', icon: '▶' },
  { id: 'problems', label: 'Problems', icon: '⚠' },
  { id: 'output', label: 'Output', icon: '📋' },
  { id: 'debug', label: 'Debug Console', icon: '🐛' }
];

const BottomPanel = () => {
  const { activeBottomTab, setActiveBottomTab, closeBottomPanel } = usePanelStore();

  const renderContent = () => {
    switch (activeBottomTab) {
      case 'terminal':
        return <TerminalPanel />;
      case 'problems':
        return <ProblemsPanel />;
      case 'output':
        return <OutputPanel />;
      case 'debug':
        return <DebugConsolePanel />;
      default:
        return <TerminalPanel />;
    }
  };

  return (
    <>
      {/* Tab Header */}
      <div className="bottom-panel-header">
        <div className="bottom-panel-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`bottom-panel-tab ${activeBottomTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveBottomTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="bottom-panel-actions">
          <button
            className="panel-action-btn"
            onClick={closeBottomPanel}
            title="Close Panel (Cmd+J)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bottom-panel-content">
        {renderContent()}
      </div>
    </>
  );
};

export default BottomPanel;
