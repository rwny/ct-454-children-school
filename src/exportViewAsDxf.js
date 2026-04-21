import * as THREE from 'three';

const MAX_POINTS = 2_000_000;

/**
 * Detect current orthographic view axis from camera orientation.
 * Returns: 'top' | 'front' | 'side' | null
 */
function detectOrthographicView(camera) {
  if (!camera || !camera.isOrthographicCamera) return null;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.normalize();

  const absX = Math.abs(dir.x);
  const absY = Math.abs(dir.y);
  const absZ = Math.abs(dir.z);

  if (absY > 0.9) return 'top';    // Looking down/up
  if (absZ > 0.9) return 'front';  // Looking front/back
  if (absX > 0.9) return 'side';   // Looking left/right

  return null; // Oblique / custom view
}

/**
 * Project a 3D world point to 2D based on the view axis.
 * Top:   (x, -z)
 * Front: (x,  y)
 * Side:  (-z, y)
 */
function projectTo2D(worldPos, viewAxis) {
  if (viewAxis === 'top')   return { u: worldPos.x,  v: -worldPos.z };
  if (viewAxis === 'front') return { u: worldPos.x,  v:  worldPos.y };
  if (viewAxis === 'side')  return { u: -worldPos.z, v:  worldPos.y };
  return { u: worldPos.x, v: worldPos.y };
}

/**
 * Build a minimal DXF string from an array of 2D points.
 */
function buildDxf(points2D) {
  const header = [
    '0\nSECTION',
    '2\nHEADER',
    '0\nENDSEC',
    '0\nSECTION',
    '2\nENTITIES',
  ].join('\n');

  const entities = points2D.map(({ u, v }) =>
    `0\nPOINT\n8\n0\n10\n${u.toFixed(6)}\n20\n${v.toFixed(6)}\n30\n0.0`
  ).join('\n');

  const footer = '0\nENDSEC\n0\nEOF';

  return `${header}\n${entities}\n${footer}`;
}

/**
 * Trigger browser download of text content as a file.
 */
function downloadText(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export the currently visible point cloud view as a DXF file.
 *
 * @param {{ camera: THREE.Camera, scene: THREE.Scene }} options
 */
export function exportViewAsDxf({ camera, scene } = {}) {
  const cam = camera || (typeof window.getActiveCamera === 'function' ? window.getActiveCamera() : null);

  if (!cam) {
    alert('No active camera found.');
    return;
  }

  const viewAxis = detectOrthographicView(cam);
  if (!viewAxis) {
    alert('DXF export is only available in an Orthographic view.\nPlease switch to Top, Front, or Side view first.');
    return;
  }

  const points = window.loadedPoints;
  if (!points || points.length === 0) {
    alert('No point cloud loaded.');
    return;
  }

  // Build frustum from camera
  const projScreenMatrix = new THREE.Matrix4();
  projScreenMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const frustum = new THREE.Frustum();
  frustum.setFromProjectionMatrix(projScreenMatrix);

  const activePlanes = window.activeClippingPlanes || [];
  const EPS = 1e-4;
  const tempWorld = new THREE.Vector3();
  const points2D = [];

  for (let oi = 0; oi < points.length; oi++) {
    const obj = points[oi];
    if (!obj.visible) continue;
    const posAttr = obj.geometry?.attributes?.position;
    if (!posAttr) continue;

    obj.updateMatrixWorld(true);
    const mat = obj.matrixWorld;

    for (let i = 0; i < posAttr.count; i++) {
      tempWorld.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(mat);

      // Frustum cull
      if (!frustum.containsPoint(tempWorld)) continue;

      // Clipping plane cull
      let clipped = false;
      for (let pi = 0; pi < activePlanes.length; pi++) {
        if (activePlanes[pi].distanceToPoint(tempWorld) < -EPS) { clipped = true; break; }
      }
      if (clipped) continue;

      points2D.push(projectTo2D(tempWorld, viewAxis));

      if (points2D.length >= MAX_POINTS) break;
    }
    if (points2D.length >= MAX_POINTS) break;
  }

  if (points2D.length === 0) {
    alert('No visible points found in current view.');
    return;
  }

  const viewName = viewAxis.charAt(0).toUpperCase() + viewAxis.slice(1);
  const filename = `${viewName}_${points2D.length}_points.dxf`;
  const dxf = buildDxf(points2D);
  downloadText(dxf, filename);

  console.log(`DXF exported: ${filename} (${points2D.length} points)`);
}
