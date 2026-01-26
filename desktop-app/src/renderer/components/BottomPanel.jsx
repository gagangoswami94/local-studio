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

      {/* Tab Content - Keep all panels mounted, hide inactive ones */}
      <div className="bottom-panel-content">
        <div
          className="tab-panel"
          style={{
            visibility: activeBottomTab === 'terminal' ? 'visible' : 'hidden',
            position: activeBottomTab === 'terminal' ? 'relative' : 'absolute',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <TerminalPanel isVisible={activeBottomTab === 'terminal'} />
        </div>
        <div
          className="tab-panel"
          style={{
            visibility: activeBottomTab === 'problems' ? 'visible' : 'hidden',
            position: activeBottomTab === 'problems' ? 'relative' : 'absolute',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <ProblemsPanel />
        </div>
        <div
          className="tab-panel"
          style={{
            visibility: activeBottomTab === 'output' ? 'visible' : 'hidden',
            position: activeBottomTab === 'output' ? 'relative' : 'absolute',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <OutputPanel />
        </div>
        <div
          className="tab-panel"
          style={{
            visibility: activeBottomTab === 'debug' ? 'visible' : 'hidden',
            position: activeBottomTab === 'debug' ? 'relative' : 'absolute',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <DebugConsolePanel />
        </div>
      </div>
    </>
  );
};

export default BottomPanel;
