export const vertexShader = `
  uniform sampler2D u_audioTexture;
  uniform float u_writeIndex;   
  uniform float u_timeSamples;  
  varying vec2 vUv;
  varying float vElevation;     

  void main() {
    vUv = uv;

    float correctedY = (uv.y * (u_timeSamples - 1.0)) / u_timeSamples;
    vec2 circularUv = vec2(uv.x, mod(u_writeIndex - correctedY, 1.0));

    vec4 audioColor = texture2D(u_audioTexture, circularUv);
    float displacement = audioColor.r * 25.0;
    
    vElevation = displacement;

    vec3 displacedPosition = position;
    displacedPosition.y += displacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
  }
`;

export const solidFragmentShader = `
  uniform int u_colorScheme;
varying float vElevation;

void main() {
    // Normalise the world-space vertex height into a 0.0 to 1.0 factor
    float factor = clamp(vElevation / 25.0, 0.0, 1.0);
    vec3 finalColour = vec3(0.0);

    if (u_colorScheme == 0) {
        // Standard: Dark Green -> Neon Green -> Yellow -> Red
        if (factor < 0.33) {
            finalColour = mix(vec3(0.0, 0.25, 0.0), vec3(0.0, 1.0, 0.0), factor / 0.33);
        } else if (factor < 0.66) {
            finalColour = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 1.0, 0.0), (factor - 0.33) / 0.33);
        } else {
            finalColour = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), (factor - 0.66) / 0.34);
        }
    } 
    else if (u_colorScheme == 1) {
        // Synthwave: Neon Purple -> Pink -> Orange -> Yellow
        if (factor < 0.33) {
            finalColour = mix(vec3(0.2, 0.0, 0.4), vec3(0.9, 0.1, 0.5), factor * 3.03);
        } else if (factor < 0.66) {
            finalColour = mix(vec3(0.9, 0.1, 0.5), vec3(1.0, 0.5, 0.0), (factor - 0.33) * 3.03);
        } else {
            finalColour = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.9, 0.2), (factor - 0.66) * 2.94);
        }
    }
    else if (u_colorScheme == 2) {
        // Glacier: Deep Blue -> Electric Cyan -> White
        if (factor < 0.5) {
            finalColour = mix(vec3(0.0, 0.1, 0.4), vec3(0.0, 0.8, 0.9), factor * 2.0);
        } else {
            finalColour = mix(vec3(0.0, 0.8, 0.9), vec3(1.0, 1.0, 1.0), (factor - 0.5) * 2.0);
        }
    }
    else if (u_colorScheme == 3) {
        // Magma: Dark Red -> Fiery Orange -> Bright Yellow
        if (factor < 0.5) {
            finalColour = mix(vec3(0.3, 0.0, 0.0), vec3(0.9, 0.3, 0.0), factor * 2.0);
        } else {
            finalColour = mix(vec3(0.9, 0.3, 0.0), vec3(1.0, 0.9, 0.1), (factor - 0.5) * 2.0);
        }
    }
    else if (u_colorScheme == 4) {
        // Cyberpunk: Neon Teal -> Acid Magenta
        finalColour = mix(vec3(0.0, 0.9, 0.8), vec3(0.9, 0.0, 0.5), factor);
    }

    gl_FragColor = vec4(finalColour, 1.0);
  }
`;

export const wireFragmentShader = `
  uniform float u_opacity;

  void main() { 
      gl_FragColor = vec4(0.0, 0.0, 0.0, u_opacity); 
  }
`;
