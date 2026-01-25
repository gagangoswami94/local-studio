const { ipcMain, BrowserWindow } = require('electron');
const fileSystem = require('./fileSystem');
const workspace = require('./workspace');
const terminal = require('./terminal');
const linter = require('./linter');

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

  // Terminal operations
  ipcMain.handle('terminal:create', async (event, options) => {
    console.log('IPC: Creating terminal');
    const result = terminal.createTerminal(options);

    if (result.success) {
      const terminalInstance = terminal.getTerminal(result.data.id);

      // Listen for terminal data and send to renderer
      terminalInstance.pty.onData((data) => {
        mainWindow.webContents.send('terminal:data', result.data.id, data);
      });

      // Handle terminal exit
      terminalInstance.pty.onExit(({ exitCode, signal }) => {
        console.log(`Terminal ${result.data.id} exited with code ${exitCode}`);
        mainWindow.webContents.send('terminal:exit', result.data.id, exitCode);
        terminal.destroyTerminal(result.data.id);
      });
    }

    return result;
  });

  ipcMain.handle('terminal:write', async (event, terminalId, data) => {
    return terminal.writeToTerminal(terminalId, data);
  });

  ipcMain.handle('terminal:resize', async (event, terminalId, cols, rows) => {
    return terminal.resizeTerminal(terminalId, cols, rows);
  });

  ipcMain.handle('terminal:destroy', async (event, terminalId) => {
    return terminal.destroyTerminal(terminalId);
  });

  // Linting operations
  ipcMain.handle('linter:lintFile', async (event, filepath, content) => {
    console.log('IPC: Linting file:', filepath);
    return await linter.lintFile(filepath, content);
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
  ipcMain.removeHandler('terminal:create');
  ipcMain.removeHandler('terminal:write');
  ipcMain.removeHandler('terminal:resize');
  ipcMain.removeHandler('terminal:destroy');
  ipcMain.removeHandler('linter:lintFile');

  // Cleanup all terminals
  terminal.cleanupAllTerminals();

  console.log('IPC handlers unregistered');
}

module.exports = {
  registerIpcHandlers,
  unregisterIpcHandlers
};
