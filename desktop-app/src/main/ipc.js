const { ipcMain, BrowserWindow } = require('electron');
const fileSystem = require('./fileSystem');
const workspace = require('./workspace');

/**
 * Register all IPC handlers
 * @param {BrowserWindow} mainWindow - Main window instance for dialogs
 */
function registerIpcHandlers(mainWindow) {
  // File operations
  ipcMain.handle('fs:readFile', async (event, filepath) => {
    console.log('IPC: Reading file:', filepath);
    return await fileSystem.readFile(filepath);
  });

  ipcMain.handle('fs:writeFile', async (event, filepath, content) => {
    console.log('IPC: Writing file:', filepath);
    return await fileSystem.writeFile(filepath, content);
  });

  ipcMain.handle('fs:readDirectory', async (event, dirpath) => {
    console.log('IPC: Reading directory:', dirpath);
    return await fileSystem.readDirectory(dirpath);
  });

  ipcMain.handle('fs:createFile', async (event, filepath) => {
    console.log('IPC: Creating file:', filepath);
    return await fileSystem.createFile(filepath);
  });

  ipcMain.handle('fs:createDirectory', async (event, dirpath) => {
    console.log('IPC: Creating directory:', dirpath);
    return await fileSystem.createDirectory(dirpath);
  });

  ipcMain.handle('fs:deleteFile', async (event, filepath) => {
    console.log('IPC: Deleting file:', filepath);
    return await fileSystem.deleteFile(filepath);
  });

  ipcMain.handle('fs:deleteDirectory', async (event, dirpath) => {
    console.log('IPC: Deleting directory:', dirpath);
    return await fileSystem.deleteDirectory(dirpath);
  });

  ipcMain.handle('fs:pathExists', async (event, filepath) => {
    console.log('IPC: Checking path exists:', filepath);
    return await fileSystem.pathExists(filepath);
  });

  // Workspace operations
  ipcMain.handle('workspace:showOpenDialog', async (event) => {
    console.log('IPC: Showing open dialog');
    return await workspace.showOpenDialog(mainWindow);
  });

  ipcMain.handle('workspace:open', async (event, path) => {
    console.log('IPC: Opening workspace:', path);
    return await workspace.openWorkspace(path);
  });

  console.log('IPC handlers registered');
}

/**
 * Unregister all IPC handlers (cleanup)
 */
function unregisterIpcHandlers() {
  ipcMain.removeHandler('fs:readFile');
  ipcMain.removeHandler('fs:writeFile');
  ipcMain.removeHandler('fs:readDirectory');
  ipcMain.removeHandler('fs:createFile');
  ipcMain.removeHandler('fs:createDirectory');
  ipcMain.removeHandler('fs:deleteFile');
  ipcMain.removeHandler('fs:deleteDirectory');
  ipcMain.removeHandler('fs:pathExists');
  ipcMain.removeHandler('workspace:showOpenDialog');
  ipcMain.removeHandler('workspace:open');

  console.log('IPC handlers unregistered');
}

module.exports = {
  registerIpcHandlers,
  unregisterIpcHandlers
};
