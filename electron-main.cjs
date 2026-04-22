const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Enable High-Performance GPU
app.commandLine.appendSwitch('force_high_performance_gpu');

// Enable WebGPU
app.commandLine.appendSwitch('enable-features', 'WebGPU');

// Additional GPU optimizations
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Error logging to file
const logFile = path.join(__dirname, 'electron-error.log');
function logError(msg) {
  fs.appendFileSync(logFile, `${new Date().toISOString()}: ${msg}\n`);
}

process.on('uncaughtException', (err) => {
  logError(`Uncaught Exception: ${err.message}\n${err.stack}`);
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled Rejection: ${reason}`);
  app.quit();
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      // Enable WebGL and GPU acceleration
      webgl: true,
      experimentalFeatures: true
    },
    // Fullscreen options
    fullscreenable: true,
    // Remove frame for kiosk-like experience (optional)
    // frame: false,
    title: 'metta school',
    icon: path.join(__dirname, 'public', 'vite.svg')
  });

  // Load the built Vite app
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Development mode - load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - load built files
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log('Loading file from:', indexPath);
    mainWindow.loadFile(indexPath);
    // DevTools is disabled by default in production for a cleaner UI
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Log GPU info when ready
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded with GPU features enabled');
    mainWindow.webContents.executeJavaScript(`
      console.log('WebGPU Supported:', navigator.gpu !== undefined);
      console.log('WebGL2 Supported:', !!document.createElement('canvas').getContext('webgl2'));
    `);
  });
}

// App event handlers
app.whenReady().then(() => {
  logError('Electron starting with High-Performance GPU enabled...');
  try {
    createWindow();
  } catch (err) {
    logError(`Error creating window: ${err.message}\n${err.stack}`);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
