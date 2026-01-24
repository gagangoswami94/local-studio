import { create } from 'zustand';
import { readDirectory, readFile, writeFile } from '../utils/ipc';

const useWorkspaceStore = create((set, get) => ({
  // State
  currentWorkspace: null,
  workspacePath: localStorage.getItem('workspacePath') || null,
  files: [],
  openFiles: [], // Array of { path, name, content, isDirty }
  activeFile: null, // Path of currently active file
  isSaving: false, // true when saving
  saveError: null, // Error message if save fails

  // Actions
  openWorkspace: async (path) => {
    try {
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

        return { success: true };
      } else {
        console.error('Failed to load workspace:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error opening workspace:', error);
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

      return { success: true, content: result.data };
    } else {
      console.error('Failed to open file:', result.error);
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
    const { openFiles, activeFile } = get();
    const newOpenFiles = openFiles.filter(f => f.path !== filePath);

    let newActiveFile = activeFile;
    if (activeFile === filePath) {
      // Set active file to the last remaining open file, or null
      newActiveFile = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].path : null;
    }

    set({
      openFiles: newOpenFiles,
      activeFile: newActiveFile
    });
  },

  updateFileContent: (filePath, content) => {
    const { openFiles } = get();
    const updatedFiles = openFiles.map(f =>
      f.path === filePath
        ? { ...f, content, isDirty: true }
        : f
    );

    set({ openFiles: updatedFiles });
  },

  saveFile: async (filePath) => {
    const { openFiles } = get();
    const file = openFiles.find(f => f.path === filePath);

    if (!file) {
      set({ saveError: 'File not found in open files' });
      return { success: false, error: 'File not found in open files' };
    }

    set({ isSaving: true, saveError: null });

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
        return { success: true };
      } else {
        console.error('Failed to save file:', result.error);
        set({ isSaving: false, saveError: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving file:', error);
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
