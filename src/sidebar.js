import { toggleCCTV, togglePowerLines } from './facilities.js';
import { setFlyViewMode, setOrthographicAxis, setOrbitEnabled, getFlyViewState, applyDefaultViewState } from './flymode.js';
import { exportViewAsPNG } from './exportViewAsPng.js';
import { exportViewAsDxf } from './exportViewAsDxf.js';
import { exportBatchDxf } from './exportBatchDxf.js';

// Global variables for clipping planes
let yClippingPlane;
let yClippingPlaneBottom;
let xClippingPlane;
let xClippingPlaneBack;
let zClippingPlane;
let zClippingPlaneFront;
let activeClippingPlanes;
let allClippingPlanes;
let loadedPoints;
let currentActiveAxis = null;
let applyViewSectionAxisImpl = null;
let currentUiMode = 'advanced';
const UI_MODE_LOCK = 'advanced';

// Initialize the sidebar functionality
export function initSidebar(yPlane, yBottomPlane, xPlane, xBackPlane, zPlane, zFrontPlane, clippingPlanes, allPlanes, points) {
  yClippingPlane = yPlane;
  yClippingPlaneBottom = yBottomPlane;
  xClippingPlane = xPlane;
  xClippingPlaneBack = xBackPlane;
  zClippingPlane = zPlane;
  zClippingPlaneFront = zFrontPlane;
  // Initially only Y plane is active
  window.activeClippingPlanes = [yClippingPlane];
  allClippingPlanes = allPlanes;
  loadedPoints = points;
  
  // Set initial active axis to Y as requested
  currentActiveAxis = 'y';
  
  setupSidebarToggle();
  setupClippingControls();
  setupLayerControls();
  setupExportControl();
  
  // Make this module available globally so main.js can call setActiveAxis
  if (!window.sidebar) window.sidebar = {};
  window.sidebar.setActiveAxis = setActiveAxis;
  
  // Update clipping planes to apply initial state
  setTimeout(() => {
    window.updateClippingPlanes();
    // Ensure the material is updated after initialization
    if (loadedPoints) {
      loadedPoints.forEach(p => {
        p.material.needsUpdate = true;
      });
    }
  }, 100);  // Delay to ensure everything is initialized
}

// Function to set the active axis externally
function setActiveAxis(axis) {
  if (typeof applyViewSectionAxisImpl === 'function') {
    applyViewSectionAxisImpl(axis, { forceOrthographic: false, preserveValue: true });
    return;
  }
  currentActiveAxis = axis;
  if (axis === 'y') setOrthographicAxis('top');
  else if (axis === 'x') setOrthographicAxis('side');
  else if (axis === 'z') setOrthographicAxis('front');
  console.log(`Active axis set to: ${axis}`);
  window.updateClippingPlanes(); // Update when set externally
}

// Sidebar toggle functionality
function setupSidebarToggle() {
  const bindSidebarToggle = () => {
    const sidebar = document.getElementById('sidebar-info');
    const toggleButton = document.getElementById('sidebar-toggle');
    if (!sidebar || !toggleButton) return;
    if (toggleButton.dataset.bound === '1') return;
    toggleButton.dataset.bound = '1';

    const syncToggleIcon = () => {
      // Hidden -> show "<" (expand), visible -> show ">" (collapse)
      toggleButton.innerHTML = sidebar.classList.contains('sidebar-hidden') ? '&lt;' : '&gt;';
    };

    syncToggleIcon();
    toggleButton.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-hidden');
      syncToggleIcon();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSidebarToggle, { once: true });
  } else {
    bindSidebarToggle();
  }
}

// Clipping controls functionality (single active slider mapped to camera view)
function setupClippingControls() {
  // Active single slider elements
  const activeSlider = document.getElementById('active-clipping-slider');
  const activeInput = document.getElementById('active-clipping-input');
  const activeLabel = document.getElementById('active-axis-label');

  // Old sliders kept as references for compatibility
  const ySlider = document.getElementById('y-clipping-slider');
  const xSlider = document.getElementById('x-clipping-slider');
  const zSlider = document.getElementById('z-clipping-slider');
  const yInput = document.getElementById('y-clipping-input');
  const xInput = document.getElementById('x-clipping-input');
  const zInput = document.getElementById('z-clipping-input');

  // Get thickness elements
  const thicknessSlider = document.getElementById('slice-thickness-slider');
  const thicknessInput = document.getElementById('slice-thickness-input');
  const clipModeToggle = document.getElementById('clip-mode-toggle');

  // Point size slider
  const pointSizeSlider = document.getElementById('point-size-slider');

  function axisLabelName(axis) {
    return axis === 'y' ? 'Top' : axis === 'x' ? 'Side' : 'Front';
  }

  function getRanges() {
    return window.axisRanges || {
      x: { min: -15, max: 15 },
      y: { min: -0.5, max: 9 },
      z: { min: -9, max: 9 }
    };
  }

  function updateActiveSliderRange(axis, { preserveValue = false } = {}) {
    const ranges = getRanges();
    const r = ranges[axis] || { min: -15, max: 15 };
    const defaultValue = Math.min(r.max, Math.max(r.min, r.max / 2));
    if (activeSlider) {
      activeSlider.min = r.min;
      activeSlider.max = r.max;
      if (!preserveValue) activeSlider.value = defaultValue;
    }
    if (activeInput) {
      activeInput.min = r.min;
      activeInput.max = r.max;
      if (!preserveValue) activeInput.value = defaultValue;
    }
    if (preserveValue && activeSlider && activeInput) {
      const current = parseFloat(activeSlider.value);
      const clamped = Math.min(r.max, Math.max(r.min, current));
      activeSlider.value = clamped;
      activeInput.value = clamped;
    }
    if (activeLabel) activeLabel.textContent = axisLabelName(axis);
  }

  function getEffectiveAxis() {
    return currentActiveAxis || 'y';
  }

  function setActiveClipToAxisMax(axis) {
    const ranges = getRanges();
    const r = ranges[axis] || ranges.y;
    if (!r) return;
    if (activeSlider) activeSlider.value = r.max;
    if (activeInput) activeInput.value = r.max;
    if (activeLabel) activeLabel.textContent = axisLabelName(axis);
  }

  // Core update function: applies slider value to the mapped axis and updates materials
  window.updateClippingPlanes = function() {
    const axis = getEffectiveAxis();
    if (activeLabel) activeLabel.textContent = axisLabelName(axis);
    const val = activeSlider ? parseFloat(activeSlider.value) : (activeInput ? parseFloat(activeInput.value) : 0);
    const thickness = thicknessSlider ? parseFloat(thicknessSlider.value) : 0.5;
    const ranges = getRanges();
    const noClipMax = {
      x: ranges.x.max,
      y: ranges.y.max,
      z: ranges.z.max
    };
    const noClipBack = {
      x: -ranges.x.min,
      y: -ranges.y.min,
      z: -ranges.z.min
    };

    if (axis === 'y') {
      yClippingPlane.constant = val;
      xClippingPlane.constant = noClipMax.x;
      zClippingPlane.constant = noClipMax.z;
      if (xSlider) xSlider.value = noClipMax.x; if (zSlider) zSlider.value = noClipMax.z;
      if (xInput) xInput.value = noClipMax.x; if (zInput) zInput.value = noClipMax.z;
      if (xSlider) xSlider.disabled = true; if (zSlider) zSlider.disabled = true;
      if (xInput) xInput.disabled = true; if (zInput) zInput.disabled = true;
      console.log('Top clipping updated to:', val, ', Side and Front set to max');
    } else if (axis === 'x') {
      xClippingPlane.constant = val;
      yClippingPlane.constant = noClipMax.y;
      zClippingPlane.constant = noClipMax.z;
      if (ySlider) ySlider.value = noClipMax.y; if (zSlider) zSlider.value = noClipMax.z;
      if (yInput) yInput.value = noClipMax.y; if (zInput) zInput.value = noClipMax.z;
      if (ySlider) ySlider.disabled = true; if (zSlider) zSlider.disabled = true;
      if (yInput) yInput.disabled = true; if (zInput) zInput.disabled = true;
      console.log('Side clipping updated to:', val, ', Top and Front set to max');
    } else if (axis === 'z') {
      zClippingPlane.constant = val;
      xClippingPlane.constant = noClipMax.x;
      yClippingPlane.constant = noClipMax.y;
      if (xSlider) xSlider.value = noClipMax.x; if (ySlider) ySlider.value = noClipMax.y;
      if (xInput) xInput.value = noClipMax.x; if (yInput) yInput.value = noClipMax.y;
      if (xSlider) xSlider.disabled = true; if (ySlider) ySlider.disabled = true;
      if (xInput) xInput.disabled = true; if (yInput) yInput.disabled = true;
      console.log('Front clipping updated to:', val, ', Side and Top set to max');
    }

    // Slice vs section
    if (clipModeToggle && clipModeToggle.checked) {
      if (axis === 'y') {
        yClippingPlaneBottom.constant = -(yClippingPlane.constant - thickness);
        xClippingPlaneBack.constant = noClipBack.x;
        zClippingPlaneFront.constant = noClipBack.z;
        window.activeClippingPlanes = [yClippingPlane, yClippingPlaneBottom];
      } else if (axis === 'x') {
        xClippingPlaneBack.constant = -(xClippingPlane.constant - thickness);
        yClippingPlaneBottom.constant = noClipBack.y;
        zClippingPlaneFront.constant = noClipBack.z;
        window.activeClippingPlanes = [xClippingPlane, xClippingPlaneBack];
      } else if (axis === 'z') {
        zClippingPlaneFront.constant = -(zClippingPlane.constant - thickness);
        xClippingPlaneBack.constant = noClipBack.x;
        yClippingPlaneBottom.constant = noClipBack.y;
        window.activeClippingPlanes = [zClippingPlane, zClippingPlaneFront];
      }
    } else {
      if (axis === 'y') window.activeClippingPlanes = [yClippingPlane];
      else if (axis === 'x') window.activeClippingPlanes = [xClippingPlane];
      else if (axis === 'z') window.activeClippingPlanes = [zClippingPlane];
    }

    // Apply changes to point materials
    loadedPoints.forEach(p => {
      p.material.clippingPlanes = [...window.activeClippingPlanes];
      p.material.needsUpdate = true;
    });

    window.isSliceMode = clipModeToggle && clipModeToggle.checked;
  };

  // Initialize current active axis (default Y / top-down)
  setTimeout(() => {
    currentActiveAxis = currentActiveAxis || 'y';
    updateActiveSliderRange(getEffectiveAxis());
    window.updateClippingPlanes();
  }, 120);

  // Active slider listeners
  if (activeSlider && activeInput) {
    activeSlider.addEventListener('input', () => {
      activeInput.value = activeSlider.value;
      if (activeLabel) activeLabel.textContent = axisLabelName(getEffectiveAxis());
      window.updateClippingPlanes();
    });
    activeInput.addEventListener('input', () => {
      activeSlider.value = activeInput.value;
      if (activeLabel) activeLabel.textContent = axisLabelName(getEffectiveAxis());
      window.updateClippingPlanes();
    });
  }

  // Thickness listeners
  if (thicknessSlider && thicknessInput) {
    thicknessSlider.addEventListener('input', () => {
      thicknessInput.value = thicknessSlider.value;
      window.updateClippingPlanes();
    });
    thicknessInput.addEventListener('input', () => {
      thicknessSlider.value = thicknessInput.value;
      window.updateClippingPlanes();
    });
  }

  if (clipModeToggle) {
    clipModeToggle.addEventListener('change', () => {
      window.updateClippingPlanes();
      loadedPoints.forEach(p => { p.material.needsUpdate = true; });
    });
  }

  // Slice button toggles the hidden checkbox
  const clipModeToggleBtn = document.getElementById('clip-mode-toggle-btn');
  if (clipModeToggleBtn && clipModeToggle) {
    clipModeToggleBtn.addEventListener('click', () => {
      clipModeToggle.checked = !clipModeToggle.checked;
      clipModeToggle.dispatchEvent(new Event('change'));
      clipModeToggleBtn.style.background = clipModeToggle.checked ? '#2196F3' : '#444';
    });
  }

  const applyPointSize = () => {
    if (!pointSizeSlider || !loadedPoints) return;
    const size = parseFloat(pointSizeSlider.value);
    const cam = typeof window.getActiveCamera === 'function' ? window.getActiveCamera() : null;
    const isOrtho = !!(cam && cam.isOrthographicCamera);
    const scaledSize = isOrtho ? size * 10 : size;
    loadedPoints.forEach(p => {
      p.material.sizeAttenuation = !isOrtho;
      p.material.size = scaledSize;
      p.material.needsUpdate = true;
    });
  };

  if (pointSizeSlider) {
    pointSizeSlider.addEventListener('input', applyPointSize);
    pointSizeSlider.addEventListener('change', applyPointSize);
    // Apply initial size once on setup
    applyPointSize();
  }

  if (!window.sidebar) window.sidebar = {};
  window.sidebar.refreshPointSize = applyPointSize;

  // Color mode buttons (original / gradient / black)
  const colorOriginalBtn = document.getElementById('color-original-btn');
  const colorGradientBtn = document.getElementById('color-gradient-btn');
  const colorBlackBtn = document.getElementById('color-black-btn');
  const blackColorPickerWrap = document.getElementById('black-color-picker-wrap');
  const blackColorPicker = document.getElementById('black-color-picker');
  if (colorOriginalBtn && colorGradientBtn && colorBlackBtn) {
    const applyMode = (mode) => {
      colorOriginalBtn.classList.toggle('is-active', mode === 0);
      colorGradientBtn.classList.toggle('is-active', mode === 2);
      colorBlackBtn.classList.toggle('is-active', mode === 1);
      colorOriginalBtn.classList.toggle('is-off', mode !== 0);
      colorGradientBtn.classList.toggle('is-off', mode !== 2);
      colorBlackBtn.classList.toggle('is-off', mode !== 1);
      if (blackColorPickerWrap) {
        blackColorPickerWrap.style.display = mode === 1 ? 'flex' : 'none';
      }
    };

    if (!window.sidebar) window.sidebar = {};
    window.sidebar.updateColorModeUI = (mode) => {
      const normalizedMode = ((Math.round(mode) % 3) + 3) % 3;
      applyMode(normalizedMode);
    };

    const setColorMode = (mode) => {
      if (!window.animationUniforms) return;
      window.animationUniforms.uColorMode.value = mode;
      window.sidebar.updateColorModeUI(mode);
    };

    window.sidebar.updateColorModeUI(window.animationUniforms ? window.animationUniforms.uColorMode.value : 0);
    colorOriginalBtn.addEventListener('click', () => setColorMode(0));
    colorGradientBtn.addEventListener('click', () => setColorMode(2));
    colorBlackBtn.addEventListener('click', () => setColorMode(1));

    if (blackColorPicker) {
      // Default starts at black.
      blackColorPicker.value = '#000000';
      blackColorPicker.addEventListener('input', () => {
        if (!window.animationUniforms || !window.animationUniforms.uSolidColor) return;
        window.animationUniforms.uSolidColor.value.set(blackColorPicker.value);
      });
    }
  }

  // Axis selection buttons
  const yAxisBtn = document.getElementById('axis-y-btn');
  const xAxisBtn = document.getElementById('axis-x-btn');
  const zAxisBtn = document.getElementById('axis-z-btn');
  const perspectiveBtn = document.getElementById('cam-perspective-btn');
  const orthoBtn = document.getElementById('cam-ortho-btn');
  const orbitToggleBtn = document.getElementById('orbit-toggle-btn');
  const resetViewBtn = document.getElementById('reset-view-btn');
  const uiModeSimpleBtn = document.getElementById('ui-mode-simple-btn');
  const uiModeAdvancedBtn = document.getElementById('ui-mode-advanced-btn');

  function updateActiveAxisButtons() {
    if (yAxisBtn) yAxisBtn.classList.remove('active');
    if (xAxisBtn) xAxisBtn.classList.remove('active');
    if (zAxisBtn) zAxisBtn.classList.remove('active');
    if (currentActiveAxis === 'y' && yAxisBtn) yAxisBtn.classList.add('active');
    else if (currentActiveAxis === 'x' && xAxisBtn) xAxisBtn.classList.add('active');
    else if (currentActiveAxis === 'z' && zAxisBtn) zAxisBtn.classList.add('active');
  }

  function updateCameraModeButtons() {
    const state = getFlyViewState();
    if (perspectiveBtn) {
      perspectiveBtn.style.background = state.mode === 'perspective' ? '#2196F3' : '#444';
    }
    if (orthoBtn) {
      orthoBtn.style.background = state.mode === 'orthographic' ? '#2196F3' : '#444';
    }
    if (orbitToggleBtn) {
      orbitToggleBtn.textContent = state.orbitEnabled ? 'Free' : 'Lock';
      orbitToggleBtn.style.background = state.orbitEnabled ? '#2196F3' : '#444';
    }

  }

  function updateUiModeButtons() {
    if (uiModeSimpleBtn) uiModeSimpleBtn.classList.toggle('is-active', currentUiMode === 'simple');
    if (uiModeAdvancedBtn) uiModeAdvancedBtn.classList.toggle('is-active', currentUiMode === 'advanced');
  }

  function announceUiMode() {
    window.dispatchEvent(new CustomEvent('app-uimode-changed', {
      detail: { mode: currentUiMode }
    }));
  }

  function applyUiMode(mode, { emitEvent = true } = {}) {
    const requestedMode = mode === 'simple' ? 'simple' : 'advanced';
    currentUiMode = UI_MODE_LOCK || requestedMode;
    document.body.classList.toggle('ui-simple-mode', currentUiMode === 'simple');
    document.body.classList.toggle('ui-advanced-mode', currentUiMode === 'advanced');
    updateUiModeButtons();

    if (currentUiMode === 'simple') {
      setFlyViewMode('orthographic');
      setOrbitEnabled(false);
      const mappedAxis = currentActiveAxis || 'y';
      if (mappedAxis === 'y') setOrthographicAxis('top');
      else if (mappedAxis === 'x') setOrthographicAxis('side');
      else setOrthographicAxis('front');

      if (clipModeToggle && clipModeToggle.checked) {
        clipModeToggle.checked = false;
      }
      // In simple mode keep clipping open by default so the model never disappears.
      setActiveClipToAxisMax(mappedAxis);
    }

    updateCameraModeButtons();
    window.updateClippingPlanes();
    if (emitEvent) announceUiMode();
  }

  function applyViewSectionAxis(axis, { forceOrthographic = false, preserveValue = true } = {}) {
    currentActiveAxis = axis;
    if (forceOrthographic) {
      setFlyViewMode('orthographic');
    }
    if (axis === 'y') setOrthographicAxis('top');
    else if (axis === 'x') setOrthographicAxis('side');
    else setOrthographicAxis('front');
    updateActiveSliderRange(axis, { preserveValue });
    updateActiveAxisButtons();
    updateCameraModeButtons();
    window.updateClippingPlanes();
  }

  function applyCameraMode(mode) {
    if (mode === 'perspective') {
      setFlyViewMode('perspective');
    } else {
      setFlyViewMode('orthographic');
      const mappedAxis = currentActiveAxis || 'y';
      if (mappedAxis === 'y') setOrthographicAxis('top');
      else if (mappedAxis === 'x') setOrthographicAxis('side');
      else setOrthographicAxis('front');
    }
    updateActiveSliderRange(currentActiveAxis || 'y', { preserveValue: true });
    updateActiveAxisButtons();
    updateCameraModeButtons();
    window.updateClippingPlanes();
  }

  applyViewSectionAxisImpl = applyViewSectionAxis;

  // expose helper for main render loop compatibility
  if (!window.sidebar) window.sidebar = {};
  window.sidebar.updateActiveAxis = function() {
    updateCameraModeButtons();
  };
  window.sidebar.applyViewSectionAxis = applyViewSectionAxis;
  window.sidebar.applyCameraMode = applyCameraMode;
  window.sidebar.toggleCameraMode = function() {
    const state = getFlyViewState();
    applyCameraMode(state.mode === 'perspective' ? 'orthographic' : 'perspective');
  };
  window.sidebar.setUiMode = function(mode) {
    applyUiMode(mode, { emitEvent: true });
  };
  window.sidebar.getUiMode = function() {
    return currentUiMode;
  };
  window.sidebar.isSimpleUiMode = function() {
    return currentUiMode === 'simple';
  };

  if (yAxisBtn) {
    yAxisBtn.addEventListener('click', () => {
      applyViewSectionAxis('y', { preserveValue: true });
    });
  }
  if (xAxisBtn) {
    xAxisBtn.addEventListener('click', () => {
      applyViewSectionAxis('x', { preserveValue: true });
    });
  }
  if (zAxisBtn) {
    zAxisBtn.addEventListener('click', () => {
      applyViewSectionAxis('z', { preserveValue: true });
    });
  }

  if (perspectiveBtn) {
    perspectiveBtn.addEventListener('click', () => {
      applyCameraMode('perspective');
    });
  }

  if (orthoBtn) {
    orthoBtn.addEventListener('click', () => {
      applyCameraMode('orthographic');
    });
  }

  if (orbitToggleBtn) {
    orbitToggleBtn.addEventListener('click', () => {
      const state = getFlyViewState();
      setOrbitEnabled(!state.orbitEnabled);
      updateCameraModeButtons();
      window.updateClippingPlanes();
    });
  }

  if (resetViewBtn) {
    resetViewBtn.addEventListener('click', () => {
      applyDefaultViewState();
      currentActiveAxis = 'y';
      updateActiveSliderRange('y', { preserveValue: true });
      updateActiveAxisButtons();
      updateCameraModeButtons();
      window.updateClippingPlanes();
    });
  }

  if (uiModeSimpleBtn) {
    uiModeSimpleBtn.addEventListener('click', () => {
      applyUiMode('simple', { emitEvent: true });
    });
  }

  if (uiModeAdvancedBtn) {
    uiModeAdvancedBtn.addEventListener('click', () => {
      applyUiMode('advanced', { emitEvent: true });
    });
  }

  // initialize button states
  setTimeout(() => {
    applyUiMode(currentUiMode, { emitEvent: true });
    updateActiveAxisButtons();
    updateCameraModeButtons();
    window.updateClippingPlanes();
  }, 120);
}

// Layer controls functionality
function setupLayerControls() {
  const cctvBtn = document.getElementById('toggle-cctv');
  const powerBtn = document.getElementById('toggle-power');

  if (cctvBtn) {
    cctvBtn.addEventListener('click', () => {
      const active = toggleCCTV();
      cctvBtn.classList.toggle('active', active);
    });
  }

  if (powerBtn) {
    powerBtn.addEventListener('click', () => {
      const active = togglePowerLines();
      powerBtn.classList.toggle('active', active);
    });
  }
}

// Export control functionality (uses shared exporter)
function setupExportControl() {
  const bindExport = () => {
    const exportPngBtn = document.getElementById('export-png-btn');
    if (exportPngBtn) {
      exportPngBtn.addEventListener('click', () => {
        if (window.renderer && window.scene && typeof window.getActiveCamera === 'function') {
          exportViewAsPNG({ renderer: window.renderer, scene: window.scene, camera: window.getActiveCamera(), filename: `view-${Date.now()}.png` });
        }
      });
    }

    const exportDxfBtn = document.getElementById('export-dxf-btn');
    if (exportDxfBtn) {
      exportDxfBtn.addEventListener('click', () => {
        exportViewAsDxf({ camera: typeof window.getActiveCamera === 'function' ? window.getActiveCamera() : null });
      });
    }

    const exportBatchDxfBtn = document.getElementById('export-batch-dxf-btn');
    if (exportBatchDxfBtn) {
      exportBatchDxfBtn.addEventListener('click', () => {
        exportBatchDxf();
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindExport);
  } else {
    bindExport();
  }
} 

// test
