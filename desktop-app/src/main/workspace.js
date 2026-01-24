const { dialog } = require('electron');
const { readDirectory } = require('./fileSystem');

/**
 * Show open folder dialog and return selected path
 * @param {BrowserWindow} window - Main window instance
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
async function showOpenDialog(window) {
  try {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
      title: 'Select Workspace Folder'
    });

    if (result.canceled) {
      return { success: false, error: 'User canceled' };
    }

    return { success: true, data: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Open workspace and load directory structure
 * @param {string} path - Workspace path
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
async function openWorkspace(path) {
  try {
    // Load directory structure recursively
    const result = await readDirectory(path);

    if (result.success) {
      return {
        success: true,
        data: {
          path: path,
          files: result.data
        }
      };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  showOpenDialog,
  openWorkspace
};
