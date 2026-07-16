export const vertexShader = `
  uniform sampler2D u_audioTexture;
  varying float vElevation;

  void main() {
    vec4 texData = texture2D(u_audioTexture, uv);
    float elevation = texData.r * 25.0; 
    vElevation = elevation;

    vec3 newPosition = position;
    newPosition.y += elevation;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
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
    void main() { 
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.6); 
    }
`;