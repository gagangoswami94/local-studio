/**
 * Renderer-side IPC utilities
 * Wrapper functions for calling main process via electronAPI
 */

/**
 * Read file contents
 * @param {string} filepath - Absolute path to file
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
export async function readFile(filepath) {
  try {
    return await window.electronAPI.fs.readFile(filepath);
  } catch (error) {
    console.error('IPC readFile error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Write content to file
 * @param {string} filepath - Absolute path to file
 * @param {string} content - Content to write
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function writeFile(filepath, content) {
  try {
    return await window.electronAPI.fs.writeFile(filepath, content);
  } catch (error) {
    console.error('IPC writeFile error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Read directory contents (recursive)
 * @param {string} dirpath - Absolute path to directory
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
export async function readDirectory(dirpath) {
  try {
    return await window.electronAPI.fs.readDirectory(dirpath);
  } catch (error) {
    console.error('IPC readDirectory error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new file
 * @param {string} filepath - Absolute path to file
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function createFile(filepath) {
  try {
    return await window.electronAPI.fs.createFile(filepath);
  } catch (error) {
    console.error('IPC createFile error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new directory
 * @param {string} dirpath - Absolute path to directory
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function createDirectory(dirpath) {
  try {
    return await window.electronAPI.fs.createDirectory(dirpath);
  } catch (error) {
    console.error('IPC createDirectory error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a file
 * @param {string} filepath - Absolute path to file
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteFile(filepath) {
  try {
    return await window.electronAPI.fs.deleteFile(filepath);
  } catch (error) {
    console.error('IPC deleteFile error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a directory
 * @param {string} dirpath - Absolute path to directory
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteDirectory(dirpath) {
  try {
    return await window.electronAPI.fs.deleteDirectory(dirpath);
  } catch (error) {
    console.error('IPC deleteDirectory error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if path exists
 * @param {string} filepath - Absolute path
 * @returns {Promise<{success: boolean, data?: boolean, error?: string}>}
 */
export async function pathExists(filepath) {
  try {
    return await window.electronAPI.fs.pathExists(filepath);
  } catch (error) {
    console.error('IPC pathExists error:', error);
    return { success: false, error: error.message };
  }
}
