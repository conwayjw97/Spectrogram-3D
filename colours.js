import * as THREE from 'three';

export const COLOUR_SCHEMES = {
  standard: {
    base: new THREE.Color('#002b00'), // Dark Green Base
    low:  new THREE.Color('#00ff00'), // Bright Green
    mid:  new THREE.Color('#ffff00'), // Yellow
    high: new THREE.Color('#ff0000')  // Red
  },
  synthwave: {
    base: new THREE.Color('#10002b'), // Deep Dark Violet
    low:  new THREE.Color('#5a189a'), // Mid Purple
    mid:  new THREE.Color('#ff007f'), // Neon Pink
    high: new THREE.Color('#00f0ff')  // Electric Cyan
  },
  glacier: {
    base: new THREE.Color('#020c1b'), // Deep Abyssal Blue
    low:  new THREE.Color('#051923'), // Navy
    mid:  new THREE.Color('#00a6fb'), // Ice Blue
    high: new THREE.Color('#ffffff')  // Pure White
  },
  magma: {
    base: new THREE.Color('#000004'), // Near Black
    low:  new THREE.Color('#51127c'), // Deep Purple
    mid:  new THREE.Color('#b5367a'), // Flame Magenta
    high: new THREE.Color('#fcfdbf')  // Bright Yellow
  },
  cyberpunk: {
    base: new THREE.Color('#0d0221'), // Dark Indigo
    low:  new THREE.Color('#200122'), // Dark Violet
    mid:  new THREE.Color('#ff0055'), // Neon Red
    high: new THREE.Color('#ffcc00')  // Bright Gold
  }
};

/**
 * Updates a material's colour uniforms in-place without re-initialising shaders.
 */
export function applyColourScheme(material, schemeKey) {
  const scheme = COLOUR_SCHEMES[schemeKey] || COLOUR_SCHEMES.standard;
  if (material && material.uniforms) {
    if (material.uniforms.u_colorBase) material.uniforms.u_colorBase.value.copy(scheme.base);
    if (material.uniforms.u_colorLow)  material.uniforms.u_colorLow.value.copy(scheme.low);
    if (material.uniforms.u_colorMid)  material.uniforms.u_colorMid.value.copy(scheme.mid);
    if (material.uniforms.u_colorHigh) material.uniforms.u_colorHigh.value.copy(scheme.high);
  }
}