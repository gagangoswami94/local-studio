const fs = require('fs').promises;
const path = require('path');

/**
 * Read file contents
 * @param {string} filepath - Absolute path to file
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
async function readFile(filepath) {
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Write content to file
 * @param {string} filepath - Absolute path to file
 * @param {string} content - Content to write
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function writeFile(filepath, content) {
  try {
    await fs.writeFile(filepath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Read directory contents
 * @param {string} dirpath - Absolute path to directory
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
async function readDirectory(dirpath) {
  try {
    const entries = await fs.readdir(dirpath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      const fullPath = path.join(dirpath, entry.name);
      const item = {
        name: entry.name,
        path: fullPath,
        type: entry.isDirectory() ? 'directory' : 'file'
      };

      // Recursively read subdirectories
      if (entry.isDirectory()) {
        const subdirResult = await readDirectory(fullPath);
        if (subdirResult.success) {
          item.children = subdirResult.data;
        }
      }

      items.push(item);
    }

    return { success: true, data: items };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a new file
 * @param {string} filepath - Absolute path to file
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function createFile(filepath) {
  try {
    await fs.writeFile(filepath, '', 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a new directory
 * @param {string} dirpath - Absolute path to directory
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function createDirectory(dirpath) {
  try {
    await fs.mkdir(dirpath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a file
 * @param {string} filepath - Absolute path to file
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteFile(filepath) {
  try {
    await fs.unlink(filepath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a directory (recursively)
 * @param {string} dirpath - Absolute path to directory
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteDirectory(dirpath) {
  try {
    await fs.rm(dirpath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check if path exists
 * @param {string} filepath - Absolute path
 * @returns {Promise<{success: boolean, data?: boolean, error?: string}>}
 */
async function pathExists(filepath) {
  try {
    await fs.access(filepath);
    return { success: true, data: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: true, data: false };
    }
    return { success: false, error: error.message };
  }
}

module.exports = {
  readFile,
  writeFile,
  readDirectory,
  createFile,
  createDirectory,
  deleteFile,
  deleteDirectory,
  pathExists
};
