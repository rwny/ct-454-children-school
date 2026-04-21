import * as THREE from 'three';

let firstPersonCamera;
let sceneRef;

// State management
let playerPos = new THREE.Vector3(0, 0, 0);
let playerYaw = 0;
let playerPitch = 0;
let groundLevel = 0; 

let moveState = {
   forward: false,
   backward: false,
   left: false,
   right: false,
   sprint: false,
   jump: false,
   speed: 0.1,
   sprintSpeed: 0.25,
   velocity: new THREE.Vector3(0, 0, 0),
   isGrounded: true,
   jumpStrength: 0.2,
   gravity: 0.008,
   eyeHeight: 1.7,
   baseEyeHeight: 1.7
};

let isMouseDown = false;

export function initWalkMode(renderer, scene) {
   sceneRef = scene;
   firstPersonCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
   firstPersonCamera.rotation.order = 'YXZ';

   initMouseLook();
   return firstPersonCamera;
}

export function switchToWalkMode(renderer, controls) {
   // 1. Position: Snap to Ground (0)
   playerPos.set(controls.object.position.x, 0, controls.object.position.z);
   groundLevel = 0; 
   moveState.isGrounded = true;

   // 2. Extract orientation robustly
   const tempEuler = new THREE.Euler().setFromQuaternion(controls.object.quaternion, 'YXZ');
   playerYaw = tempEuler.y - Math.PI;
   playerPitch = tempEuler.x;

   controls.object = firstPersonCamera;
   controls.enabled = false;

   renderer.localClippingEnabled = false;
   renderer.clippingPlanes = [];

   const uiCameraMode = document.getElementById('ui-camera-mode');
   if (uiCameraMode) uiCameraMode.textContent = 'Mode: Walk';

   return firstPersonCamera;
}

export function exitWalkMode() {
}

export function handleWalkKeyDown(event) {
   switch (event.code) {
      case 'KeyW': moveState.forward = true; break;
      case 'KeyS': moveState.backward = true; break;
      case 'KeyA': moveState.left = true; break;
      case 'KeyD': moveState.right = true; break;
      case 'ShiftLeft':
      case 'ShiftRight': moveState.sprint = true; break;
      case 'Space':
         if (moveState.isGrounded) {
            moveState.velocity.y = moveState.jumpStrength;
            moveState.isGrounded = false;
         }
         break;
      case 'KeyC':
         // Toggle height: Base (1.7) <-> Base + 1.8 (3.5)
         if (moveState.eyeHeight <= moveState.baseEyeHeight + 0.1) {
            moveState.eyeHeight = moveState.baseEyeHeight + 1.8;
         } else {
            moveState.eyeHeight = moveState.baseEyeHeight;
         }
         console.log(`Eye height: ${moveState.eyeHeight.toFixed(2)}m`);
         break;
   }
}

export function handleWalkKeyUp(event) {
   switch (event.code) {
      case 'KeyW': moveState.forward = false; break;
      case 'KeyS': moveState.backward = false; break;
      case 'KeyA': moveState.left = false; break;
      case 'KeyD': moveState.right = false; break;
      case 'ShiftLeft':
      case 'ShiftRight': moveState.sprint = false; break;
   }
}

const clock = new THREE.Clock();

export function updateWalkMode() {
   const delta = clock.getDelta();

   // 1. Movement logic
   const direction = new THREE.Vector3();
   if (moveState.forward) direction.z += 1;
   if (moveState.backward) direction.z -= 1;
   if (moveState.left) direction.x += 1;
   if (moveState.right) direction.x -= 1;

   if (direction.lengthSq() > 0) {
      direction.normalize();
      // Movement relative to current orientation
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw);
      const currentSpeed = moveState.sprint ? moveState.sprintSpeed : moveState.speed;
      playerPos.add(direction.multiplyScalar(currentSpeed));
   }

   // 2. Physics / Gravity
   if (!moveState.isGrounded) {
      moveState.velocity.y -= moveState.gravity;
      playerPos.y += moveState.velocity.y;
      if (playerPos.y <= groundLevel) {
         playerPos.y = groundLevel;
         moveState.velocity.y = 0;
         moveState.isGrounded = true;
      }
   }

   // 3. Update Camera Position and Rotation
   firstPersonCamera.position.copy(playerPos);
   firstPersonCamera.position.y += moveState.eyeHeight;
   
   // Apply yaw and pitch to camera
   // THREE camera -Z is forward, so we offset yaw by PI
   firstPersonCamera.rotation.set(playerPitch, playerYaw + Math.PI, 0, 'YXZ');
}

function initMouseLook() {
   // Click and drag to look around
   document.addEventListener('mousedown', (event) => {
      if (window.isUiInteracting) return;
      isMouseDown = true;
   });

   document.addEventListener('mouseup', () => {
      isMouseDown = false;
   });

   document.addEventListener('mousemove', (event) => {
      if (window.isUiInteracting) return;
      
      if (isMouseDown) {
         const sensitivity = 0.002;
         playerYaw -= event.movementX * sensitivity;
         playerPitch -= event.movementY * sensitivity;
         
         // Clamp pitch to avoid flipping
         playerPitch = Math.max(-Math.PI/2.1, Math.min(Math.PI/2.1, playerPitch));
      }
   });
}
