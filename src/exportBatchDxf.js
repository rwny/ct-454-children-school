import * as THREE from 'three';

const SLICE_STEP      = 1.00;  // metres between slice levels
const SLICE_THICKNESS = 0.10;  // metres thick per slice

function projectTo2D(worldPos, viewAxis) {
  if (viewAxis === 'top')   return { u: worldPos.x,  v: -worldPos.z };
  if (viewAxis === 'front') return { u: worldPos.x,  v:  worldPos.y };
  if (viewAxis === 'side')  return { u: -worldPos.z, v:  worldPos.y };
  return { u: worldPos.x, v: worldPos.y };
}

function buildDxf(points2D) {
  const lines = [
    '0', 'SECTION',
    '2', 'HEADER',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES',
  ];
  for (const { u, v } of points2D) {
    lines.push('0', 'POINT', '8', '0',
      '10', u.toFixed(6),
      '20', v.toFixed(6),
      '30', '0.0');
  }
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}

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
 * Collect all world positions from loaded point clouds.
 */
function collectAllWorldPoints() {
  const pts = window.loadedPoints;
  if (!pts || pts.length === 0) return [];

  const all = [];
  const tmp = new THREE.Vector3();

  for (const obj of pts) {
    if (!obj.visible) continue;
    const posAttr = obj.geometry?.attributes?.position;
    if (!posAttr) continue;
    obj.updateMatrixWorld(true);
    const mat = obj.matrixWorld;
    for (let i = 0; i < posAttr.count; i++) {
      tmp.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(mat);
      all.push({ x: tmp.x, y: tmp.y, z: tmp.z });
    }
  }
  return all;
}

/**
 * Batch export: slice the full point cloud and generate one DXF per slice
 * for Top (Y), Front (Z) and Side (X) views.
 */
export async function exportBatchDxf() {
  const pts = window.loadedPoints;
  if (!pts || pts.length === 0) {
    alert('No point cloud loaded.');
    return;
  }

  const bounds = window.modelBounds;
  if (!bounds) {
    alert('Model bounds not available yet – please wait for the model to finish loading.');
    return;
  }

  const views = [
    { axis: 'top',   label: 'Top',   minKey: 'minY', maxKey: 'maxY', sliceCoord: 'y', projectFn: p => projectTo2D(p, 'top')   },
    { axis: 'front', label: 'Front', minKey: 'minZ', maxKey: 'maxZ', sliceCoord: 'z', projectFn: p => projectTo2D(p, 'front') },
    { axis: 'side',  label: 'Side',  minKey: 'minX', maxKey: 'maxX', sliceCoord: 'x', projectFn: p => projectTo2D(p, 'side')  },
  ];

  // Calculate total files for confirmation
  let totalFiles = 0;
  for (const v of views) {
    const range = bounds[v.maxKey] - bounds[v.minKey];
    totalFiles += Math.ceil(range / SLICE_STEP);
  }

  const ok = confirm(
    `Batch DXF Export\n\n` +
    `This will generate up to ${totalFiles} DXF files\n` +
    `(3 views × slices every ${SLICE_STEP}m, thickness ${SLICE_THICKNESS}m each)\n\n` +
    `The browser will download each file automatically.\n` +
    `Proceed?`
  );
  if (!ok) return;

  // Collect all world points once
  const allPts = collectAllWorldPoints();
  if (allPts.length === 0) {
    alert('No points found.');
    return;
  }

  let generated = 0;

  for (const v of views) {
    const lo = bounds[v.minKey];
    const hi = bounds[v.maxKey];

    for (let level = lo; level <= hi; level += SLICE_STEP) {
      const sliceMin = level;
      const sliceMax = level + SLICE_THICKNESS;

      const pts2D = [];
      for (const p of allPts) {
        const coord = p[v.sliceCoord];
        if (coord >= sliceMin && coord < sliceMax) {
          pts2D.push(v.projectFn(p));
        }
      }

      if (pts2D.length === 0) continue;

      const filename = `${v.label}_Level_${level.toFixed(2)}m.dxf`;
      downloadText(buildDxf(pts2D), filename);
      generated++;

      // Yield to browser to avoid freezing on large datasets
      await new Promise(r => setTimeout(r, 10));
    }
  }

  if (generated === 0) {
    alert('No slices contained any points.');
  } else {
    console.log(`Batch DXF export complete: ${generated} files generated.`);
  }
}
