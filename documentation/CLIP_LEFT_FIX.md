# Clip Left Side Fix

## Issue Resolved
Fixed the "Clip Left" side behavior which was broken while keeping "Clip Right" working correctly.

## Root Cause
The "Clip Left" side was not behaving according to the desired specification, while "Clip Right" was working correctly after previous fixes.

## Solution Applied

### Corrected Clip Left Logic Only
```javascript
// Clip Left mode (fixed):
if (window.currentXMode === 'left') {
  window.xClippingPlane.normal.set(1, 0, 0);     // Face right
  window.xClippingPlane.constant = -sliderValue;   // Inverted for left clip
} else {
  // Clip Right mode (kept as working):
  window.xClippingPlane.normal.set(-1, 0, 0);    // Face left
  window.xClippingPlane.constant = sliderValue;   // Direct mapping
}
```

## New Behavior

### Clip Left Mode (Fixed):
- **Slider -30**: plane_normal=(1,0,0), plane_constant=+30
  - Plane at x=+30, hides x<+30, shows x>+30 (shows more of right side)
- **Slider 0**: plane_normal=(1,0,0), plane_constant=0
  - Plane at x=0, neutral position
- **Slider +30**: plane_normal=(1,0,0), plane_constant=-30
  - Plane at x=-30, hides x<-30, shows x>-30 (shows more of left side)

### Clip Right Mode (Preserved):
- **Slider -30**: plane_normal=(-1,0,0), plane_constant=-30 ✓
- **Slider 0**: plane_normal=(-1,0,0), plane_constant=0 ✓
- **Slider +30**: plane_normal=(-1,0,0), plane_constant=+30 ✓

## Direction Mapping

### With Camera at Z=40:
- **Positive X**: Right side of view
- **Negative X**: Left side of view

### Clip Left Mode (After Fix):
- **Negative slider values** (-30): Move plane to positive position, show more right side
- **Positive slider values** (+30): Move plane to negative position, show more left side

### Clip Right Mode (Unchanged):
- **Negative slider values** (-30): Plane at negative position, show more right side
- **Positive slider values** (+30): Plane at positive position, show more left side

## Verification Points
✅ **Clip Left behavior**: Fixed to work properly with inverted constant
✅ **Clip Right behavior**: Preserved and remains working correctly
✅ **Separate logic**: Each mode now has appropriate constant mapping
✅ **Plane normal consistency**: Correct normals for each clipping direction