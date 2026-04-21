import * as THREE from 'three';

// Material factory for point cloud visualization
export class PointMaterialFactory {

// Red material
static createRedMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0xff0000,
   sizeAttenuation: true
   });
}

// Green material
static createGreenMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0x00ff00,
   sizeAttenuation: true
   });
}

// Blue material
static createBlueMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0x0000ff,
   sizeAttenuation: true
   });
}

// Black material
static createBlackMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0x000000,
   sizeAttenuation: true
   });
}

// White material
static createWhiteMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0xffffff,
   sizeAttenuation: true
   });
}

// Additional colors from W3Schools CSS colors
static createCrimsonMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0xdc143c,
   sizeAttenuation: true
   });
}

static createDodgerBlueMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0x1e90ff,
   sizeAttenuation: true
   });
}

static createForestGreenMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0x228b22,
   sizeAttenuation: true
   });
}

static createGoldMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0xffd700,
   sizeAttenuation: true
   });
}

static createHotPinkMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0xff69b4,
   sizeAttenuation: true
   });
}

static createIndigoMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0x4b0082,
   sizeAttenuation: true
   });
}

static createKhakiMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0xf0e68c,
   sizeAttenuation: true
   });
}

static createLimeGreenMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0x32cd32,
   sizeAttenuation: true
   });
}

static createMediumPurpleMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0x9370db,
   sizeAttenuation: true
   });
}

static createOrangeRedMaterial(size = 0.02) {
   return new THREE.PointsMaterial({
   size: size,
   color: 0xff4500,
   sizeAttenuation: true
   });
}

// Gradient Z material - black at min Z, white at max Z
static createGradientZMaterial(geometry, size = 0.02) {
   // Get Z positions from geometry
   const positions = geometry.attributes.position.array;
   let minZ = Infinity;
   let maxZ = -Infinity;
   
   // Find min and max Z values
   for (let i = 2; i < positions.length; i += 3) {
   const z = positions[i];
   if (z < minZ) minZ = z;
   if (z > maxZ) maxZ = z;
   }
   
   // Create color array
   const colors = new Float32Array(positions.length);
   
   // Assign colors based on Z position
   for (let i = 0; i < positions.length; i += 3) {
   const z = positions[i + 2]; // Z coordinate
   // Normalize Z to 0-1 range
   const normalizedZ = (z - minZ) / (maxZ - minZ);
   
   // Set RGB values (grayscale gradient)
   colors[i] = normalizedZ;     // R
   colors[i + 1] = normalizedZ; // G
   colors[i + 2] = normalizedZ; // B
   }
   
   // Create material with vertex colors
   const material = new THREE.PointsMaterial({
   size: size,
   vertexColors: true,
   sizeAttenuation: true
   });
   
   // Add colors to geometry
   geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
   
   return material;
}

// Helper method to update material size
static updateMaterialSize(material, newSize) {
   material.size = newSize;
   material.needsUpdate = true;
}

// Helper method to switch material color
static updateMaterialColor(material, color) {
   if (material.vertexColors) {
   // For vertex-colored materials, we'd need to recreate
   console.warn('Cannot change color of vertex-colored material');
   return material;
   }
   
   material.color.set(color);
   material.needsUpdate = true;
   return material;
}

// Get material by name
static getMaterialByName(name, size = 0.02, geometry = null) {
   switch(name.toLowerCase()) {
   case 'red':
      return this.createRedMaterial(size);
   case 'green':
      return this.createGreenMaterial(size);
   case 'blue':
      return this.createBlueMaterial(size);
   case 'black':
      return this.createBlackMaterial(size);
   case 'white':
      return this.createWhiteMaterial(size);
   case 'gradientz':
      if (geometry) {
         return this.createGradientZMaterial(geometry, size);
      } else {
         console.warn('GradientZ material requires geometry parameter');
         return this.createWhiteMaterial(size);
      }
   case 'crimson':
      return this.createCrimsonMaterial(size);
   case 'dodgerblue':
      return this.createDodgerBlueMaterial(size);
   case 'forestgreen':
      return this.createForestGreenMaterial(size);
   case 'gold':
      return this.createGoldMaterial(size);
   case 'hotpink':
      return this.createHotPinkMaterial(size);
   case 'indigo':
      return this.createIndigoMaterial(size);
   case 'khaki':
      return this.createKhakiMaterial(size);
   case 'limegreen':
      return this.createLimeGreenMaterial(size);
   case 'mediumpurple':
      return this.createMediumPurpleMaterial(size);
   case 'orangered':
      return this.createOrangeRedMaterial(size);
   default:
      console.warn(`Unknown material type: ${name}`);
      return this.createWhiteMaterial(size);
   }
}
}

// Export individual material creators for direct access
export const createRedMaterial = PointMaterialFactory.createRedMaterial;
export const createGreenMaterial = PointMaterialFactory.createGreenMaterial;
export const createBlueMaterial = PointMaterialFactory.createBlueMaterial;
export const createBlackMaterial = PointMaterialFactory.createBlackMaterial;
export const createWhiteMaterial = PointMaterialFactory.createWhiteMaterial;
export const createCrimsonMaterial = PointMaterialFactory.createCrimsonMaterial;
export const createDodgerBlueMaterial = PointMaterialFactory.createDodgerBlueMaterial;
export const createForestGreenMaterial = PointMaterialFactory.createForestGreenMaterial;
export const createGoldMaterial = PointMaterialFactory.createGoldMaterial;
export const createHotPinkMaterial = PointMaterialFactory.createHotPinkMaterial;
export const createIndigoMaterial = PointMaterialFactory.createIndigoMaterial;
export const createKhakiMaterial = PointMaterialFactory.createKhakiMaterial;
export const createLimeGreenMaterial = PointMaterialFactory.createLimeGreenMaterial;
export const createMediumPurpleMaterial = PointMaterialFactory.createMediumPurpleMaterial;
export const createOrangeRedMaterial = PointMaterialFactory.createOrangeRedMaterial;
export const createGradientZMaterial = PointMaterialFactory.createGradientZMaterial;

// Export factory as default
export default PointMaterialFactory;