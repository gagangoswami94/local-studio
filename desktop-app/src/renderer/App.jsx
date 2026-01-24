import React, { useState } from 'react';
import './styles/app.css';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import EditorArea from './components/EditorArea';
import RightPanel from './components/RightPanel';
import BottomPanel from './components/BottomPanel';

// Mock file structure for testing
const mockFiles = [
  {
    name: 'src',
    type: 'directory',
    path: '/src',
    children: [
      {
        name: 'components',
        type: 'directory',
        path: '/src/components',
        children: [
          { name: 'App.jsx', type: 'file', path: '/src/components/App.jsx' },
          { name: 'Editor.jsx', type: 'file', path: '/src/components/Editor.jsx' }
        ]
      },
      {
        name: 'styles',
        type: 'directory',
        path: '/src/styles',
        children: [
          { name: 'app.css', type: 'file', path: '/src/styles/app.css' }
        ]
      },
      { name: 'index.jsx', type: 'file', path: '/src/index.jsx' }
    ]
  },
  { name: 'package.json', type: 'file', path: '/package.json' },
  { name: 'README.md', type: 'file', path: '/README.md' }
];

const App = () => {
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (file) => {
    setSelectedFile(file.path);
    console.log('Selected file:', file);
  };

  return (
    <div className="app-container">
      <MenuBar />
      <div className="main-content">
        <Sidebar
          files={mockFiles}
          onFileSelect={handleFileSelect}
          selectedFile={selectedFile}
        />
        <EditorArea />
        <RightPanel />
      </div>
      <BottomPanel collapsed={bottomPanelCollapsed} />
    </div>
  );
};

export default App;
