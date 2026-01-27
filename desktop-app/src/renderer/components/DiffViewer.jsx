import React, { useRef, useEffect, useState } from 'react';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import useSettingsStore from '../store/settingsStore';
import { getCurrentTheme, getTheme } from '../styles/themes/themes';

// Configure Monaco to use local files
loader.config({ monaco });

const DiffViewer = ({ original, modified, language = 'javascript', path }) => {
  const { settings } = useSettingsStore();
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const modelsRef = useRef({ original: null, modified: null });
  const [isReady, setIsReady] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    const themeId = getCurrentTheme();
    const theme = getTheme(themeId);
    return theme ? theme.monacoTheme : 'vs-dark';
  });

  // Create editor once
  useEffect(() => {
    if (!containerRef.current) return;

    // Create diff editor
    const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: true,
      scrollBeyondLastLine: false,
      fontSize: settings['editor.fontSize'] || 14,
      minimap: { enabled: settings['editor.minimap'] },
      lineNumbers: settings['editor.lineNumbers'] || 'on',
      theme: currentTheme,
      originalEditable: false,
      renderOverviewRuler: true,
      ignoreTrimWhitespace: false
    });

    editorRef.current = diffEditor;
    setIsReady(true);

    // Cleanup - IMPORTANT: dispose editor first, then models
    return () => {
      setIsReady(false);

      // Set model to null first to detach models
      if (editorRef.current) {
        try {
          editorRef.current.setModel(null);
        } catch (e) {
          // Ignore errors during cleanup
        }
        editorRef.current.dispose();
        editorRef.current = null;
      }

      // Now dispose models
      if (modelsRef.current.original) {
        modelsRef.current.original.dispose();
        modelsRef.current.original = null;
      }
      if (modelsRef.current.modified) {
        modelsRef.current.modified.dispose();
        modelsRef.current.modified = null;
      }
    };
  }, []); // Only create once

  // Update models when content changes
  useEffect(() => {
    if (!editorRef.current || !isReady) return;

    let disposed = false;

    // Store old models for disposal
    const oldOriginal = modelsRef.current.original;
    const oldModified = modelsRef.current.modified;

    // Create new models
    const originalModel = monaco.editor.createModel(original || '', language);
    const modifiedModel = monaco.editor.createModel(modified || '', language);

    // Update refs with new models
    modelsRef.current.original = originalModel;
    modelsRef.current.modified = modifiedModel;

    // Set models on diff editor
    try {
      editorRef.current.setModel({
        original: originalModel,
        modified: modifiedModel
      });
    } catch (e) {
      // Silently handle Monaco errors during model switching
      console.warn('Error setting diff model:', e.message);
    }

    // Dispose old models after a delay to ensure editor has switched
    const cleanupTimer = setTimeout(() => {
      if (!disposed) {
        if (oldOriginal && !oldOriginal.isDisposed()) {
          oldOriginal.dispose();
        }
        if (oldModified && !oldModified.isDisposed()) {
          oldModified.dispose();
        }
      }
    }, 100);

    // Cleanup function
    return () => {
      disposed = true;
      clearTimeout(cleanupTimer);
    };
  }, [original, modified, language, path, isReady]);

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

  // Update options when settings change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: settings['editor.fontSize'] || 14,
        minimap: { enabled: settings['editor.minimap'] },
        lineNumbers: settings['editor.lineNumbers'] || 'on'
      });
    }
  }, [settings]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!isReady && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#cccccc',
          fontSize: '14px'
        }}>
          Loading diff viewer...
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default DiffViewer;
