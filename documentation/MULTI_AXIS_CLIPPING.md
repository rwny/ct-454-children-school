# Multi-Axis Clipping Plane System

## System Overview

Implemented a comprehensive 3D sectioning system with independent control over Y-axis (height) and X-axis (width) clipping planes, each with toggle switches for activation.

## Control Structure

### Y-Axis Clipping (Vertical Section)
- **Toggle**: "Height Section" switch (enabled by default)
- **Slider**: Vertical slider (1-15m range)
- **Direction**: Clips from top-down along green (Y) axis
- **Behavior**: Values 15→1m progressively reveal building sections

### X-Axis Clipping (Horizontal Sections)
- **Toggle**: "Width Section" switch (disabled by default)
- **Left Clip Slider**: -20 to +20 range (+X direction)
- **Right Clip Slider**: -20 to +20 range (-X direction)
- **Behavior**: Independent left/right side clipping

## HTML Structure

```html
<!-- Y-Axis Control -->
<div class="control-group">
  <label class="toggle-switch">
    <input type="checkbox" id="y-toggle" checked>
    <span>Height Section</span>
  </label>
  <div class="slider-container">
    <input type="range" id="y-clipping-slider" min="1" max="15">
    <div class="slider-value" id="height-display">15.0m</div>
  </div>
</div>

<!-- X-Axis Control -->
<div class="control-group">
  <label class="toggle-switch">
    <input type="checkbox" id="x-toggle">
    <span>Width Section</span>
  </label>
  <div class="x-sliders-container">
    <input type="range" id="left-clip-slider" min="-20" max="20">
    <input type="range" id="right-clip-slider" min="-20" max="20">
  </div>
</div>
```

## Three.js Implementation

### Plane Definitions:
```javascript
// Y-axis (vertical section)
const yClippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 20);

// X-axis planes (horizontal sections)
const leftClippingPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 20);  // +X direction
const rightClippingPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 20);   // -X direction
```

### Dynamic Plane Management:
```javascript
function updateActivePlanes() {
  const newPlanes = [];
  
  if (yToggle.checked) {
    newPlanes.push(yClippingPlane);
  }
  
  if (xToggle.checked) {
    newPlanes.push(leftClippingPlane, rightClippingPlane);
  }
  
  renderer.clippingPlanes = newPlanes;
}
```

## Coordinate System Mapping

Based on camera position where:
- **Left = +X** direction (from camera perspective)
- **Right = -X** direction (from camera perspective)
- **Up = +Y** direction (height)

### Slider Behaviors:
- **Y-Slider**: 15m (top) → 1m (bottom) 
- **Left Slider**: +20 (open) → -20 (closed from left)
- **Right Slider**: -20 (open) → +20 (closed from right)

## User Interaction Flow

1. **Default State**: Only Y-axis clipping enabled (full building visible)
2. **Enable X-clipping**: Toggle "Width Section" to activate horizontal planes
3. **Adjust Sections**: Independently control vertical and horizontal clipping
4. **Combine Effects**: Use both systems simultaneously for complex cross-sections

## Technical Features

✅ Independent toggle controls for each axis system  
✅ Real-time plane constant updates  
✅ Dynamic renderer clipping plane assignment  
✅ Proper coordinate system mapping  
✅ Smooth value display updates  
✅ Responsive event handling  
✅ Console logging for debugging  

## Use Cases

- **Building analysis**: Slice through structures horizontally and vertically
- **Architectural visualization**: Examine interior layouts
- **Engineering inspection**: Focus on specific structural sections
- **Educational purposes**: Demonstrate 3D spatial relationships