import React, { useEffect, useRef } from 'react';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import MonacoEditor from '@monaco-editor/react';

// Configure Monaco to use local files instead of CDN
loader.config({ monaco });

const Editor = ({ value, language = 'javascript', onChange, path }) => {
  const handleEditorChange = (newValue) => {
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <MonacoEditor
      height="100%"
      language={language}
      value={value}
      onChange={handleEditorChange}
      theme="vs-dark"
      path={path}
      loading={
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#cccccc',
          fontSize: '14px'
        }}>
          Loading editor...
        </div>
      }
      options={{
        minimap: { enabled: true },
        lineNumbers: 'on',
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        formatOnPaste: true,
        formatOnType: true,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        fontSize: 14,
        tabSize: 2,
        wordWrap: 'off',
        renderWhitespace: 'selection',
        bracketPairColorization: {
          enabled: true
        }
      }}
    />
  );
};

export default Editor;
