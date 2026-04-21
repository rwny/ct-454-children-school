# Single X-Axis Clipping with Mode Selection

## System Design

Replaced dual X-axis sliders with a single slider and radio button selection to prevent both sides from disappearing simultaneously.

## Control Structure

### Radio Button Options:
- **Clip Left Side**: Clips the left portion of the model (+X direction)
- **Clip Right Side**: Clips the right portion of the model (-X direction)  
- **Show Both Sides**: Neutral position, displays full model width

### Single Slider:
- **Range**: -20 to +20 units
- **Function**: Controls clipping position based on selected mode
- **Reset**: Returns to 0 when switching modes

## HTML Structure

```html
<div class="radio-group">
  <label class="radio-option">
    <input type="radio" name="x-clip-mode" value="left" id="clip-left-radio">
    <span>Clip Left Side</span>
  </label>
  <label class="radio-option">
    <input type="radio" name="x-clip-mode" value="right" id="clip-right-radio">
    <span>Clip Right Side</span>
  </label>
  <label class="radio-option">
    <input type="radio" name="x-clip-mode" value="both" id="clip-both-radio" checked>
    <span>Show Both Sides</span>
  </label>
</div>

<input type="range" id="x-clip-slider" min="-20" max="20" value="0">
```

## Three.js Implementation

### Single Dynamic Plane:
```javascript
// Single X-axis clipping plane that changes behavior
const xClippingPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);

// Mode-based configuration:
if (window.currentXMode === 'left') {
  xClippingPlane.normal.set(-1, 0, 0);  // Face left
  xClippingPlane.constant = sliderValue; // Positive values clip more
} else if (window.currentXMode === 'right') {
  xClippingPlane.normal.set(1, 0, 0);   // Face right  
  xClippingPlane.constant = -sliderValue; // Negative values clip more
} else {
  xClippingPlane.constant = 1000; // Far away, shows everything
}
```

## Coordinate System Mapping

Based on camera orientation where:
- **Left = +X** direction (from camera perspective)
- **Right = -X** direction (from camera perspective)

### Mode Behaviors:
- **Left Clip Mode**: 
  - Slider -20: Shows full left side
  - Slider +20: Clips more left side
  - Normal faces left (-1,0,0)

- **Right Clip Mode**:
  - Slider -20: Shows full right side  
  - Slider +20: Clips more right side
  - Normal faces right (1,0,0)

- **Both Sides Mode**:
  - Plane positioned far away
  - Shows complete model width

## User Interaction Flow

1. **Select Mode**: Choose left, right, or both sides
2. **Adjust Position**: Use slider to control clipping depth
3. **Switch Modes**: Radio buttons automatically reset slider to 0
4. **Combine with Y**: Works independently with vertical clipping

## Prevention of Complete Disappearance

✅ **Single Active Plane**: Only one X-clipping plane active at a time
✅ **Mode Exclusivity**: Radio buttons ensure mutual exclusion
✅ **Neutral Default**: "Show Both Sides" prevents accidental full clipping
✅ **Slider Reset**: Mode changes reset position to safe neutral value

## Technical Benefits

- **Safety**: Impossible to clip both sides simultaneously
- **Simplicity**: Single slider easier to understand and control
- **Flexibility**: All three viewing modes available
- **Consistency**: Clear visual feedback through radio selection
- **Performance**: Fewer active clipping planes when not needed

## Use Cases

- **Focused Inspection**: Examine one side of building at a time
- **Comparison Views**: Easily switch between left/right perspectives
- **Safe Exploration**: No risk of losing entire model
- **Educational Tool**: Clear demonstration of directional clipping