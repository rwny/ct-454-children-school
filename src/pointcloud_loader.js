import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

export const defaultPlyFiles = [
  './ply/metta-school.ply'
];

export async function loadPointClouds(options) {
  const {
    plyFiles,
    listUrl = '/ply/ply-list.json',
    loaderElement,
    clippingPlanes,
    animationUniforms
  } = options;

  let files = Array.isArray(plyFiles) ? plyFiles : null;
  if (!files) {
    try {
      const response = await fetch(listUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load ${listUrl}`);
      const data = await response.json();
      if (data && Array.isArray(data.files) && data.files.length > 0) {
        files = data.files.map((name) => `./ply/${name}`);
      }
    } catch (error) {
      console.warn('Using default PLY list due to load error:', error);
      files = defaultPlyFiles;
    }
  }

  if (!files || files.length === 0) {
    console.warn('PLY list is empty; using default list.');
    files = defaultPlyFiles;
  }

  const loader = new PLYLoader();
  const loadedPoints = [];

  for (let i = 0; i < files.length; i += 1) {
    const plyPath = files[i];
    try {
      const geometry = await new Promise((resolve, reject) => {
        loader.load(plyPath, resolve, undefined, reject);
      });

      geometry.computeVertexNormals();
      const material = new THREE.PointsMaterial({
        size: 0.02,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1.0,
        clippingPlanes: clippingPlanes || [],
        clipShadows: true
      });

      material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = animationUniforms.uTime;
        shader.uniforms.uMaxDistance = animationUniforms.uMaxDistance;
        shader.uniforms.uColorMode = animationUniforms.uColorMode;

        shader.vertexShader = `
          varying float vDist;
          float hash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }
          ${shader.vertexShader}
        `.replace(
          `#include <begin_vertex>`,
          `
          #include <begin_vertex>
          vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );
          float noise = hash(worldPosition.xyz) * 5.0;
          vDist = length(worldPosition.xyz) + noise;
          `
        );

        shader.fragmentShader = `
          uniform float uTime;
          uniform float uMaxDistance;
          uniform float uColorMode;
          varying float vDist;
          ${shader.fragmentShader}
        `.replace(
          `#include <clipping_planes_fragment>`,
          `
          #include <clipping_planes_fragment>
          if (vDist / uMaxDistance > uTime) discard;
          `
        ).replace(
          `#include <color_fragment>`,
          `
          #include <color_fragment>
          if (uColorMode > 0.5) {
            diffuseColor.rgb = vec3(0.0);
          }
          `
        );
      };

      if (!geometry.attributes.color) {
        material.vertexColors = false;
        material.color.set(0x00ffff);
      }

      const points = new THREE.Points(geometry, material);
      points.rotation.x = -Math.PI / 2;

      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        // หา bounding แล้ววางจุด center ปรับที่ xx zz อีกเพื่อให้ได้จุดกลางที่ต้องการ
        let mx = 5
        let mz = 5 
        points.position.set(-center.x+mx, 0, -center.z+mz);
      } else {
        points.position.set(0, 0, 0);
      }
      loadedPoints.push(points);

      if (loaderElement) {
        const percent = Math.round(((i + 1) / files.length) * 100);
        loaderElement.innerText = `Loading... ${percent}%`;
      }
    } catch (error) {
      console.error(`Failed to load ${plyPath}:`, error);
    }
  }

  let maxD = 0;
  loadedPoints.forEach((p) => {
    p.updateMatrixWorld();
    p.geometry.computeBoundingSphere();
    const center = p.geometry.boundingSphere.center.clone().applyMatrix4(p.matrixWorld);
    const radius = p.geometry.boundingSphere.radius;
    maxD = Math.max(maxD, center.length() + radius);
  });
  animationUniforms.uMaxDistance.value = maxD || 100;

  return loadedPoints;
}
