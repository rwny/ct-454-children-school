# Guide: Building Electron + Express with GPU Acceleration

This guide outlines the steps to bundle an **Express Backend** and **Vite/Three.js Frontend** into a standalone desktop application (.exe) with a focus on **GPU Hardware Acceleration** and **WebGPU** support.

---

## 1. Electron Main Process Configuration (GPU Focus)

To ensure maximum performance and utilize the discrete (dedicated) GPU, add the following flags to your Electron main file (e.g., `electron-main.cjs`):

```javascript
const { app, BrowserWindow } = require('electron');

// --- CRITICAL FLAGS FOR GPU PERFORMANCE ---
// Force the use of the high-performance (Discrete) GPU
app.commandLine.appendSwitch('force_high_performance_gpu');

// Enable WebGPU features for modern 3D rendering
app.commandLine.appendSwitch('enable-features', 'WebGPU');

// (Optional) Disable frame rate limits for maximum smoothness (V-Sync Off)
// app.commandLine.appendSwitch('disable-frame-rate-limit');

// Disable software rendering and force hardware acceleration
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
// ------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true, // Enable if running Express inside the main process
      contextIsolation: false,
      backgroundThrottling: false, // Prevents performance drops when window is inactive
    }
  });
  // ... Load file or URL ...
}
```

---

## 2. Integrating Express with Electron

If your application requires a local backend server, start the Express server when Electron is ready:

```javascript
const express = require('express');
const server = express();
const PORT = 3000;

server.get('/api', (req, res) => res.json({ status: 'Express with GPU Support Active' }));

// Start Express when the app is ready
app.whenReady().then(() => {
  server.listen(PORT, () => {
    console.log(`Internal Server running at http://localhost:${PORT}`);
    createWindow();
  });
});
```

---

## 3. Optimizing the Frontend (Three.js)

To leverage the GPU fully within your 3D viewer:

1.  **Use WebGPU (Three.js v0.160+):**
    Transition from `THREE.WebGLRenderer` to `WebGPURenderer` if you want to utilize the latest rendering technology.
2.  **Renderer Hints:**
    ```javascript
    const renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: true, 
      powerPreference: 'high-performance' // Hints the browser/Electron to use the best GPU
    });
    ```

---

## 4. Packaging the Application (.exe)

We use `electron-packager` for Windows builds to ensure stability and avoid permission issues common with symbolic links.

### Install Tooling:
```bash
npm install --save-dev electron-packager
```

### Build Command:
```bash
npx electron-packager . "Benjama-School" --platform=win32 --arch=x64 --out=dist_electron --overwrite --ignore="dist_electron|node_modules"
```

---

## 5. Deployment & Best Practices

- **GPU Drivers:** Ensure the target machine has updated GPU drivers for WebGPU and Hardware Acceleration to function correctly.
- **Distribution:** Always distribute the **entire folder** generated in `dist_electron` (not just the .exe file), as it contains essential .dll and resource files.
- **Relative Paths:** Ensure all frontend asset loading uses **Relative Paths** (e.g., `assets/model.ply`) instead of Absolute Paths (e.g., `/assets/model.ply`) to support the `file://` protocol.

---
*Generated for the Benjamarachutit School - 3D Point Cloud Viewer Project*
