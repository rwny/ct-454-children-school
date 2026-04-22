import './style.css'
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js';
import { initFlyMode, switchToFlyMode, handleFlyKeyDown, applyDefaultViewState, setFlyViewMode, setOrthographicAxis, setOrbitEnabled, getFlyViewState } from './flymode.js';
import { initWalkMode, switchToWalkMode, handleWalkKeyDown, handleWalkKeyUp, updateWalkMode, exitWalkMode } from './walkmode.js';
import { initFacilities } from './facilities.js';
import { initSidebar } from './sidebar.js';
import { createAnimationShader, setDistanceAnimation, setYAnimation, initAnimationUniforms } from './shaderTransitions.js';
import { loadPointCloudModels } from './plyLoader.js';

// Setup Scene
const scene = new THREE.Scene();

// Initialize animation uniforms
const animationUniforms = initAnimationUniforms();
window.animationUniforms = animationUniforms;  // Make animation uniforms available globally
let isAnimatingReveal = false;
let animationStartTime = 0;
const frameClock = new THREE.Clock();
let viewHelper = null;
let viewHelperCamera = null;
const VISIBLE_COLOR_SAMPLE_MAX = 30000;
const VISIBLE_COLOR_UPDATE_INTERVAL_MS = 250;
let lastVisibleColorUpdateTs = 0;
let lastVisibleColorSignature = '';
const colorRangeTempWorld = new THREE.Vector3();
const colorRangeTempFrustum = new THREE.Frustum();
const colorRangeTempProjScreenMatrix = new THREE.Matrix4();
let panModeEnabled = false;
let quickControlsRoot = null;
let quickPanBtn = null;
let quickCameraModeBtn = null;
let quickLockBtn = null;

const axesHelper = new THREE.AxesHelper(1);
scene.add(axesHelper);

const originMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.04, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
originMarker.position.set(0, 0, 0);
scene.add(originMarker);

// Clipping Planes
const yClippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 2.4);  // Y plane facing down, initially at value 2.40
const yClippingPlaneBottom = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Bottom plane for slice
const xClippingPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 15);  // X plane facing left, initially at max (no clipping)
const xClippingPlaneBack = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0); // X plane facing right
const zClippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 9);  // Z plane facing back, initially at max (no clipping)
const zClippingPlaneFront = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // Z plane facing front

// Track which clipping mode is active
let activeClippingMode = 'y'; // 'y', 'x', or 'z'

// Initialize with Y clipping active
window.yClippingPlane = yClippingPlane;
window.yClippingPlaneBottom = yClippingPlaneBottom;
window.xClippingPlane = xClippingPlane;
window.xClippingPlaneBack = xClippingPlaneBack;
window.zClippingPlane = zClippingPlane;
window.zClippingPlaneFront = zClippingPlaneFront;

window.activeClippingPlanes = [yClippingPlane, xClippingPlane, zClippingPlane];

// Store all planes for reference
window.allPlanes = [yClippingPlane, yClippingPlaneBottom, xClippingPlane, xClippingPlaneBack, zClippingPlane, zClippingPlaneFront];

// Store all clipping planes for easy access
window.allClippingPlanes = {
  y: [yClippingPlane],
  ySlice: [yClippingPlane, yClippingPlaneBottom],
  x: [xClippingPlane],
  xSlice: [xClippingPlane, xClippingPlaneBack],
  z: [zClippingPlane],
  zSlice: [zClippingPlane, zClippingPlaneFront]
};

// Renderer with GPU optimizations
const renderer = new THREE.WebGLRenderer({ 
  antialias: true, 
  alpha: true, 
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',  // Request high-performance GPU
  stencil: false,                       // Disable stencil buffer if not needed
  depth: true                           // Enable depth buffer
});

// GPU Performance optimizations
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
renderer.localClippingEnabled = true; // Important!

// Additional GPU optimizations
renderer.sortObjects = false;  // Disable object sorting for better performance with point clouds
renderer.autoClear = true;

// Log GPU info
console.log('Three.js Renderer initialized with high-performance GPU settings');
console.log('WebGL Context:', renderer.getContext().getParameter(renderer.getContext().VERSION));
console.log('GPU Vendor:', renderer.getContext().getParameter(renderer.getContext().VENDOR));
console.log('Renderer:', renderer.getContext().getParameter(renderer.getContext().RENDERER));
document.getElementById('app').appendChild(renderer.domElement);

async function initVersionBadge() {
  const badge = document.createElement('div');
  badge.id = 'app-version-badge';
  badge.textContent = 'v0.0.0';
  document.body.appendChild(badge);

  try {
    const response = await fetch('./version.txt', { cache: 'no-store' });
    if (!response.ok) return;
    const version = (await response.text()).trim();
    if (version) badge.textContent = version;
  } catch (error) {
    console.warn('Unable to load version.txt', error);
  }
}

// Point picking (click -> nearest point -> show XYZ at mouse position)
const raycaster = new THREE.Raycaster();
const BASE_PICK_THRESHOLD = 0.08;
const PICK_RADIUS_PX = 8;
const MEASUREMENT_SCALE = 1.0; // Global multiplier for level and distance values.
const PICK_FRONT_LAYER_TOLERANCE_M = 0.25;
const PICK_SEARCH_OFFSETS = [
  [0, 0],
  [4, 0], [-4, 0], [0, 4], [0, -4],
  [8, 0], [-8, 0], [0, 8], [0, -8]
];
const PICK_SEARCH_OFFSETS_CLIPPED = [
  [0, 0],
  [2, 0], [-2, 0], [0, 2], [0, -2]
];
const CLIP_VISIBILITY_EPS = 1e-4;
const pointerNdc = new THREE.Vector2();
const pickedPointWorld = new THREE.Vector3();
const tempPickedWorld = new THREE.Vector3();
const originWorldPos = new THREE.Vector3(0, 0, 0);
const originScreenPos = new THREE.Vector3();
const levelScreenPos = new THREE.Vector3();
const levelWorldPos = new THREE.Vector3();
const distanceMidWorldPos = new THREE.Vector3();
const distanceMidScreenPos = new THREE.Vector3();
const distanceDirection = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);
const measurePointA = new THREE.Vector3();
const measurePointB = new THREE.Vector3();
let pendingMeasurePoint = 'A';
let measureMode = 'level';
let hasLevelPick = false;
let hasDistancePair = false;
let measurementUnit = 'cm';
let lastLevelMeters = null;
let lastDistanceMeters = null;
const levelPointLabel = document.createElement('div');
levelPointLabel.className = 'point-position-label';
levelPointLabel.style.display = 'none';
document.body.appendChild(levelPointLabel);
const distancePointLabel = document.createElement('div');
distancePointLabel.className = 'point-position-label';
distancePointLabel.style.display = 'none';
document.body.appendChild(distancePointLabel);
const selectedPointMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x1e6fff })
);
selectedPointMarker.visible = false;
scene.add(selectedPointMarker);
const pointAMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x1e6fff })
);
pointAMarker.visible = false;
scene.add(pointAMarker);
const pointBMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x1e6fff })
);
pointBMarker.visible = false;
scene.add(pointBMarker);
const distanceLine = new THREE.Mesh(
  new THREE.CylinderGeometry(0.03, 0.03, 1, 16),
  new THREE.MeshBasicMaterial({
    color: 0xff2d2d,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.95
  })
);
distanceLine.renderOrder = 998;
distanceLine.visible = false;
distanceLine.frustumCulled = false;
scene.add(distanceLine);

function getPickedPointWorld(intersection, target) {
  const idx = intersection.index;
  const object = intersection.object;
  if (idx == null || !object || !object.geometry || !object.geometry.attributes.position) return false;
  const pos = object.geometry.attributes.position;
  target.set(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
  object.localToWorld(target);
  return true;
}

function updatePickThresholdForCamera(camera) {
  const canvasHeight = renderer.domElement.clientHeight || window.innerHeight || 1;
  if (camera && camera.isPerspectiveCamera) {
    const referenceDistance = camera.position.length() || 1;
    const worldPerPixel = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * referenceDistance) / canvasHeight;
    raycaster.params.Points.threshold = Math.max(BASE_PICK_THRESHOLD, worldPerPixel * PICK_RADIUS_PX);
    return;
  }
  if (camera && camera.isOrthographicCamera) {
    const worldPerPixel = (camera.top - camera.bottom) / (camera.zoom * canvasHeight);
    raycaster.params.Points.threshold = Math.max(BASE_PICK_THRESHOLD, worldPerPixel * PICK_RADIUS_PX);
    return;
  }
  raycaster.params.Points.threshold = BASE_PICK_THRESHOLD;
}

function isPointVisibleWithClipping(worldPos) {
  const planes = window.activeClippingPlanes || [];
  if (!planes.length) return true;
  for (let i = 0; i < planes.length; i++) {
    if (planes[i].distanceToPoint(worldPos) < -CLIP_VISIBILITY_EPS) return false;
  }
  return true;
}

function findBestVisibleIntersection(intersections, outWorldPos) {
  let minDistance = Infinity;

  // Pass 1: find nearest visible depth without allocating temp objects.
  for (let i = 0; i < intersections.length; i++) {
    const hit = intersections[i];
    if (!getPickedPointWorld(hit, tempPickedWorld)) continue;
    if (!isPointVisibleWithClipping(tempPickedWorld)) continue;
    const hitDistance = hit.distance ?? Infinity;
    if (hitDistance < minDistance) minDistance = hitDistance;
  }

  if (!Number.isFinite(minDistance)) return null;

  const frontLayerTolerance = Math.max(
    PICK_FRONT_LAYER_TOLERANCE_M,
    (raycaster.params.Points.threshold || BASE_PICK_THRESHOLD) * 2.5
  );
  const maxFrontDistance = minDistance + frontLayerTolerance;

  // Pass 2: pick best by cursor metric inside the nearest depth window.
  let bestHit = null;
  let bestDistanceToRay = Infinity;
  let bestDistance = Infinity;
  for (let i = 0; i < intersections.length; i++) {
    const hit = intersections[i];
    if (!getPickedPointWorld(hit, tempPickedWorld)) continue;
    if (!isPointVisibleWithClipping(tempPickedWorld)) continue;

    const candidate = {
      distance: hit.distance ?? Infinity,
      distanceToRay: hit.distanceToRay ?? Infinity
    };
    if (candidate.distance > maxFrontDistance) continue;

    const betterByRay = candidate.distanceToRay < bestDistanceToRay - 1e-6;
    const tieByRay = Math.abs(candidate.distanceToRay - bestDistanceToRay) <= 1e-6;
    const betterByDepth = candidate.distance < bestDistance;
    if (betterByRay || (tieByRay && betterByDepth)) {
      bestHit = hit;
      bestDistanceToRay = candidate.distanceToRay;
      bestDistance = candidate.distance;
      outWorldPos.copy(tempPickedWorld);
    }
  }

  if (!bestHit) {
    // Fallback: choose the nearest depth hit if the front-layer window ended up empty.
    for (let i = 0; i < intersections.length; i++) {
      const hit = intersections[i];
      if (!getPickedPointWorld(hit, tempPickedWorld)) continue;
      if (!isPointVisibleWithClipping(tempPickedWorld)) continue;
      const hitDistance = hit.distance ?? Infinity;
      if (hitDistance < bestDistance) {
        bestHit = hit;
        bestDistance = hitDistance;
        outWorldPos.copy(tempPickedWorld);
      }
    }
  }

  return bestHit;
}

function pickPointAtClientPos(clientX, clientY, camera, targetWorld = pickedPointWorld) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const intersections = raycaster.intersectObjects(window.loadedPoints, false);
  return findBestVisibleIntersection(intersections, targetWorld);
}

function pickNearestPointAroundClientPos(clientX, clientY, camera, targetWorld = pickedPointWorld) {
  const offsets = isClipEffectivelyEngaged() ? PICK_SEARCH_OFFSETS_CLIPPED : PICK_SEARCH_OFFSETS;
  let nearest = null;
  for (let i = 0; i < offsets.length && !nearest; i++) {
    const offset = offsets[i];
    nearest = pickPointAtClientPos(clientX + offset[0], clientY + offset[1], camera, targetWorld);
  }
  return nearest;
}

function isClipEffectivelyEngaged() {
  const ranges = window.axisRanges;
  if (!ranges) return false;
  const eps = 1e-5;
  const yEngaged = yClippingPlane.constant < ranges.y.max - eps;
  const xEngaged = xClippingPlane.constant < ranges.x.max - eps;
  const zEngaged = zClippingPlane.constant < ranges.z.max - eps;
  return yEngaged || xEngaged || zEngaged || !!window.isSliceMode;
}

function updateDistanceLineBetween(pointA, pointB) {
  distanceDirection.copy(pointB).sub(pointA);
  const distanceLength = distanceDirection.length();
  distanceMidWorldPos.copy(pointA).add(pointB).multiplyScalar(0.5);
  distanceLine.position.copy(distanceMidWorldPos);
  if (distanceLength > 1e-6) {
    distanceLine.quaternion.setFromUnitVectors(worldUp, distanceDirection.normalize());
  }
  distanceLine.scale.set(1, Math.max(distanceLength, 0.001), 1);
  distanceLine.visible = true;
}

function formatMeasurementText(valueMeters, { signed = false } = {}) {
  if (!Number.isFinite(valueMeters)) return '--';
  const sign = signed && valueMeters >= 0 ? '+' : '';
  if (measurementUnit === 'm') return `${sign}${valueMeters.toFixed(3)} m`;
  if (measurementUnit === 'mm') return `${sign}${(valueMeters * 1000).toFixed(0)} mm`;
  return `${sign}${(valueMeters * 100).toFixed(1)} cm`;
}

function refreshLevelDisplay() {
  const levelElement = document.getElementById('level-data');
  if (!hasLevelPick || lastLevelMeters == null) {
    if (levelElement) levelElement.textContent = 'Level: --';
    return;
  }
  const levelText = formatMeasurementText(lastLevelMeters, { signed: true });
  levelPointLabel.textContent = `Level ${levelText}`;
  if (levelElement) {
    levelElement.textContent = `Level: ${levelText}`;
  }
}

function refreshDistanceDisplay() {
  const distanceElement = document.getElementById('distance-data');
  if (!hasDistancePair || lastDistanceMeters == null) {
    if (distanceElement && pendingMeasurePoint === 'A') distanceElement.textContent = 'Distance A-B: --';
    return;
  }
  const distanceText = formatMeasurementText(lastDistanceMeters);
  distancePointLabel.textContent = distanceText;
  if (distanceElement) {
    distanceElement.textContent = `Distance A-B: ${distanceText}`;
  }
}

function showPointPositionLabel(worldPos) {
  levelWorldPos.copy(worldPos);
  hasLevelPick = true;
  lastLevelMeters = (worldPos.y * MEASUREMENT_SCALE) + 0.0;
  levelPointLabel.textContent = `Level ${formatMeasurementText(lastLevelMeters, { signed: true })}`;
  levelPointLabel.style.display = 'block';
  selectedPointMarker.position.copy(worldPos);
  selectedPointMarker.visible = true;

  const levelElement = document.getElementById('level-data');
  if (levelElement) {
    levelElement.textContent = `Level: ${formatMeasurementText(lastLevelMeters, { signed: true })}`;
  }
}

function updateDistanceMeasurement(worldPos) {
  const distanceElement = document.getElementById('distance-data');

  if (pendingMeasurePoint === 'A') {
    measurePointA.copy(worldPos);
    pointAMarker.position.copy(worldPos);
    pointAMarker.visible = true;
    pointBMarker.visible = false;
    distanceLine.visible = false;
    distancePointLabel.style.display = 'none';
    hasDistancePair = false;
    lastDistanceMeters = null;
    pendingMeasurePoint = 'B';
    if (distanceElement) distanceElement.textContent = 'Distance A-B: pick point B';
    return;
  }

  measurePointB.copy(worldPos);
  pointBMarker.position.copy(measurePointB);
  pointBMarker.visible = true;
  lastDistanceMeters = measurePointA.distanceTo(measurePointB) * MEASUREMENT_SCALE;
  updateDistanceLineBetween(measurePointA, measurePointB);
  distancePointLabel.textContent = formatMeasurementText(lastDistanceMeters);
  distancePointLabel.style.display = 'block';
  hasDistancePair = true;
  if (distanceElement) {
    distanceElement.textContent = `Distance A-B: ${formatMeasurementText(lastDistanceMeters)}`;
  }
  pendingMeasurePoint = 'A';
}

function hidePointPositionLabel() {
  hasLevelPick = false;
  lastLevelMeters = null;
  levelPointLabel.style.display = 'none';
  selectedPointMarker.visible = false;
}

function resetDistanceMeasurementDisplay() {
  pendingMeasurePoint = 'A';
  hasDistancePair = false;
  lastDistanceMeters = null;
  pointAMarker.visible = false;
  pointBMarker.visible = false;
  distanceLine.visible = false;
  distancePointLabel.style.display = 'none';
  const distanceElement = document.getElementById('distance-data');
  if (distanceElement) {
    distanceElement.textContent = 'Distance A-B: --';
  }
}

function bindMeasurementUnitControl() {
  const buttons = [
    { unit: 'm', element: document.getElementById('measure-unit-m') },
    { unit: 'cm', element: document.getElementById('measure-unit-cm') },
    { unit: 'mm', element: document.getElementById('measure-unit-mm') }
  ].filter((entry) => !!entry.element);
  if (!buttons.length) return;

  const setUnit = (unit) => {
    measurementUnit = unit;
    buttons.forEach((entry) => {
      entry.element.classList.toggle('is-active', entry.unit === unit);
    });
    refreshLevelDisplay();
    refreshDistanceDisplay();
  };

  buttons.forEach((entry) => {
    entry.element.addEventListener('click', () => setUnit(entry.unit));
  });

  setUnit('cm');
}

function setMeasureMode(mode) {
  measureMode = mode === 'distance' ? 'distance' : 'level';
  const levelBtn = document.getElementById('measure-level-btn');
  const distanceBtn = document.getElementById('measure-distance-btn');
  if (levelBtn) {
    levelBtn.classList.toggle('is-active', measureMode === 'level');
  }
  if (distanceBtn) {
    distanceBtn.classList.toggle('is-active', measureMode === 'distance');
  }

  if (measureMode === 'level') {
    resetDistanceMeasurementDisplay();
    const distanceElement = document.getElementById('distance-data');
    if (distanceElement) distanceElement.textContent = 'Distance A-B: --';
  } else {
    // Always start distance mode from a clean state (no preselected A/B).
    resetDistanceMeasurementDisplay();
    hidePointPositionLabel();
    const levelElement = document.getElementById('level-data');
    if (levelElement) levelElement.textContent = 'Level: --';
    const distanceElement = document.getElementById('distance-data');
    if (distanceElement) distanceElement.textContent = 'Distance A-B: pick point A';
  }
}

function bindMeasureControls() {
  const levelBtn = document.getElementById('measure-level-btn');
  const distanceBtn = document.getElementById('measure-distance-btn');
  if (levelBtn) {
    levelBtn.addEventListener('click', () => setMeasureMode('level'));
  }
  if (distanceBtn) {
    distanceBtn.addEventListener('click', () => setMeasureMode('distance'));
  }
}

function updateScreenLabelAtWorld(label, worldPos, screenPos, camera, offsetX = 12, offsetY = 12) {
  if (!camera) {
    label.style.display = 'none';
    return;
  }
  screenPos.copy(worldPos).project(camera);
  if (screenPos.z < -1 || screenPos.z > 1) {
    label.style.display = 'none';
    return;
  }
  const screenX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
  const screenY = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
  label.style.left = `${screenX + offsetX}px`;
  label.style.top = `${screenY + offsetY}px`;
  label.style.display = 'block';
}

function updateLevelPointLabel(camera) {
  if (!hasLevelPick || measureMode !== 'level') {
    levelPointLabel.style.display = 'none';
    return;
  }
  updateScreenLabelAtWorld(levelPointLabel, levelWorldPos, levelScreenPos, camera);
}

function updateDistancePointLabel(camera) {
  if (!hasDistancePair || measureMode !== 'distance') {
    distancePointLabel.style.display = 'none';
    return;
  }
  updateScreenLabelAtWorld(distancePointLabel, distanceMidWorldPos, distanceMidScreenPos, camera);
}

renderer.domElement.addEventListener('click', (event) => {
  if (currentMode === 'fly' && viewHelper && viewHelper.handleClick(event)) return;
  if (!activeCamera || !window.loadedPoints || window.loadedPoints.length === 0) return;

  updatePickThresholdForCamera(activeCamera);
  const nearest = pickNearestPointAroundClientPos(event.clientX, event.clientY, activeCamera, pickedPointWorld);
  if (!nearest) {
    if (measureMode === 'level') hidePointPositionLabel();
    return;
  }
  if (measureMode === 'level') {
    showPointPositionLabel(pickedPointWorld);
    return;
  }
  updateDistanceMeasurement(pickedPointWorld);
});

// Initialize Modes
const flyData = initFlyMode(renderer, scene);
window.flyData = flyData;  // Make flyData available globally
const walkCamera = initWalkMode(renderer, scene);
const gltfLoader = new GLTFLoader();
initFacilities(scene, gltfLoader);

let activeCamera;
let currentMode = 'fly'; // Default to fly mode as requested

// Ensure global references are available to other modules
window.renderer = renderer;
window.scene = scene;
window.getActiveCamera = () => activeCamera;

function cycleColorMode() {
  animationUniforms.uColorMode.value = (animationUniforms.uColorMode.value + 1) % 3;
  if (window.sidebar && typeof window.sidebar.updateColorModeUI === 'function') {
    window.sidebar.updateColorModeUI(animationUniforms.uColorMode.value);
  }
}
window.cycleColorMode = cycleColorMode;

function ensureViewHelperForCamera(camera) {
  if (!camera) return;
  if (viewHelper && viewHelperCamera === camera) return;
  if (viewHelper) viewHelper.dispose();
  viewHelper = new ViewHelper(camera, renderer.domElement);
  viewHelper.center.set(0, 0, 0);
  viewHelper.setLabelStyle('18px Noto Sans', '#101010', 12);
  viewHelperCamera = camera;
}

function updateViewHelperCenterFromModelBounds() {
  if (!viewHelper || !window.modelBounds) return;
  const b = window.modelBounds;
  if (
    !Number.isFinite(b.minX) || !Number.isFinite(b.maxX) ||
    !Number.isFinite(b.minY) || !Number.isFinite(b.maxY) ||
    !Number.isFinite(b.minZ) || !Number.isFinite(b.maxZ)
  ) return;
  viewHelper.center.set(
    (b.minX + b.maxX) * 0.5,
    (b.minY + b.maxY) * 0.5,
    (b.minZ + b.maxZ) * 0.5
  );
}

function isPointVisibleForColorRange(worldPos, frustum) {
  const planes = window.activeClippingPlanes || [];
  for (let i = 0; i < planes.length; i++) {
    if (planes[i].distanceToPoint(worldPos) < -CLIP_VISIBILITY_EPS) return false;
  }
  return frustum.containsPoint(worldPos);
}

function computeVisibleColorRangeFromScreen() {
  const camera = activeCamera;
  if (!camera || !window.loadedPoints || !window.loadedPoints.length) return null;

  colorRangeTempProjScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  colorRangeTempFrustum.setFromProjectionMatrix(colorRangeTempProjScreenMatrix);

  let totalCount = 0;
  for (let i = 0; i < window.loadedPoints.length; i++) {
    const attr = window.loadedPoints[i]?.geometry?.attributes?.position;
    if (!attr) continue;
    totalCount += attr.count;
  }
  if (totalCount <= 0) return null;

  const step = Math.max(1, Math.ceil(totalCount / VISIBLE_COLOR_SAMPLE_MAX));
  let minY = Infinity;
  let maxY = -Infinity;
  let hitCount = 0;

  for (let i = 0; i < window.loadedPoints.length; i++) {
    const points = window.loadedPoints[i];
    const attr = points?.geometry?.attributes?.position;
    if (!attr) continue;

    points.updateMatrixWorld(true);
    const matWorld = points.matrixWorld;
    for (let j = 0; j < attr.count; j += step) {
      colorRangeTempWorld.set(attr.getX(j), attr.getY(j), attr.getZ(j)).applyMatrix4(matWorld);
      if (!isPointVisibleForColorRange(colorRangeTempWorld, colorRangeTempFrustum)) continue;
      hitCount++;
      if (colorRangeTempWorld.y < minY) minY = colorRangeTempWorld.y;
      if (colorRangeTempWorld.y > maxY) maxY = colorRangeTempWorld.y;
    }
  }

  if (!hitCount || !Number.isFinite(minY) || !Number.isFinite(maxY)) return null;
  if (Math.abs(maxY - minY) < 1e-4) {
    maxY = minY + 1e-4;
  }
  return { minY, maxY };
}

function buildVisibleColorSignature() {
  const camera = activeCamera;
  if (!camera) return '';
  const planes = window.activeClippingPlanes || [];
  const planeSig = planes.map((p) => `${p.normal.x.toFixed(3)},${p.normal.y.toFixed(3)},${p.normal.z.toFixed(3)},${p.constant.toFixed(3)}`).join('|');
  return [
    camera.position.x.toFixed(3), camera.position.y.toFixed(3), camera.position.z.toFixed(3),
    camera.quaternion.x.toFixed(3), camera.quaternion.y.toFixed(3), camera.quaternion.z.toFixed(3), camera.quaternion.w.toFixed(3),
    planeSig
  ].join(';');
}

function updateVisibleColorRangeIfNeeded(force = false) {
  if (!window.animationUniforms || window.animationUniforms.uColorMode.value < 1.5) return;
  const now = performance.now();
  if (!force && now - lastVisibleColorUpdateTs < VISIBLE_COLOR_UPDATE_INTERVAL_MS) return;

  const sig = buildVisibleColorSignature();
  if (!force && sig === lastVisibleColorSignature) return;
  lastVisibleColorSignature = sig;
  lastVisibleColorUpdateTs = now;

  const range = computeVisibleColorRangeFromScreen();
  if (range) {
    window.animationUniforms.uColorMinY.value = range.minY;
    window.animationUniforms.uColorMaxY.value = range.maxY;
    return;
  }

  // Fallback when no points are visible in the viewport.
  if (window.modelBounds) {
    window.animationUniforms.uColorMinY.value = window.modelBounds.minY;
    window.animationUniforms.uColorMaxY.value = window.modelBounds.maxY;
  }
}

function syncCameraUi() {
  if (window.sidebar && typeof window.sidebar.updateActiveAxis === 'function') {
    window.sidebar.updateActiveAxis();
  }
  if (typeof window.updateClippingPlanes === 'function') {
    window.updateClippingPlanes();
  }
  updateQuickControlButtons();
  updateVisibleColorRangeIfNeeded(true);
}

function isSimpleUiMode() {
  return !!(
    window.sidebar &&
    typeof window.sidebar.getUiMode === 'function' &&
    window.sidebar.getUiMode() === 'simple'
  );
}

function updateQuickControlsVisibility() {
  if (!quickControlsRoot) return;
  quickControlsRoot.style.display = 'none'; // Always hide for this project
}

function setPanMode(enabled, { enableOrbitWhenOff = false } = {}) {
  panModeEnabled = !!enabled;
  if (!panModeEnabled && enableOrbitWhenOff) {
    const state = getFlyViewState();
    if (!state.orbitEnabled) setOrbitEnabled(true);
  }
  flyData.controls.mouseButtons.LEFT = panModeEnabled ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  const state = getFlyViewState();
  flyData.controls.enableRotate = panModeEnabled ? false : state.orbitEnabled;
  renderer.domElement.style.cursor = panModeEnabled ? 'grab' : '';
  if (quickPanBtn) {
    quickPanBtn.classList.toggle('is-active', panModeEnabled);
    quickPanBtn.textContent = '🖐️';
    quickPanBtn.title = panModeEnabled ? 'Pan Mode (click for Orbit)' : 'Orbit Mode (click for Pan)';
  }
}

function updateQuickControlButtons() {
  const state = getFlyViewState();
  if (quickCameraModeBtn) {
    const isPerspective = state.mode === 'perspective';
    quickCameraModeBtn.textContent = isPerspective ? '📷P' : '📷O';
    quickCameraModeBtn.title = isPerspective ? 'Switch to Ortho' : 'Switch to Perspective';
    quickCameraModeBtn.classList.toggle('is-active', isPerspective);
  }
  if (quickLockBtn) {
    const isFree = !!state.orbitEnabled;
    quickLockBtn.textContent = isFree ? '🔓' : '🔒';
    quickLockBtn.title = isFree ? 'Free View (click to lock)' : 'Lock View (click to free)';
    quickLockBtn.classList.toggle('is-active', isFree);
  }
}

function resetCameraViewQuick() {
  if (currentMode !== 'fly') setMode('fly');
  if (window.sidebar && typeof window.sidebar.setActiveAxis === 'function') {
    window.sidebar.setActiveAxis('y');
  }
  applyDefaultViewState();
  setPanMode(false);
  syncCameraUi();
}

function initQuickViewControls() {
  const root = document.createElement('div');
  root.id = 'view-quick-controls';
  root.innerHTML = `
    <button type="button" data-action="pan" title="Pan">🖐️</button>
    <button type="button" data-action="camera-mode" title="Switch Camera">📷O</button>
    <button type="button" data-action="lock" title="Lock/Free">🔒</button>
    <button type="button" data-action="reset" title="Reset View">🏠</button>
  `;

  quickControlsRoot = root;
  quickPanBtn = root.querySelector('button[data-action="pan"]');
  quickCameraModeBtn = root.querySelector('button[data-action="camera-mode"]');
  quickLockBtn = root.querySelector('button[data-action="lock"]');

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'pan') {
      setPanMode(!panModeEnabled, { enableOrbitWhenOff: true });
      syncCameraUi();
      return;
    }
    if (action === 'reset') {
      resetCameraViewQuick();
      return;
    }
    if (action === 'camera-mode') {
      if (currentMode !== 'fly') setMode('fly');
      const state = getFlyViewState();
      setFlyViewMode(state.mode === 'perspective' ? 'orthographic' : 'perspective');
      setPanMode(false);
      syncCameraUi();
      return;
    }
    if (action === 'lock') {
      if (currentMode !== 'fly') setMode('fly');
      const state = getFlyViewState();
      setOrbitEnabled(!state.orbitEnabled);
      setPanMode(false);
      syncCameraUi();
    }
  });

  document.body.appendChild(root);
  updateQuickControlButtons();
  updateQuickControlsVisibility();
}

function setMode(mode) {
  const oldCamera = activeCamera;
  currentMode = mode;
  const flyHelp = document.getElementById('numpad-help');
  const walkHelp = document.getElementById('walk-help');
  const uiMode = document.getElementById('ui-camera-mode');

  if (mode === 'fly') {
    let forcePerspective = false;
    if (oldCamera === walkCamera) {
      // Transition from Walk to Fly: Lift camera to Y=25
      flyData.perspectiveCamera.position.set(walkCamera.position.x, 25, walkCamera.position.z);
      flyData.controls.target.set(walkCamera.position.x, 0, walkCamera.position.z);
      flyData.perspectiveCamera.lookAt(flyData.controls.target);
      // Ensure we are in perspective mode after lifting
      flyData.controls.object = flyData.perspectiveCamera;
      forcePerspective = true;
    }
    activeCamera = switchToFlyMode(renderer, forcePerspective);
    exitWalkMode();
    if (flyHelp) flyHelp.style.display = 'block';
    if (walkHelp) walkHelp.style.display = 'none';
    updateQuickControlsVisibility();
  } else {
    activeCamera = switchToWalkMode(renderer, flyData.controls);
    if (flyHelp) flyHelp.style.display = 'none';
    if (walkHelp) walkHelp.style.display = 'block';
    if (uiMode) uiMode.textContent = 'Mode: Walk';
    updateQuickControlsVisibility();
  }

  if (window.sidebar && typeof window.sidebar.refreshPointSize === 'function') {
    window.sidebar.refreshPointSize();
  }
}

window.addEventListener('app-uimode-changed', (event) => {
  const mode = event && event.detail ? event.detail.mode : 'simple';
  if (mode === 'simple') {
    setPanMode(false);
    if (getFlyViewState().orbitEnabled) setOrbitEnabled(false);
  }
  updateQuickControlsVisibility();
  syncCameraUi();
});

// Initial mode
setMode('fly');
initVersionBadge();
// Default to perspective free view with top section axis on load
if (window.sidebar && typeof window.sidebar.setActiveAxis === 'function') {
  window.sidebar.setActiveAxis('y');
}
applyDefaultViewState();
ensureViewHelperForCamera(flyData.controls.object);
initQuickViewControls();
setPanMode(false);

// Load Point Cloud Sequentially to prevent memory errors
const MODELS = {
  canteen: ['./ply/children-canteen.ply'],
  bed: ['./ply/children-bed.ply']
};

window.loadedPoints = []; // Make loadedPoints available globally

async function initializeModel(plyFiles) {
  // Clear existing points from scene
  if (window.loadedPoints && window.loadedPoints.length > 0) {
    window.loadedPoints.forEach(p => {
      scene.remove(p);
      if (p.geometry) p.geometry.dispose();
      if (p.material) p.material.dispose();
    });
    window.loadedPoints = [];
  }

  const loaderElement = document.getElementById('loader');
  if (loaderElement) {
    loaderElement.style.display = 'block';
    loaderElement.style.opacity = '1';
    loaderElement.innerText = `Loading... 0%`;
  }

  const result = await loadPointCloudModels({
    scene,
    plyFiles,
    activeClippingPlanes: window.activeClippingPlanes,
    createMaterialShader: createAnimationShader(animationUniforms),
    onProgress: (loaded, total) => {
      if (!loaderElement) return;
      const percent = Math.round((loaded / total) * 100);
      loaderElement.innerText = `Loading... ${percent}%`;
    }
  });

  window.loadedPoints = result.loadedPoints;

  // Update model name in sidebar
  const fileNameElement = document.getElementById('file-name');
  if (fileNameElement) {
    const fileName = plyFiles[0].split('/').pop().replace('.ply', '');
    fileNameElement.textContent = `pointcloud - ${fileName}`;
  }

  if (
    isFinite(result.worldBounds.minX) && isFinite(result.worldBounds.maxX) &&
    isFinite(result.worldBounds.minY) && isFinite(result.worldBounds.maxY) &&
    isFinite(result.worldBounds.minZ) && isFinite(result.worldBounds.maxZ)
  ) {
    window.modelBounds = result.worldBounds;
    animationUniforms.uColorMinY.value = result.worldBounds.minY;
    animationUniforms.uColorMaxY.value = result.worldBounds.maxY;
  }

  const { minX, maxX, minY, maxY, minZ, maxZ } = result.worldBounds;
  const maxDistance = result.maxDistance;
  const getDefaultAxisValue = (range) => Math.min(range.max, Math.max(range.min, range.max / 2));
  
  // Use true loaded bounds for clipping ranges (recomputed on every model load).
  const pad = 0.001; // tiny pad to avoid precision clipping on exact boundary points
  window.axisRanges = {
    x: { min: minX - pad, max: maxX + pad },
    y: { min: minY - pad, max: maxY + pad },
    z: { min: minZ - pad, max: maxZ + pad }
  };

  // Store bounds for camera centering
  window.modelBounds = { minX, maxX, minY, maxY, minZ, maxZ };
  
  animationUniforms.uMaxDistance.value = Number.isFinite(maxDistance) ? maxDistance : 100;
  animationUniforms.uMaxY.value = Number.isFinite(maxY) ? maxY : 15;

  // Reset clipping planes to default values based on new model bounds
  yClippingPlane.constant = window.axisRanges.y.max; // Start from top
  yClippingPlaneBottom.constant = -window.axisRanges.y.min;
  xClippingPlane.constant = window.axisRanges.x.max;
  xClippingPlaneBack.constant = -window.axisRanges.x.min;
  zClippingPlane.constant = window.axisRanges.z.max;
  zClippingPlaneFront.constant = -window.axisRanges.z.min;
  
  // Update legacy slider ranges if present in DOM.
  setTimeout(() => {
    const ySlider = document.getElementById('y-clipping-slider');
    const xSlider = document.getElementById('x-clipping-slider');
    const zSlider = document.getElementById('z-clipping-slider');
    
    const yInput = document.getElementById('y-clipping-input');
    const xInput = document.getElementById('x-clipping-input');
    const zInput = document.getElementById('z-clipping-input');
    
    if (ySlider) {
      ySlider.min = window.axisRanges.y.min;
      ySlider.max = window.axisRanges.y.max;
      ySlider.value = window.axisRanges.y.max;
      if (yInput) yInput.value = ySlider.value;
    }
    
    if (xSlider) {
      xSlider.min = window.axisRanges.x.min;
      xSlider.max = window.axisRanges.x.max;
      xSlider.value = window.axisRanges.x.max;
      if (xInput) xInput.value = xSlider.value;
    }
    
    if (zSlider) {
      zSlider.min = window.axisRanges.z.min;
      zSlider.max = window.axisRanges.z.max;
      zSlider.value = window.axisRanges.z.max;
      if (zInput) zInput.value = zSlider.value;
    }

    // Also update sidebar active axis slider
    const activeSlider = document.getElementById('active-clipping-slider');
    const activeInput = document.getElementById('active-clipping-input');
    if (activeSlider && window.sidebar && window.sidebar.getActiveAxis) {
      const activeAxis = window.sidebar.getActiveAxis();
      activeSlider.min = window.axisRanges[activeAxis].min;
      activeSlider.max = window.axisRanges[activeAxis].max;
      activeSlider.value = window.axisRanges[activeAxis].max;
      if (activeInput) activeInput.value = activeSlider.value;
    }
  }, 100);

  // Expose animation functions globally
  window.setDistanceAnimation = function() {
    setDistanceAnimation(animationUniforms);
  };
  
  window.setYAnimation = function() {
    setYAnimation(animationUniforms);
  };

  isAnimatingReveal = true;
  animationStartTime = performance.now();

  if (loaderElement) {
    loaderElement.style.opacity = '0';
    setTimeout(() => {
      loaderElement.style.display = 'none';
    }, 500);
  }
  
  // Initialize/Update sidebar controls
  initSidebar(yClippingPlane, yClippingPlaneBottom, xClippingPlane, xClippingPlaneBack, zClippingPlane, zClippingPlaneFront, window.activeClippingPlanes, window.allPlanes, window.loadedPoints);
  updateVisibleColorRangeIfNeeded(true);
  
  updatePointCount();

  // Reset view to fit the new model
  resetCameraViewQuick();
}

// Add button event listeners for model switching
function initModelSwitcher() {
  const btnCanteen = document.getElementById('btn-canteen');
  const btnBed = document.getElementById('btn-bed');

  if (btnCanteen) {
    btnCanteen.addEventListener('click', () => {
      initializeModel(MODELS.canteen);
    });
  }

  if (btnBed) {
    btnBed.addEventListener('click', () => {
      initializeModel(MODELS.bed);
    });
  }
}

initializeModel(MODELS.canteen); // Load canteen by default
initModelSwitcher();
bindMeasureControls();
bindMeasurementUnitControl();
setMeasureMode('level');

// Event Listeners
window.addEventListener('keydown', (event) => {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  const simpleUiModeActive = isSimpleUiMode();
  
  if (event.code === 'KeyC') {
    setMode(currentMode === 'walk' ? 'fly' : 'walk');
    event.preventDefault();
    return;
  }

  if (event.code === 'KeyM') {
    cycleColorMode();
    event.preventDefault();
    return;
  }
  
  if (event.code === 'KeyA' && currentMode === 'fly') {
    // Toggle between distance-based (0) and Y-based (1) animations
    animationUniforms.uAnimationType.value = animationUniforms.uAnimationType.value === 0 ? 1 : 0;
    event.preventDefault();
    return;
  }
  
  // Clipping mode selection - now handled by showing all controls simultaneously
  if (event.code === 'Digit7') { // Key 7 for Y clipping
    console.log('7 : Y clipping');
    // Set Y as the active axis in the sidebar
    if (window.sidebar && typeof window.sidebar.setActiveAxis === 'function') {
      window.sidebar.setActiveAxis('y');
    }
    event.preventDefault();
    return;
  }
  
  if (event.code === 'Digit3') { // Key 3 for X clipping
    console.log('3 : X clipping');
    // Set X as the active axis in the sidebar
    if (window.sidebar && typeof window.sidebar.setActiveAxis === 'function') {
      window.sidebar.setActiveAxis('x');
    }
    event.preventDefault();
    return;
  }
  
  if (event.code === 'Digit1') { // Key 1 for Z clipping
    console.log('1 : Z clipping');
    // Set Z as the active axis in the sidebar
    if (window.sidebar && typeof window.sidebar.setActiveAxis === 'function') {
      window.sidebar.setActiveAxis('z');
    }
    event.preventDefault();
    return;
  }

  if (event.code === 'Numpad7') {
    if (currentMode !== 'fly') setMode('fly');
    if (window.sidebar && typeof window.sidebar.applyViewSectionAxis === 'function') {
      window.sidebar.applyViewSectionAxis('y', { forceOrthographic: true, preserveValue: true });
      activeCamera = switchToFlyMode(renderer);
      syncCameraUi();
      event.preventDefault();
      return;
    }
  }

  if (event.code === 'Numpad3') {
    if (currentMode !== 'fly') setMode('fly');
    if (window.sidebar && typeof window.sidebar.applyViewSectionAxis === 'function') {
      window.sidebar.applyViewSectionAxis('x', { forceOrthographic: true, preserveValue: true });
      activeCamera = switchToFlyMode(renderer);
      syncCameraUi();
      event.preventDefault();
      return;
    }
  }

  if (event.code === 'Numpad1') {
    if (currentMode !== 'fly') setMode('fly');
    if (window.sidebar && typeof window.sidebar.applyViewSectionAxis === 'function') {
      window.sidebar.applyViewSectionAxis('z', { forceOrthographic: true, preserveValue: true });
      activeCamera = switchToFlyMode(renderer);
      syncCameraUi();
      event.preventDefault();
      return;
    }
  }

  if (event.code === 'Numpad5') {
    if (simpleUiModeActive) {
      event.preventDefault();
      return;
    }
    if (currentMode !== 'fly') setMode('fly');
    if (window.sidebar && typeof window.sidebar.toggleCameraMode === 'function') {
      window.sidebar.toggleCameraMode();
      activeCamera = switchToFlyMode(renderer);
      syncCameraUi();
      event.preventDefault();
      return;
    }
  }

  if (event.code === 'Numpad0') {
    if (simpleUiModeActive) {
      event.preventDefault();
      return;
    }
    if (currentMode !== 'fly') setMode('fly');
    if (window.sidebar && typeof window.sidebar.applyCameraMode === 'function') {
      window.sidebar.applyCameraMode('perspective');
      activeCamera = switchToFlyMode(renderer);
      syncCameraUi();
      event.preventDefault();
      return;
    }
  }

  if (event.shiftKey && event.code === 'KeyL') {
    console.log('Camera position: new THREE.Vector3(' + activeCamera.position.x + ', ' + activeCamera.position.y + ', ' + activeCamera.position.z + ')');
    console.log('Camera quaternion: new THREE.Quaternion(' + activeCamera.quaternion.x + ', ' + activeCamera.quaternion.y + ', ' + activeCamera.quaternion.z + ', ' + activeCamera.quaternion.w + ')');
    if (currentMode === 'fly') {
      console.log('Controls target: new THREE.Vector3(' + flyData.controls.target.x + ', ' + flyData.controls.target.y + ', ' + flyData.controls.target.z + ')');
    }
    event.preventDefault();
    return;
  }

  if (
    event.code === 'NumpadAdd' ||
    event.code === 'NumpadSubtract' ||
    event.code === 'Numpad8' ||
    event.code === 'Numpad2' ||
    event.code === 'Numpad4' ||
    event.code === 'Numpad6' ||
    event.code === 'Numpad9'
  ) {
    if (simpleUiModeActive) {
      event.preventDefault();
      return;
    }
    if (currentMode !== 'fly') setMode('fly');
    handleFlyKeyDown(event);
    activeCamera = switchToFlyMode(renderer);
    syncCameraUi();
    return;
  }

  if (currentMode === 'fly') {
    handleFlyKeyDown(event);
    activeCamera = switchToFlyMode(renderer); // Ensure camera reference is updated
  } else {
    handleWalkKeyDown(event);
  }
});

window.addEventListener('keyup', (event) => {
  if (currentMode === 'walk') {
    handleWalkKeyUp(event);
  }
});

// Debounced resize handler for better GPU performance
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    
    // Update cameras
    flyData.perspectiveCamera.aspect = width / height;
    flyData.perspectiveCamera.updateProjectionMatrix();
    
    flyData.orthographicCamera.left = width / -100;
    flyData.orthographicCamera.right = width / 100;
    flyData.orthographicCamera.top = height / 100;
    flyData.orthographicCamera.bottom = height / -100;
    flyData.orthographicCamera.updateProjectionMatrix();
    
    walkCamera.aspect = width / height;
    walkCamera.updateProjectionMatrix();
  }, 100); // 100ms debounce for GPU efficiency
});









function animate() {
  requestAnimationFrame(animate);
  const delta = frameClock.getDelta();

  if (isAnimatingReveal) {
    const elapsed = (performance.now() - animationStartTime) / 1000; // in seconds
    animationUniforms.uTime.value = Math.min(elapsed / 1.5, 1.5); 
    if (animationUniforms.uTime.value >= 1.0) {
      isAnimatingReveal = false;
    }
  }

  if (currentMode === 'fly') {
    activeCamera = flyData.controls.object;
    ensureViewHelperForCamera(activeCamera);
    updateViewHelperCenterFromModelBounds();
    updateQuickControlButtons();
    flyData.controls.update();
    // Keep sidebar state synced with camera mode.
    if (window.sidebar && typeof window.sidebar.updateActiveAxis === 'function') {
      window.sidebar.updateActiveAxis();
    }
    updateVisibleColorRangeIfNeeded(false);
  } else {
    updateWalkMode();
    updateVisibleColorRangeIfNeeded(false);
  }
  
  // Render the main scene
  renderer.render(scene, activeCamera);
  if (currentMode === 'fly' && viewHelper) {
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    if (viewHelper.animating) viewHelper.update(delta);
    viewHelper.render(renderer);
    renderer.autoClear = prevAutoClear;
  }
  

  
  updateLevelPointLabel(activeCamera);
  updateDistancePointLabel(activeCamera);
  updateCameraPositionDisplay();
}
animate();

function updateCameraPositionDisplay() {
  const pos = activeCamera.position;
  const cameraElement = document.getElementById('camera-data');
  if (cameraElement) {
    cameraElement.textContent = `Camera: X:${pos.x.toFixed(1)} Y:${pos.y.toFixed(1)} Z:${pos.z.toFixed(1)}`;
  }
}

function updatePointCount() {
  let totalPoints = 0;
  window.loadedPoints.forEach(p => {
    if (p.geometry.attributes.position) totalPoints += p.geometry.attributes.position.count;
  });
  const pointCountElement = document.getElementById('point-info');
  if (pointCountElement) pointCountElement.innerText = `${totalPoints.toLocaleString()} points`;
}



