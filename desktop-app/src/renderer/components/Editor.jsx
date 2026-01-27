import React, { useEffect, useRef, useMemo, useState } from 'react';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import MonacoEditor from '@monaco-editor/react';
import useSettingsStore from '../store/settingsStore';
import { getCurrentTheme, getTheme } from '../styles/themes/themes';

// Configure Monaco to use local files instead of CDN
loader.config({ monaco });

const Editor = ({ value, language = 'javascript', onChange, path }) => {
  const { settings } = useSettingsStore();
  const editorRef = useRef(null);
  const [currentTheme, setCurrentTheme] = useState(() => {
    const themeId = getCurrentTheme();
    const theme = getTheme(themeId);
    return theme ? theme.monacoTheme : 'vs-dark';
  });

  const handleEditorChange = (newValue) => {
    if (onChange) {
      onChange(newValue);
    }
  };

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = (event) => {
      const theme = getTheme(event.detail.themeId);
      if (theme) {
        setCurrentTheme(theme.monacoTheme);
        if (editorRef.current) {
          monaco.editor.setTheme(theme.monacoTheme);
        }
      }
    };

    window.addEventListener('themechange', handleThemeChange);

    return () => {
      window.removeEventListener('themechange', handleThemeChange);
    };
  }, []);

  // Get editor options from settings
  const editorOptions = useMemo(() => ({
    minimap: { enabled: settings['editor.minimap'] },
    lineNumbers: settings['editor.lineNumbers'],
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    formatOnPaste: true,
    formatOnType: true,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    fontSize: settings['editor.fontSize'],
    tabSize: settings['editor.tabSize'],
    wordWrap: settings['editor.wordWrap'],
    renderWhitespace: 'selection',
    bracketPairColorization: {
      enabled: true
    }
  }), [settings]);

  return (
    <MonacoEditor
      height="100%"
      language={language}
      value={value}
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      theme={currentTheme}
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
      options={editorOptions}
    />
  );
};

export default Editor;
