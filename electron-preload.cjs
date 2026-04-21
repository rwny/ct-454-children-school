// Preload script for Electron
// Provides safe bridge between main and renderer processes

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  
  // GPU info
  getGPUInfo: () => {
    return ipcRenderer.invoke('get-gpu-info');
  },
  
  // App version
  appVersion: process.env.npm_package_version || '0.0.0'
});

// Log that preload script has executed
console.log('Electron preload script loaded successfully');
console.log('GPU Acceleration enabled via command line switches');
