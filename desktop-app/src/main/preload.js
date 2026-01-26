const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script - exposes safe IPC methods to renderer
 * Uses contextBridge for security with contextIsolation enabled
 */

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File System operations
  fs: {
    readFile: (filepath) => ipcRenderer.invoke('fs:readFile', filepath),
    writeFile: (filepath, content) => ipcRenderer.invoke('fs:writeFile', filepath, content),
    readDirectory: (dirpath) => ipcRenderer.invoke('fs:readDirectory', dirpath),
    createFile: (filepath) => ipcRenderer.invoke('fs:createFile', filepath),
    createDirectory: (dirpath) => ipcRenderer.invoke('fs:createDirectory', dirpath),
    deleteFile: (filepath) => ipcRenderer.invoke('fs:deleteFile', filepath),
    deleteDirectory: (dirpath) => ipcRenderer.invoke('fs:deleteDirectory', dirpath),
    pathExists: (filepath) => ipcRenderer.invoke('fs:pathExists', filepath)
  },

  // Workspace operations
  workspace: {
    showOpenDialog: () => ipcRenderer.invoke('workspace:showOpenDialog'),
    open: (path) => ipcRenderer.invoke('workspace:open', path)
  },

  // Terminal operations
  terminal: {
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    write: (terminalId, data) => ipcRenderer.invoke('terminal:write', terminalId, data),
    resize: (terminalId, cols, rows) => ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    destroy: (terminalId) => ipcRenderer.invoke('terminal:destroy', terminalId),
    onData: (callback) => ipcRenderer.on('terminal:data', (event, terminalId, data) => callback(terminalId, data)),
    onExit: (callback) => ipcRenderer.on('terminal:exit', (event, terminalId, exitCode) => callback(terminalId, exitCode)),
    removeDataListener: (callback) => ipcRenderer.removeListener('terminal:data', callback),
    removeExitListener: (callback) => ipcRenderer.removeListener('terminal:exit', callback)
  },

  // Linter operations
  linter: {
    lintFile: (filepath, content) => ipcRenderer.invoke('linter:lintFile', filepath, content)
  },

  // Search operations
  search: {
    searchFiles: (workspacePath, query, options) => ipcRenderer.invoke('search:searchFiles', workspacePath, query, options)
  }
});

console.log('Preload script loaded - electronAPI exposed');
