import { create } from 'zustand';

const useGitStore = create((set, get) => ({
  // Git status data
  isGitRepo: false,
  branch: null,
  ahead: 0,
  behind: 0,
  modified: [],
  created: [],
  deleted: [],
  renamed: [],
  conflicted: [],
  not_added: [],
  staged: [],
  files: [],

  // Loading state
  isLoading: false,
  error: null,

  // Workspace path
  workspacePath: null,

  /**
   * Set workspace path
   * @param {string} path - Workspace path
   */
  setWorkspacePath: (path) => {
    set({ workspacePath: path });
  },

  /**
   * Fetch git status
   * @param {string} workspacePath - Path to workspace
   */
  fetchGitStatus: async (workspacePath) => {
    if (!workspacePath) {
      console.warn('No workspace path provided for git status');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Check if it's a git repository
      const isRepo = await window.electronAPI.git.isGitRepository(workspacePath);

      if (!isRepo) {
        set({
          isGitRepo: false,
          isLoading: false,
          branch: null,
          files: [],
          modified: [],
          created: [],
          deleted: [],
          renamed: [],
          conflicted: [],
          not_added: [],
          staged: []
        });
        return;
      }

      // Get git status
      const result = await window.electronAPI.git.getStatus(workspacePath);

      if (result.success) {
        set({
          isGitRepo: true,
          branch: result.data.branch,
          ahead: result.data.ahead || 0,
          behind: result.data.behind || 0,
          modified: result.data.modified || [],
          created: result.data.created || [],
          deleted: result.data.deleted || [],
          renamed: result.data.renamed || [],
          conflicted: result.data.conflicted || [],
          not_added: result.data.not_added || [],
          staged: result.data.staged || [],
          files: result.data.files || [],
          isLoading: false,
          error: null
        });
      } else {
        set({
          isGitRepo: false,
          isLoading: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error fetching git status:', error);
      set({
        isGitRepo: false,
        isLoading: false,
        error: error.message || 'Failed to fetch git status'
      });
    }
  },

  /**
   * Get file diff
   * @param {string} filePath - Relative path to file
   * @returns {Promise<string|null>}
   */
  getFileDiff: async (filePath) => {
    const { workspacePath } = get();

    if (!workspacePath || !filePath) {
      return null;
    }

    try {
      const result = await window.electronAPI.git.getFileDiff(workspacePath, filePath);

      if (result.success) {
        return result.data;
      } else {
        console.error('Error getting file diff:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting file diff:', error);
      return null;
    }
  },

  /**
   * Get git log
   * @param {number} limit - Number of commits to fetch
   * @returns {Promise<array>}
   */
  getLog: async (limit = 10) => {
    const { workspacePath } = get();

    if (!workspacePath) {
      return [];
    }

    try {
      const result = await window.electronAPI.git.getLog(workspacePath, limit);

      if (result.success) {
        return result.data;
      } else {
        console.error('Error getting git log:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error getting git log:', error);
      return [];
    }
  },

  /**
   * Get file status by path
   * @param {string} filePath - Relative path to file
   * @returns {object|null} File status object
   */
  getFileStatus: (filePath) => {
    const { files } = get();
    return files.find(f => f.path === filePath) || null;
  },

  /**
   * Check if file is modified
   * @param {string} filePath - Relative path to file
   * @returns {boolean}
   */
  isFileModified: (filePath) => {
    const { modified, created, deleted, not_added } = get();
    return modified.includes(filePath) ||
           created.includes(filePath) ||
           deleted.includes(filePath) ||
           not_added.includes(filePath);
  },

  /**
   * Get status type for a file
   * @param {string} filePath - Relative path to file
   * @returns {string|null} Status type (M, A, D, ?, etc.)
   */
  getFileStatusType: (filePath) => {
    const { modified, created, deleted, not_added, renamed, conflicted, staged } = get();

    if (conflicted.includes(filePath)) return 'C';
    if (staged.includes(filePath)) return 'S';
    if (modified.includes(filePath)) return 'M';
    if (created.includes(filePath)) return 'A';
    if (deleted.includes(filePath)) return 'D';
    if (not_added.includes(filePath)) return '?';
    if (renamed.some(r => r.to === filePath)) return 'R';

    return null;
  },

  /**
   * Reset git state
   */
  reset: () => {
    set({
      isGitRepo: false,
      branch: null,
      ahead: 0,
      behind: 0,
      modified: [],
      created: [],
      deleted: [],
      renamed: [],
      conflicted: [],
      not_added: [],
      staged: [],
      files: [],
      isLoading: false,
      error: null,
      workspacePath: null
    });
  }
}));

export default useGitStore;
