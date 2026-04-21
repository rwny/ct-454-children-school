# 3D Interactive Clipping Controls Implementation Guide

## Overview
This guide describes how to implement 3D interactive controls that float over the 3D building model and allow direct manipulation of clipping planes through mouse dragging.

## Concept
Replace 2D HTML sliders with 3D objects that exist in the scene:
- Small cubes positioned at clipping plane locations
- Visual representation of each clipping plane
- Direct manipulation through mouse drag interactions
- Spatial consistency regardless of camera rotation

## Implementation Strategy

### 1. 3D Control Objects
Create visual indicators for each clipping plane:
```javascript
// Y-axis (vertical) clipping control
const yControlGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const yControlMaterial = new THREE.MeshBasicMaterial({ 
  color: 0x00ff00,  // Green for Y-axis
  wireframe: true 
});
const yControl = new THREE.Mesh(yControlGeometry, yControlMaterial);

// X-axis clipping control
const xControlGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const xControlMaterial = new THREE.MeshBasicMaterial({ 
  color: 0xff0000,  // Red for X-axis 
  wireframe: true 
});
const xControl = new THREE.Mesh(xControlGeometry, xControlMaterial);
```

### 2. Initial Positioning
Position controls at current clipping plane locations:
```javascript
// Position Y-control at current Y-clipping plane height
yControl.position.set(0, currentYPlaneConstant, 0);

// Position X-control at current X-clipping plane X-coordinate
xControl.position.set(currentXPlaneConstant, 0, 0);
```

### 3. Raycasting for Mouse Interactions
Implement mouse picking to detect control selection:
```javascript
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseDown(event) {
  // Calculate mouse position in normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);
  
  // Calculate objects intersecting the picking ray
  const intersects = raycaster.intersectObjects([yControl, xControl]);
  
  if (intersects.length > 0) {
    selectedObject = intersects[0].object;
    // Prepare for dragging
  }
}
```

### 4. Drag Controls
Implement dragging functionality using `THREE.DragControls`:
```javascript
import { DragControls } from 'three/addons/controls/DragControls.js';

const controls = new DragControls([yControl, xControl], camera, renderer.domElement);

controls.addEventListener('dragstart', function(event) {
  // Disable orbit controls during drag
  orbitControls.enabled = false;
});

controls.addEventListener('drag', function(event) {
  const draggedObject = event.object;
  
  if (draggedObject === yControl) {
    // Update Y-clipping plane
    updateYClipping(draggedObject.position.y);
  } else if (draggedObject === xControl) {
    // Update X-clipping plane based on current mode
    if (window.currentXMode === 'left') {
      // Update X-plane position for left clipping
      window.xClippingPlane.constant = draggedObject.position.x;
    } else {
      // Update X-plane position for right clipping
      window.xClippingPlane.constant = draggedObject.position.x;
    }
  }
});

controls.addEventListener('dragend', function(event) {
  // Re-enable orbit controls
  orbitControls.enabled = true;
  updateActivePlanes();
});
```

### 5. Constrain Movement
Constrain controls to appropriate axes:
```javascript
// For Y-control, constrain to Y-axis movement only
yControl.userData.axisConstraint = 'Y';

// For X-control, constrain to X-axis movement only  
xControl.userData.axisConstraint = 'X';

// Apply constraints during drag
function applyAxisConstraint(object, axis) {
  switch(axis) {
    case 'X':
      object.position.y = 0;  // Lock Y position
      object.position.z = 0;  // Lock Z position
      break;
    case 'Y':
      object.position.x = 0;  // Lock X position
      object.position.z = 0;  // Lock Z position
      break;
  }
}
```

### 6. Visual Feedback
Provide visual feedback during interaction:
```javascript
// Highlight control when hovered
controls.addEventListener('hoveron', function(event) {
  event.object.material.color.set(0xffff00);  // Yellow highlight
});

controls.addEventListener('hoveroff', function(event) {
  // Restore original color based on axis
  if (event.object === yControl) {
    event.object.material.color.set(0x00ff00);  // Green
  } else if (event.object === xControl) {
    event.object.material.color.set(0xff0000);  // Red
  }
});
```

### 7. Plane Visualization
Optionally visualize the clipping planes:
```javascript
// Create semi-transparent planes to visualize clipping boundaries
function createPlaneVisualization(plane, color) {
  const planeGeometry = new THREE.PlaneGeometry(50, 50);
  const planeMaterial = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.3
  });
  const planeVisual = new THREE.Mesh(planeGeometry, planeMaterial);
  
  // Orient the visual to match the clipping plane
  planeVisual.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),  // Default up vector
    plane.normal.clone().normalize()
  );
  
  return planeVisual;
}
```

### 8. Integration with Existing System
Modify the existing clipping system to work with 3D controls:
```javascript
// Update 3D control positions when clipping planes change programmatically
function syncControlsToPlanes() {
  yControl.position.y = window.yClippingPlane.constant;
  xControl.position.x = window.xClippingPlane.constant;
}

// Update clipping planes when 3D controls move
function updateClippingPlanesFromControls() {
  window.yClippingPlane.constant = yControl.position.y;
  
  if (window.currentXMode === 'left') {
    window.xClippingPlane.normal.set(1, 0, 0);
    window.xClippingPlane.constant = xControl.position.x;
  } else {
    window.xClippingPlane.normal.set(-1, 0, 0);
    window.xClippingPlane.constant = xControl.position.x;
  }
}
```

## Benefits

### Spatial Consistency
- Controls remain in proper relation to the 3D model regardless of camera rotation
- No confusion when viewing from different angles
- Direct spatial relationship between control and clipping effect

### Intuitive Interaction
- Direct manipulation in 3D space
- Immediate visual feedback
- Natural connection between control position and clipping plane location

### Visual Clarity
- See exactly where clipping planes are located
- Understand the relationship between controls and effects
- Spatial awareness of clipping boundaries

## Potential Challenges

### Performance
- Additional geometry for controls and plane visualization
- Raycasting calculations for interaction detection
- Need to optimize for smooth interaction

### Complexity
- More complex interaction handling
- Need to manage multiple simultaneous interactions
- Requires careful state management

### Visibility
- Controls might be occluded by the model
- Need to ensure controls remain visible and accessible
- Consider depth testing and rendering order

## Future Enhancements

### Advanced Controls
- Arrow handles for precise axis-aligned movement
- Plane gizmos showing clipping plane extent
- Multiple control points for complex clipping shapes

### Interaction Modes
- Click-and-drag for precise positioning
- Scroll wheel for fine adjustments
- Keyboard shortcuts for preset positions

This implementation would provide a much more intuitive and spatially-consistent way to control clipping planes compared to 2D sliders.