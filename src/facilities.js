import * as THREE from 'three';

let cctvGroup = new THREE.Group();
let powerLinesGroup = new THREE.Group();

export function initFacilities(scene, gltfLoader) {
   scene.add(cctvGroup);
   scene.add(powerLinesGroup);
   
   createCCTVCones(gltfLoader);
   // createPowerLines(); // Disabled power lines as requested
   
   // Initially hidden
   cctvGroup.visible = false;
   powerLinesGroup.visible = false;
}

function createCCTVCones(gltfLoader) {
   const greenMat = new THREE.MeshBasicMaterial({
      color: 0x4CAF50,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
   });

   gltfLoader.load('./gltf/cctv.glb', (gltf) => {
      const model = gltf.scene;
      
      // Apply green transparent material to all meshes in the model
      model.traverse((child) => {
         if (child.isMesh) {
            child.material = greenMat;
         }
      });

      // GLB already contains multiple cameras at correct positions
      model.position.set(-6, -5, 25); // Match main model shift
      cctvGroup.add(model);
   });
}

function createPowerLines() {
   // Main power lines running along the side of the building
   const points = [
      new THREE.Vector3(-65, 8, 35),
      new THREE.Vector3(-30, 8.5, 38),
      new THREE.Vector3(0, 8, 40),
      new THREE.Vector3(30, 8.5, 38),
      new THREE.Vector3(65, 8, 35)
   ];
   
   const curve = new THREE.CatmullRomCurve3(points);
   const geometry = new THREE.TubeGeometry(curve, 64, 0.08, 8, false);
   const material = new THREE.MeshBasicMaterial({ color: 0x111111 });
   const line = new THREE.Mesh(geometry, material);
   
   // Add Electric Poles
   points.forEach(p => {
      const poleGeo = new THREE.CylinderGeometry(0.2, 0.3, 10);
      const poleMat = new THREE.MeshBasicMaterial({ color: 0x332211 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(p.x, 5, p.z);
      powerLinesGroup.add(pole);

      // Cross-arm
      const armGeo = new THREE.BoxGeometry(2, 0.2, 0.2);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(p.x, 8, p.z);
      powerLinesGroup.add(arm);
   });

   powerLinesGroup.add(line);
}

export function toggleCCTV() {
   cctvGroup.visible = !cctvGroup.visible;
   return cctvGroup.visible;
}

export function togglePowerLines() {
   powerLinesGroup.visible = !powerLinesGroup.visible;
   return powerLinesGroup.visible;
}
