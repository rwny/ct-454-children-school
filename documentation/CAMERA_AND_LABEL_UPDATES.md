# UI Labeling and Camera Position Updates

## Changes Made

### 1. UI Label Updates
- **Height Section** → **Level** (more intuitive for vertical slicing)
- **Width Section** → **Section** (simpler, cleaner terminology)

### 2. Camera and Model Positioning
- **Camera moved**: Z = -40 → Z = +40 (front view instead of back view)
- **Model rotated**: Added 180° Y-axis rotation to compensate
- **Coordinate system**: Adjusted X-clipping logic to match new orientation

## Technical Implementation

### Camera Position Change:
```javascript
// BEFORE:
camera.position.set(15, 25, -40);  // Back view

// AFTER:  
camera.position.set(15, 25, 40);   // Front view
```

### Model Rotation:
```javascript
// Added 180-degree rotation on Y-axis
points.rotation.y = Math.PI;  // 180 degrees
```

### X-Axis Clipping Adjustment:
Due to the 180° rotation, left/right directions are swapped in the clipping logic:

```javascript
// BEFORE rotation compensation:
if (window.currentXMode === 'left') {
  window.xClippingPlane.normal.set(-1, 0, 0);  // Face left
} else {
  window.xClippingPlane.normal.set(1, 0, 0);   // Face right
}

// AFTER rotation compensation:
if (window.currentXMode === 'left') {
  window.xClippingPlane.normal.set(1, 0, 0);   // Face right (appears left)
} else {
  window.xClippingPlane.normal.set(-1, 0, 0);  // Face left (appears right)
}
```

## Impact on User Experience

### Visual Improvements:
✅ **Better viewing angle**: Front view is more intuitive for building inspection
✅ **Natural interaction**: Controls match visual perspective
✅ **Clearer labeling**: "Level" and "Section" are more descriptive

### Functional Benefits:
✅ **Consistent mapping**: Slider directions now match visual expectations
✅ **Smooth transitions**: Left/right switching works intuitively
✅ **Proper orientation**: Model displays correctly from new camera angle

## Coordinate System Mapping (Post-Rotation)

With 180° Y-rotation:
- **Slider "Left"** → Actually clips the **right side** of the original model
- **Slider "Right"** → Actually clips the **left side** of the original model
- **Positive X values** → Now point toward what visually appears as "left"
- **Negative X values** → Now point toward what visually appears as "right"

## Verification Points
- ✅ Camera positioned at Z=+40 (front view)
- ✅ Model rotated 180° to maintain correct orientation
- ✅ X-clipping logic adjusted for new coordinate system
- ✅ UI labels updated for clarity
- ✅ All clipping functionality preserved