import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

function loadPlyGeometry(loader, path) {
  return new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, reject);
  });
}

export async function loadPointCloudModels({
  scene,
  plyFiles,
  activeClippingPlanes,
  createMaterialShader,
  onProgress
}) {
  const loader = new PLYLoader();
  const loadedPoints = [];

  for (let i = 0; i < plyFiles.length; i++) {
    const plyPath = plyFiles[i];
    try {
      const geometry = await loadPlyGeometry(loader, plyPath);
      geometry.computeVertexNormals();

      const material = new THREE.PointsMaterial({
        size: 0.02,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1.0,
        clippingPlanes: activeClippingPlanes,
        clipShadows: true
      });

      material.onBeforeCompile = createMaterialShader;

      if (!geometry.attributes.color) {
        material.vertexColors = false;
        material.color.set(0x00ffff);
      }

      const points = new THREE.Points(geometry, material);
      points.rotation.x = -Math.PI / 2;
      points.position.set(0, 0, 0);
      loadedPoints.push(points);

      if (typeof onProgress === 'function') onProgress(i + 1, plyFiles.length, plyPath);
    } catch (error) {
      console.error(`Failed to load ${plyPath}:`, error);
    }
  }

  loadedPoints.forEach((p) => scene.add(p));

  const worldBox = new THREE.Box3();
  loadedPoints.forEach((p) => {
    p.updateMatrixWorld(true);
    worldBox.expandByObject(p);
  });

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let maxDistance = 0;

  loadedPoints.forEach((p) => {
    p.updateMatrixWorld();
    const positionAttribute = p.geometry.attributes.position;
    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      const z = positionAttribute.getZ(i);
      const distance = Math.sqrt(x * x + y * y + z * z);

      if (x > maxX) maxX = x;
      if (x < minX) minX = x;
      if (y > maxY) maxY = y;
      if (y < minY) minY = y;
      if (z > maxZ) maxZ = z;
      if (z < minZ) minZ = z;
      if (distance > maxDistance) maxDistance = distance;
    }
  });

  return {
    loadedPoints,
    worldBounds: {
      minX: worldBox.min.x,
      maxX: worldBox.max.x,
      minY: worldBox.min.y,
      maxY: worldBox.max.y,
      minZ: worldBox.min.z,
      maxZ: worldBox.max.z
    },
    dataBounds: { minX, maxX, minY, maxY, minZ, maxZ },
    maxDistance
  };
}
