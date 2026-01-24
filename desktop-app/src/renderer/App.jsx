import React, { useState } from 'react';
import './styles/app.css';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import EditorArea from './components/EditorArea';
import RightPanel from './components/RightPanel';
import BottomPanel from './components/BottomPanel';
import StatusBar from './components/StatusBar';

const App = () => {
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);

  return (
    <div className="app-container">
      <MenuBar />
      <div className="main-content">
        <Sidebar />
        <EditorArea />
        <RightPanel />
      </div>
      <BottomPanel collapsed={bottomPanelCollapsed} />
      <StatusBar />
    </div>
  );
};

export default App;
