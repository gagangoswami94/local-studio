import { create } from 'zustand';
import { readDirectory, readFile, writeFile, lintFile } from '../utils/ipc';
import logger from '../utils/logger';
import useProblemsStore from './problemsStore';

/**
 * Helper function to trigger linting for a file
 * @param {string} filePath - Path to the file
 * @param {string} content - File content
 */
async function triggerLinting(filePath, content) {
  try {
    const result = await lintFile(filePath, content);

    if (result.success) {
      const { setProblemsForFile } = useProblemsStore.getState();
      setProblemsForFile(filePath, result.problems || []);
    } else {
      console.error('Linting failed:', result.error);
    }
  } catch (error) {
    console.error('Error triggering linting:', error);
  }
}

const useWorkspaceStore = create((set, get) => ({
  // State
  currentWorkspace: null,
  workspacePath: localStorage.getItem('workspacePath') || null,
  files: [],
  openFiles: [], // Array of { path, name, content, isDirty }
  activeFile: null, // Path of currently active file
  isSaving: false, // true when saving
  saveError: null, // Error message if save fails
  lintTimers: {}, // Debounce timers for linting

  // Actions
  openWorkspace: async (path) => {
    try {
      logger.info(`Opening workspace: ${path}`, 'System');

      // Load directory structure
      const result = await readDirectory(path);

      if (result.success) {
        set({
          currentWorkspace: path,
          workspacePath: path,
          files: result.data,
          openFiles: [],
          activeFile: null
        });

        // Persist to localStorage
        localStorage.setItem('workspacePath', path);

        logger.info(`Workspace opened successfully: ${path}`, 'System');
        return { success: true };
      } else {
        logger.error(`Failed to load workspace: ${result.error}`, 'System');
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error(`Error opening workspace: ${error.message}`, 'System');
      return { success: false, error: error.message };
    }
  },

  loadFiles: async () => {
    const { workspacePath } = get();
    if (!workspacePath) return;

    const result = await readDirectory(workspacePath);
    if (result.success) {
      set({ files: result.data });
    }
  },

  openFile: async (filePath, fileName) => {
    const { openFiles, activeFile } = get();

    // Check if file is already open
    const existingFile = openFiles.find(f => f.path === filePath);
    if (existingFile) {
      set({ activeFile: filePath });
      return { success: true, content: existingFile.content };
    }

    logger.info(`Opening file: ${fileName}`, 'System');

    // Load file content
    const result = await readFile(filePath);

    if (result.success) {
      const newFile = {
        path: filePath,
        name: fileName,
        content: result.data,
        isDirty: false
      };

      set({
        openFiles: [...openFiles, newFile],
        activeFile: filePath
      });

      logger.info(`File opened successfully: ${fileName}`, 'System');

      // Trigger linting for the opened file
      triggerLinting(filePath, result.data);

      return { success: true, content: result.data };
    } else {
      logger.error(`Failed to open file ${fileName}: ${result.error}`, 'System');
      return { success: false, error: result.error };
    }
  },

  setActiveFile: (filePath) => {
    const { openFiles } = get();
    const fileExists = openFiles.find(f => f.path === filePath);

    if (fileExists) {
      set({ activeFile: filePath });
    }
  },

  closeFile: (filePath) => {
    const { openFiles, activeFile, lintTimers } = get();
    const newOpenFiles = openFiles.filter(f => f.path !== filePath);

    let newActiveFile = activeFile;
    if (activeFile === filePath) {
      // Set active file to the last remaining open file, or null
      newActiveFile = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].path : null;
    }

    // Clear lint timer for this file
    if (lintTimers[filePath]) {
      clearTimeout(lintTimers[filePath]);
    }

    const newLintTimers = { ...lintTimers };
    delete newLintTimers[filePath];

    set({
      openFiles: newOpenFiles,
      activeFile: newActiveFile,
      lintTimers: newLintTimers
    });
  },

  updateFileContent: (filePath, content) => {
    const { openFiles, lintTimers } = get();
    const updatedFiles = openFiles.map(f =>
      f.path === filePath
        ? { ...f, content, isDirty: true }
        : f
    );

    set({ openFiles: updatedFiles });

    // Debounced linting (3 seconds after last change)
    if (lintTimers[filePath]) {
      clearTimeout(lintTimers[filePath]);
    }

    const newTimer = setTimeout(() => {
      triggerLinting(filePath, content);
    }, 3000);

    set((state) => ({
      lintTimers: {
        ...state.lintTimers,
        [filePath]: newTimer
      }
    }));
  },

  saveFile: async (filePath) => {
    const { openFiles } = get();
    const file = openFiles.find(f => f.path === filePath);

    if (!file) {
      const errorMsg = 'File not found in open files';
      logger.error(errorMsg, 'System');
      set({ saveError: errorMsg });
      return { success: false, error: errorMsg };
    }

    set({ isSaving: true, saveError: null });
    logger.info(`Saving file: ${file.name}`, 'System');

    try {
      const result = await writeFile(filePath, file.content);

      if (result.success) {
        // Mark file as not dirty
        const updatedFiles = openFiles.map(f =>
          f.path === filePath
            ? { ...f, isDirty: false }
            : f
        );

        set({ openFiles: updatedFiles, isSaving: false });
        logger.info(`File saved successfully: ${file.name}`, 'System');

        // Trigger linting after save
        triggerLinting(filePath, file.content);

        return { success: true };
      } else {
        logger.error(`Failed to save file ${file.name}: ${result.error}`, 'System');
        set({ isSaving: false, saveError: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error(`Error saving file ${file.name}: ${error.message}`, 'System');
      set({ isSaving: false, saveError: error.message });
      return { success: false, error: error.message };
    }
  },

  saveAllFiles: async () => {
    const { openFiles } = get();
    const dirtyFiles = openFiles.filter(f => f.isDirty);

    if (dirtyFiles.length === 0) {
      return { success: true, message: 'No files to save' };
    }

    set({ isSaving: true, saveError: null });

    try {
      const results = await Promise.all(
        dirtyFiles.map(f => writeFile(f.path, f.content))
      );

      const allSucceeded = results.every(r => r.success);

      if (allSucceeded) {
        const updatedFiles = openFiles.map(f => ({ ...f, isDirty: false }));
        set({ openFiles: updatedFiles, isSaving: false });
        return { success: true };
      } else {
        const errors = results.filter(r => !r.success).map(r => r.error);
        const errorMsg = `Some files failed to save: ${errors.join(', ')}`;
        set({ isSaving: false, saveError: errorMsg });
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      console.error('Error saving files:', error);
      set({ isSaving: false, saveError: error.message });
      return { success: false, error: error.message };
    }
  },

  getActiveFileContent: () => {
    const { openFiles, activeFile } = get();
    const file = openFiles.find(f => f.path === activeFile);
    return file ? file.content : '';
  },

  closeWorkspace: () => {
    set({
      currentWorkspace: null,
      workspacePath: null,
      files: [],
      openFiles: [],
      activeFile: null
    });
    localStorage.removeItem('workspacePath');
  }
}));

export default useWorkspaceStore;
