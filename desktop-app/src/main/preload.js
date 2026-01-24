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
  }
});

console.log('Preload script loaded - electronAPI exposed');
