import React, { useState, useEffect } from 'react';
import './styles/app.css';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import EditorArea from './components/EditorArea';
import RightPanel from './components/RightPanel';
import BottomPanel from './components/BottomPanel';
import StatusBar from './components/StatusBar';
import ResizeHandle from './components/ResizeHandle';
import usePanelStore from './store/panelStore';

const App = () => {
  const {
    bottomPanelOpen,
    bottomPanelHeight,
    setBottomPanelHeight,
    toggleBottomPanel
  } = usePanelStore();

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [rightPanelWidth, setRightPanelWidth] = useState(400);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+J (Mac) or Ctrl+J (Windows/Linux) - Toggle bottom panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        toggleBottomPanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleBottomPanel]);

  const handleSidebarResize = (delta) => {
    setSidebarWidth((prev) => Math.max(150, Math.min(500, prev + delta)));
  };

  const handleRightPanelResize = (delta) => {
    setRightPanelWidth((prev) => Math.max(200, Math.min(600, prev - delta)));
  };

  const handleBottomPanelResize = (delta) => {
    const newHeight = Math.max(100, Math.min(600, bottomPanelHeight - delta));
    setBottomPanelHeight(newHeight);
  };

  return (
    <div className="app-container">
      <MenuBar />
      <div className="main-content">
        <div className="sidebar" style={{ width: `${sidebarWidth}px` }}>
          <Sidebar />
        </div>
        <ResizeHandle direction="horizontal" onResize={handleSidebarResize} />
        <EditorArea />
        <ResizeHandle direction="horizontal" onResize={handleRightPanelResize} />
        <div className="right-panel" style={{ width: `${rightPanelWidth}px` }}>
          <RightPanel />
        </div>
      </div>
      <div
        className={`bottom-panel-wrapper ${bottomPanelOpen ? 'open' : 'closed'}`}
        style={{
          height: bottomPanelOpen ? `${bottomPanelHeight}px` : '0px'
        }}
      >
        {bottomPanelOpen && (
          <>
            <ResizeHandle direction="vertical" onResize={handleBottomPanelResize} />
            <div className="bottom-panel">
              <BottomPanel />
            </div>
          </>
        )}
      </div>
      <StatusBar />
    </div>
  );
};

export default App;
