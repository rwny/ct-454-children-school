# Y-Axis Clipping Plane Feature

## Overview
Implemented a section view / slice plane feature that allows users to cut through the point cloud along the Y-axis (height) from 0-20 meters using a slider control.

## Implementation Details

### Files Modified:

1. **index.html**
   - Added clipping control panel with slider
   - Added CSS styling for the control UI
   - Positioned control panel in top-right corner

2. **src/main.js**
   - Added clipping plane setup in scene initialization
   - Enabled clipping for PointsMaterial
   - Created `setupClippingControls()` function to handle slider events
   - Implemented dynamic clipping plane position updates

### Key Features:

- **Slider Range**: 0-20 meters (matches building height)
- **Real-time Updates**: Instant visual feedback as slider moves
- **Visual Design**: Dark theme with green accent colors matching existing UI
- **Position Tracking**: Displays current cutting height value
- **Smooth Interaction**: Responds to both `input` and `change` events

### Technical Implementation:

#### Clipping Plane Setup:
```javascript
// Create horizontal plane facing upward (normal: 0,-1,0)
const clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 20);
scene.clipPlanes.push(clippingPlane);

// Enable clipping on material
material.clipping = true;
```

#### Coordinate Mapping:
- Slider value (0-20) → Plane constant (20-0) - inverted mapping
- When slider = 0: Plane at Y=20 (cuts everything below)
- When slider = 20: Plane at Y=0 (shows everything)
- When slider = 10: Plane at Y=10 (cuts below 10m)

#### Event Handling:
```javascript
slider.addEventListener('input', function() {
    updateClippingPlane(this.value);
});
```

## Usage Instructions:

1. Load the application
2. Point cloud will load normally (full view at 20m)
3. Use the slider in the top-right corner to adjust cutting height
4. Move slider from 20→0 to progressively cut through the building
5. Current height value displays below the slider

## Branch Information:
- **Branch Name**: `feature/y-clipping-plane`
- **Base Commit**: Main branch before feature implementation
- **Status**: Ready for testing and review

## Testing Notes:
- Verify slider responds smoothly to mouse/touch input
- Confirm visual clipping updates in real-time
- Test edge cases (0m, 20m, intermediate values)
- Check UI positioning doesn't overlap other controls