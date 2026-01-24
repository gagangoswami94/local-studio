import React, { useState } from 'react';
import Editor from './Editor';

const EditorArea = () => {
  const [code, setCode] = useState('// Welcome to Local Studio\n// Start by creating a new project');
  const [language] = useState('javascript');

  const handleCodeChange = (newCode) => {
    setCode(newCode);
  };

  return (
    <div className="editor-area">
      <Editor
        value={code}
        language={language}
        onChange={handleCodeChange}
        path="welcome.js"
      />
    </div>
  );
};

export default EditorArea;
