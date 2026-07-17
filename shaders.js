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
  varying float vElevation;

  void main() {
    float intensity = clamp(vElevation / 25.0, 0.0, 1.0);
    
    vec3 colorDarkGreen = vec3(0.0, 0.25, 0.0);  
    vec3 colorNeonGreen = vec3(0.0, 1.0, 0.0);  
    vec3 colorYellow    = vec3(1.0, 1.0, 0.0);  
    vec3 colorRed       = vec3(1.0, 0.0, 0.0);  
    
    vec3 colour;
    if (intensity < 0.33) {
      colour = mix(colorDarkGreen, colorNeonGreen, intensity / 0.33);
    } else if (intensity < 0.66) {
      colour = mix(colorNeonGreen, colorYellow, (intensity - 0.33) / 0.33);
    } else {
      colour = mix(colorYellow, colorRed, (intensity - 0.66) / 0.34);
    }
    
    gl_FragColor = vec4(colour, 1.0);
  }
`;

export const wireFragmentShader = `
  uniform float u_opacity;

  void main() { 
      gl_FragColor = vec4(0.0, 0.0, 0.0, u_opacity); 
  }
`;