import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let perspectiveCamera, orthographicCamera, controls;
let viewMode = 'perspective'; // 'perspective' | 'orthographic'
let orthographicAxis = 'top'; // 'top' | 'bottom' | 'front' | 'back' | 'side' | 'left'
let orbitEnabled = true;
const DEFAULT_PERSPECTIVE_POSITION = new THREE.Vector3(-5.606254623613087, 4.773866224522836, 3.852110919530577);

const ORTHO_TARGET = new THREE.Vector3(0, 0, 0);
const ORTHO_PRESETS = {
  top: new THREE.Vector3(0, 30, 0),
  bottom: new THREE.Vector3(0, -30, 0),
  front: new THREE.Vector3(0, 0, 30),
  back: new THREE.Vector3(0, 0, -30),
  side: new THREE.Vector3(30, 0, 0),
  left: new THREE.Vector3(-30, 0, 0)
};

function getModelCenter() {
  const b = window.modelBounds;
  if (!b) return ORTHO_TARGET.clone();
  if (
    !Number.isFinite(b.minX) || !Number.isFinite(b.maxX) ||
    !Number.isFinite(b.minY) || !Number.isFinite(b.maxY) ||
    !Number.isFinite(b.minZ) || !Number.isFinite(b.maxZ)
  ) {
    return ORTHO_TARGET.clone();
  }
  return new THREE.Vector3(
    (b.minX + b.maxX) * 0.5,
    (b.minY + b.maxY) * 0.5,
    (b.minZ + b.maxZ) * 0.5
  );
}

function updateUiCameraMode() {
  const uiCameraMode = document.getElementById('ui-camera-mode');
  if (!uiCameraMode) return;
  if (viewMode === 'perspective') {
    uiCameraMode.textContent = 'Mode: Perspective';
    return;
  }
  const axisLabelMap = {
    top: 'Top',
    bottom: 'Bottom',
    front: 'Front',
    back: 'Back',
    side: 'Side',
    left: 'Left'
  };
  const axisLabel = axisLabelMap[orthographicAxis] || 'Top';
  uiCameraMode.textContent = `Mode: Ortho ${axisLabel}`;
}

function applyOrthographicAxisPreset() {
  const center = getModelCenter();
  const pos = ORTHO_PRESETS[orthographicAxis] || ORTHO_PRESETS.top;

  if (orthographicAxis === 'top' || orthographicAxis === 'bottom') {
    orthographicCamera.position.set(center.x, center.y + pos.y, center.z);
  } else if (orthographicAxis === 'front' || orthographicAxis === 'back') {
    orthographicCamera.position.set(center.x, center.y, center.z + pos.z);
  } else {
    orthographicCamera.position.set(center.x + pos.x, center.y, center.z);
  }

  controls.target.copy(center);
  orthographicCamera.lookAt(center);
  orthographicCamera.updateProjectionMatrix();
}

function getAxisDirection(axis) {
  if (axis === 'top') return new THREE.Vector3(0, 1, 0);
  if (axis === 'bottom') return new THREE.Vector3(0, -1, 0);
  if (axis === 'front') return new THREE.Vector3(0, 0, 1);
  if (axis === 'back') return new THREE.Vector3(0, 0, -1);
  if (axis === 'side') return new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3(-1, 0, 0);
}

function applyPerspectiveAxisPreset() {
  const center = getModelCenter();
  const direction = getAxisDirection(orthographicAxis);
  let distance = perspectiveCamera.position.distanceTo(controls.target);
  if (!Number.isFinite(distance) || distance < 0.001) distance = 30;

  perspectiveCamera.position.copy(center).addScaledVector(direction, distance);
  controls.target.copy(center);
  perspectiveCamera.lookAt(center);
  perspectiveCamera.updateProjectionMatrix();
}

function updateControlsConfig() {
  const isPerspective = viewMode === 'perspective';
  controls.object = isPerspective ? perspectiveCamera : orthographicCamera;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = orbitEnabled;

  if (!isPerspective && !orbitEnabled) {
    // Keep pure plan/elevation view locked when orbit is disabled.
    applyOrthographicAxisPreset();
  }

  updateUiCameraMode();
}

function getActiveCamera() {
  return viewMode === 'perspective' ? perspectiveCamera : orthographicCamera;
}

export function initFlyMode(renderer, scene) {
  perspectiveCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  perspectiveCamera.position.copy(DEFAULT_PERSPECTIVE_POSITION);
  perspectiveCamera.lookAt(0, 0, 0);

  orthographicCamera = new THREE.OrthographicCamera(
    window.innerWidth / -100, window.innerWidth / 100,
    window.innerHeight / 100, window.innerHeight / -100,
    0.1, 1000
  );

  controls = new OrbitControls(perspectiveCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.15;

  updateControlsConfig();

  return { perspectiveCamera, orthographicCamera, controls };
}

export function getFlyViewState() {
  return {
    mode: viewMode,
    orthographicAxis,
    orbitEnabled
  };
}

export function setFlyViewMode(mode) {
  if (mode !== 'perspective' && mode !== 'orthographic') return;
  viewMode = mode;
  updateControlsConfig();
}

export function setOrthographicAxis(axis) {
  if (
    axis !== 'top' &&
    axis !== 'bottom' &&
    axis !== 'front' &&
    axis !== 'back' &&
    axis !== 'side' &&
    axis !== 'left'
  ) return;
  orthographicAxis = axis;
  if (viewMode === 'orthographic') {
    applyOrthographicAxisPreset();
  } else {
    applyPerspectiveAxisPreset();
  }
  updateUiCameraMode();
}

export function setOrbitEnabled(enabled) {
  orbitEnabled = !!enabled;
  updateControlsConfig();
}

export function applyDefaultViewState() {
  orthographicAxis = 'top';
  setFlyViewMode('perspective');
  setOrbitEnabled(true);
  const center = getModelCenter();
  perspectiveCamera.position.copy(DEFAULT_PERSPECTIVE_POSITION);
  controls.target.copy(center);
  perspectiveCamera.quaternion.set(-0.2665690440943008, -0.44403782940935216, -0.14026857628332925, 0.8438578537239134);
  controls.update();
  perspectiveCamera.updateProjectionMatrix();
  console.log('Default view state applied with custom quaternion');
}

export function toggleOrbitEnabled() {
  setOrbitEnabled(!orbitEnabled);
}

export function switchToFlyMode(renderer, forcePerspective = false) {
  if (forcePerspective) viewMode = 'perspective';
  updateControlsConfig();
  controls.enabled = true;

  renderer.localClippingEnabled = true;
  renderer.clippingPlanes = window.activeClippingPlanes || [];

  const sectionBar = document.getElementById('section-bar-container');
  const pointSizeControl = document.getElementById('point-size-control');
  const clippingSettings = document.getElementById('clipping-settings');
  if (sectionBar) sectionBar.style.display = 'block';
  if (pointSizeControl) pointSizeControl.style.display = 'block';
  if (clippingSettings) clippingSettings.style.display = 'block';

  return getActiveCamera();
}

export function handleFlyKeyDown(event) {
  switch (event.code) {
    case 'Numpad5':
      setFlyViewMode(viewMode === 'perspective' ? 'orthographic' : 'perspective');
      event.preventDefault();
      break;
    case 'Numpad7':
      setFlyViewMode('orthographic');
      setOrthographicAxis('top');
      event.preventDefault();
      break;
    case 'Numpad1':
      setFlyViewMode('orthographic');
      setOrthographicAxis('front');
      event.preventDefault();
      break;
    case 'Numpad3':
      setFlyViewMode('orthographic');
      setOrthographicAxis('side');
      event.preventDefault();
      break;
    case 'Numpad0':
      setFlyViewMode('perspective');
      event.preventDefault();
      break;
    case 'NumpadAdd':
      zoomCamera(1);
      event.preventDefault();
      break;
    case 'NumpadSubtract':
      zoomCamera(-1);
      event.preventDefault();
      break;
    case 'Numpad9':
      if (orbitEnabled) {
        rotateYAxis180();
        event.preventDefault();
      }
      break;
    case 'Numpad8':
      panCameraInDirection('up');
      event.preventDefault();
      break;
    case 'Numpad2':
      panCameraInDirection('down');
      event.preventDefault();
      break;
    case 'Numpad4':
      panCameraInDirection('left');
      event.preventDefault();
      break;
    case 'Numpad6':
      panCameraInDirection('right');
      event.preventDefault();
      break;
  }
}

function mapPresetToOrthoAxis(presetName) {
  if (presetName === 'top') return 'top';
  if (presetName === 'bottom') return 'bottom';
  if (presetName === 'front') return 'front';
  if (presetName === 'back') return 'back';
  if (presetName === 'right') return 'side';
  if (presetName === 'left') return 'left';
  return null;
}

function applyCameraPreset(presetName) {
  if (presetName === 'perspective') {
    setFlyViewMode('perspective');
    return;
  }

  const orthoAxis = mapPresetToOrthoAxis(presetName);
  if (orthoAxis) {
    setFlyViewMode('orthographic');
    setOrthographicAxis(orthoAxis);
    return;
  }

  if (presetName === 'axonometric' || presetName === 'isometric') {
    setFlyViewMode('orthographic');
    setOrthographicAxis('top');
  }
}

export function applyCameraPresetExternally(presetName) {
  applyCameraPreset(presetName);
}

function rotateYAxis180() {
  const currentCam = getActiveCamera();
  currentCam.position.x = -currentCam.position.x;
  currentCam.position.z = -currentCam.position.z;
  currentCam.lookAt(ORTHO_TARGET);
  controls.target.copy(ORTHO_TARGET);
  currentCam.updateProjectionMatrix();
}

function panCameraInDirection(direction) {
  const currentCam = getActiveCamera();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  currentCam.updateMatrixWorld();
  currentCam.matrixWorld.extractBasis(right, up, new THREE.Vector3());

  let panDistance = 1;
  if (currentCam.isOrthographicCamera) {
    panDistance = (currentCam.top - currentCam.bottom) * 0.08;
  } else {
    panDistance = currentCam.position.distanceTo(controls.target) * 0.08;
  }

  const offset = new THREE.Vector3();
  if (direction === 'up') offset.copy(up).multiplyScalar(panDistance);
  if (direction === 'down') offset.copy(up).multiplyScalar(-panDistance);
  if (direction === 'left') offset.copy(right).multiplyScalar(-panDistance);
  if (direction === 'right') offset.copy(right).multiplyScalar(panDistance);

  currentCam.position.add(offset);
  controls.target.add(offset);
  currentCam.lookAt(controls.target);
  currentCam.updateProjectionMatrix();
}

function zoomCamera(distance) {
  if (viewMode === 'orthographic') {
    const zoomFactor = distance > 0 ? 0.9 : 1.1;
    orthographicCamera.left *= zoomFactor;
    orthographicCamera.right *= zoomFactor;
    orthographicCamera.top *= zoomFactor;
    orthographicCamera.bottom *= zoomFactor;
    orthographicCamera.updateProjectionMatrix();
  } else {
    const direction = new THREE.Vector3().subVectors(controls.target, perspectiveCamera.position).normalize();
    perspectiveCamera.position.add(direction.multiplyScalar(distance));
    perspectiveCamera.updateProjectionMatrix();
  }
}
