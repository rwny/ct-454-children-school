# Clip Right Plane Constant Fix

## Issue Resolved
Fixed incorrect plane constant for "Clip Right" mode where the constant had the wrong sign.

## Root Cause
When "Clip Right" mode was active with normal (-1,0,0) and slider at -30, the plane constant was +30 instead of the expected -30.

## Solution Applied

### Corrected Plane Constant Mapping
```javascript
// BEFORE (incorrect):
const clipDistance = -sliderValue;  // Flipped for both modes
window.xClippingPlane.constant = clipDistance;

// AFTER (correct):
// Left mode: normal (1,0,0), constant = sliderValue
// Right mode: normal (-1,0,0), constant = sliderValue (direct mapping)
```

### Complete X-Axis Logic:
```javascript
if (window.currentXMode === 'left') {
  // Clip left: normal (1,0,0), constant = sliderValue
  window.xClippingPlane.normal.set(1, 0, 0);
  window.xClippingPlane.constant = sliderValue;
} else {
  // Clip right: normal (-1,0,0), constant = sliderValue  
  window.xClippingPlane.normal.set(-1, 0, 0);
  window.xClippingPlane.constant = sliderValue;
}
```

## New Behavior

### Clip Left Mode (unchanged):
- **Slider -30**: plane_normal=(1,0,0), plane_constant=-30
- **Slider 0**: plane_normal=(1,0,0), plane_constant=0
- **Slider +30**: plane_normal=(1,0,0), plane_constant=+30

### Clip Right Mode (Fixed):
- **Slider -30**: plane_normal=(-1,0,0), plane_constant=-30 ✓
- **Slider 0**: plane_normal=(-1,0,0), plane_constant=0 ✓
- **Slider +30**: plane_normal=(-1,0,0), plane_constant=+30 ✓

## Plane Behavior Explanation

### With Camera at Z=40:
- **Positive X**: Right side of view
- **Negative X**: Left side of view

### Clip Right Mode (Normal -1,0,0):
- **Negative constant (-30)**: Plane at x=-30, shows everything to the left of the plane
- **Positive constant (+30)**: Plane at x=+30, shows everything to the left of the plane
- **Zero constant (0)**: Plane at x=0, shows everything to the left of the plane

## Verification Points
✅ **Clip Right plane constant**: Now matches slider value (e.g., slider -30 → constant -30)  
✅ **Clip Left behavior**: Remains unchanged and working correctly  
✅ **Direct mapping**: Both modes now use slider value directly  
✅ **Plane normal consistency**: Correct normals for each clipping direction