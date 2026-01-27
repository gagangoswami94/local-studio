const { dialog } = require('electron');
const { readDirectory } = require('./fileSystem');
const path = require('path');

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

/**
 * List all files recursively in workspace
 * @param {string} workspacePath - Workspace root path
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
async function listAllFiles(workspacePath) {
  try {
    const files = [];

    // Helper function to recursively collect files
    const collectFiles = async (dirPath, relativePath = '') => {
      const result = await readDirectory(dirPath);

      if (!result.success) {
        return;
      }

      for (const item of result.data) {
        const itemRelativePath = relativePath ? path.join(relativePath, item.name) : item.name;
        const itemFullPath = path.join(workspacePath, itemRelativePath);

        if (item.type === 'file') {
          // Add file
          files.push({
            name: item.name,
            path: itemFullPath,
            relativePath: itemRelativePath,
            size: item.size || 0
          });
        } else if (item.type === 'directory') {
          // Skip common directories that shouldn't be included
          const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage'];
          if (!skipDirs.includes(item.name)) {
            await collectFiles(itemFullPath, itemRelativePath);
          }
        }
      }
    };

    await collectFiles(workspacePath);

    // Sort files by path
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    return { success: true, data: files };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  showOpenDialog,
  openWorkspace,
  listAllFiles
};
