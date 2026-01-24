const { app, BrowserWindow } = require('electron');
const path = require('path');
const { registerIpcHandlers, unregisterIpcHandlers } = require('./ipc');

// Suppress security warnings in development
// Monaco Editor requires 'unsafe-eval' for web workers, which triggers warnings
// This warning won't appear in production builds
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true
    }
  });

  // Load the index.html from dist folder
  const indexPath = path.join(__dirname, '../../dist/index.html');
  mainWindow.loadFile(indexPath);

  // Open DevTools in development mode
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  // Register IPC handlers after window is created
  registerIpcHandlers(mainWindow);

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      registerIpcHandlers(mainWindow);
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup when app is quitting
app.on('will-quit', () => {
  unregisterIpcHandlers();
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
