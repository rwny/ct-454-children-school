# Axis Correction - Y-Axis Clipping Plane

## Issue Identified
Was clipping on blue (Z) axis instead of requested green (Y) axis for vertical building sections.

## Solution Applied

### Changed from Z-axis to Y-axis clipping:
- **Previous**: `new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)` - Blue axis
- **Current**: `new THREE.Plane(new THREE.Vector3(0, -1, 0), 20)` - Green axis

### Corrected Mapping Logic:
- **Slider 20** → Plane Constant 20 → Show full building (cut above roof)
- **Slider 10** → Plane Constant 10 → Show bottom half (cut at 10m)
- **Slider 1** → Plane Constant 1 → Show only foundation (cut at 1m)
- **Slider 0** → Plane Constant 0 → Show nothing

### Code Changes:
1. **Plane definitions updated** to use Y-normal vector `(0, -1, 0)`
2. **Initial constants** set to 20 for full visibility
3. **Mapping reverted** to direct relationship: `planeConstant = cutoffHeight`
4. **Debug labels** updated from "Z-Plane" to "Y-Plane"

## Expected Behavior:
- Slider moves DOWN from 20m → Building slices from top (roof) downward
- Passes through: Roof → 2nd floor → 1st floor → Foundation
- Ends at 1m showing only basement/foundation level

## Verification Points:
- Axis helper shows green arrow for clipping direction
- Test cube should clip vertically (same as building)
- Slider 20 shows complete structure
- Slider 1 shows only foundation