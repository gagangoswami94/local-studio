import { create } from 'zustand';

const useSnapshotStore = create((set, get) => ({
  // State
  snapshots: [],
  isLoading: false,
  isCreating: false,
  isRestoring: false,
  error: null,
  workspacePath: null,

  /**
   * Set workspace path
   * @param {string} path - Workspace path
   */
  setWorkspacePath: (path) => {
    set({ workspacePath: path });
  },

  /**
   * Load snapshots for workspace
   * @param {string} workspacePath - Path to workspace
   */
  loadSnapshots: async (workspacePath) => {
    if (!workspacePath) {
      console.warn('No workspace path provided for loading snapshots');
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.snapshots.list(workspacePath);

      if (result.success) {
        set({
          snapshots: result.data || [],
          isLoading: false,
          error: null
        });
      } else {
        set({
          snapshots: [],
          isLoading: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error loading snapshots:', error);
      set({
        snapshots: [],
        isLoading: false,
        error: error.message || 'Failed to load snapshots'
      });
    }
  },

  /**
   * Create a new snapshot
   * @param {string} workspacePath - Path to workspace
   * @param {string} description - Description of the snapshot
   * @returns {Promise<boolean>} Success status
   */
  createSnapshot: async (workspacePath, description = '') => {
    if (!workspacePath) {
      console.warn('No workspace path provided for creating snapshot');
      return false;
    }

    set({ isCreating: true, error: null });

    try {
      const result = await window.electronAPI.snapshots.create(workspacePath, description);

      if (result.success) {
        // Reload snapshots to include the new one
        await get().loadSnapshots(workspacePath);
        set({ isCreating: false, error: null });
        return true;
      } else {
        set({
          isCreating: false,
          error: result.error
        });
        return false;
      }
    } catch (error) {
      console.error('Error creating snapshot:', error);
      set({
        isCreating: false,
        error: error.message || 'Failed to create snapshot'
      });
      return false;
    }
  },

  /**
   * Restore a snapshot
   * @param {string} workspacePath - Path to workspace
   * @param {string} snapshotId - ID of snapshot to restore
   * @returns {Promise<boolean>} Success status
   */
  restoreSnapshot: async (workspacePath, snapshotId) => {
    if (!workspacePath || !snapshotId) {
      console.warn('Workspace path and snapshot ID required for restore');
      return false;
    }

    set({ isRestoring: true, error: null });

    try {
      const result = await window.electronAPI.snapshots.restore(workspacePath, snapshotId);

      if (result.success) {
        // Reload snapshots after restore
        await get().loadSnapshots(workspacePath);
        set({ isRestoring: false, error: null });
        return true;
      } else {
        set({
          isRestoring: false,
          error: result.error
        });
        return false;
      }
    } catch (error) {
      console.error('Error restoring snapshot:', error);
      set({
        isRestoring: false,
        error: error.message || 'Failed to restore snapshot'
      });
      return false;
    }
  },

  /**
   * Delete a snapshot
   * @param {string} workspacePath - Path to workspace
   * @param {string} snapshotId - ID of snapshot to delete
   * @returns {Promise<boolean>} Success status
   */
  deleteSnapshot: async (workspacePath, snapshotId) => {
    if (!workspacePath || !snapshotId) {
      console.warn('Workspace path and snapshot ID required for delete');
      return false;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await window.electronAPI.snapshots.delete(workspacePath, snapshotId);

      if (result.success) {
        // Reload snapshots after delete
        await get().loadSnapshots(workspacePath);
        return true;
      } else {
        set({
          isLoading: false,
          error: result.error
        });
        return false;
      }
    } catch (error) {
      console.error('Error deleting snapshot:', error);
      set({
        isLoading: false,
        error: error.message || 'Failed to delete snapshot'
      });
      return false;
    }
  },

  /**
   * Reset snapshot state
   */
  reset: () => {
    set({
      snapshots: [],
      isLoading: false,
      isCreating: false,
      isRestoring: false,
      error: null,
      workspacePath: null
    });
  }
}));

export default useSnapshotStore;
