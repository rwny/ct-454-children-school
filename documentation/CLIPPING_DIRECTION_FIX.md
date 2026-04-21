# Clipping Plane Direction Fix

## Issue Resolved
The slider direction was inverted - slider 0 showed everything and slider 20 showed nothing. This has been fixed.

## Root Cause
The mapping between slider values and clipping plane constants was incorrect. The plane constant controls where the clipping plane intersects the axis, and the relationship wasn't properly inverted.

## Solution Applied

### Corrected Mapping Logic:
- **Slider 0** → Plane Constant 20 → Show nothing (cut at ground level)
- **Slider 20** → Plane Constant 0 → Show everything (cut above building)
- **Slider 10** → Plane Constant 10 → Show bottom half of building

### Code Changes:

1. **Inverted the mapping formula**:
   ```javascript
   // OLD (incorrect):
   const planeConstant = cutoffHeight;
   
   // NEW (correct):
   const planeConstant = 20 - cutoffHeight;
   ```

2. **Updated initial plane constants**:
   ```javascript
   // Both initial planes now start with constant = 0 (show everything)
   const initialClippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
   const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
   ```

3. **Enhanced debug logging**:
   ```javascript
   console.log(`Z-Plane updated: slider=${cutoffHeight}m, plane_constant=${planeConstant}`);
   ```

## Verification
After the fix:
- Moving slider left (0) → Building disappears from top down
- Moving slider right (20) → Full building visible
- Intermediate values → Cross-sectional view at that height

## Coordinate System Note
The clipping uses Z-axis because the point cloud is rotated -90° on X-axis, making the original Z-coordinates correspond to the displayed Y-height.