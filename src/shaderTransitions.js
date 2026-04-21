// src/shaderTransitions.js
import * as THREE from 'three';

// Create shader function that supports both distance and Y-based animations
export function createAnimationShader(animationUniforms) {
return function(shader) {
   shader.uniforms.uTime = animationUniforms.uTime;
   shader.uniforms.uMaxDistance = animationUniforms.uMaxDistance;
   shader.uniforms.uMaxY = animationUniforms.uMaxY;
   shader.uniforms.uColorMinY = animationUniforms.uColorMinY;
   shader.uniforms.uColorMaxY = animationUniforms.uColorMaxY;
   shader.uniforms.uColorMode = animationUniforms.uColorMode;
   shader.uniforms.uSolidColor = animationUniforms.uSolidColor;
   shader.uniforms.uAnimationType = animationUniforms.uAnimationType;
   
   shader.vertexShader = `
   varying float vDist;
   varying float vYPos;
   varying float vWorldY;
   float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
   }
   ${shader.vertexShader}
   `.replace(
   `#include <begin_vertex>`,
   `
   #include <begin_vertex>
   vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );
   float distNoise = hash(worldPosition.xyz) * 5.0;
   vDist = length(worldPosition.xyz) + distNoise;
   float yPosNoise = hash(worldPosition.xyz) * 0.5;
   vYPos = worldPosition.y + yPosNoise;
   vWorldY = worldPosition.y;
   `
   );

   shader.fragmentShader = `
   uniform float uTime;
   uniform float uMaxDistance;
   uniform float uMaxY;
   uniform float uColorMinY;
   uniform float uColorMaxY;
   uniform float uColorMode;
   uniform vec3 uSolidColor;
   uniform float uAnimationType;
   varying float vDist;
   varying float vYPos;
   varying float vWorldY;
   vec3 hsv2rgb(vec3 c) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
   }
   ${shader.fragmentShader}
   `.replace(
   `#include <clipping_planes_fragment>`,
   `
   #include <clipping_planes_fragment>
   // Make points circular
   if (length(gl_PointCoord - 0.5) > 0.5) discard;
   float threshold;
   if (uAnimationType < 0.5) {
      // Distance-based animation
      threshold = uTime * uMaxDistance;
      if (vDist > threshold) discard;
   } else {
      // Y-based animation (bottom to top)
      threshold = uTime * uMaxY;
      if (vYPos > threshold) discard;
   }
   `
   ).replace(
   `#include <color_fragment>`,
   `
   #include <color_fragment>
   if (uColorMode > 1.5) {
      // Mode 2: Y-based gradient in HSV, red (0.0) -> blue (2/3) along increasing hue (counter-clockwise)
      float yRange = max(uColorMaxY - uColorMinY, 0.0001);
      float yNorm = clamp((vWorldY - uColorMinY) / yRange, 0.0, 1.0);
      float hue = (2.0 / 3.0) * yNorm;
      diffuseColor.rgb = hsv2rgb(vec3(hue, 1.0, 1.0));
   } else if (uColorMode > 0.5) {
      diffuseColor.rgb = uSolidColor;
   }
   `
   );
};
}

// Utility functions to set animation types
export function setDistanceAnimation(animationUniforms) {
animationUniforms.uAnimationType.value = 0.0;
}

export function setYAnimation(animationUniforms) {
animationUniforms.uAnimationType.value = 1.0;
}

// Function to initialize animation uniforms
export function initAnimationUniforms() {
return {
   uTime: { value: 0.0 },
   uMaxDistance: { value: 100.0 }, // Max distance from origin (for distance-based animation)
   uMaxY: { value: 15.0 },        // Max Y value (for Y-based animation)
   uColorMinY: { value: -10.0 },  // Min world Y for gradient mapping
   uColorMaxY: { value: 10.0 },   // Max world Y for gradient mapping
   uColorMode: { value: 0.0 },    // 0: original, 1: black, 2: Y gradient (red->blue)
   uSolidColor: { value: new THREE.Color(0x000000) }, // Custom solid color for black mode
   uAnimationType: { value: 1.0 } // 0: distance-based, 1: Y-based
};
}
