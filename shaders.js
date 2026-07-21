export const vertexShader = `
  uniform sampler2D u_audioTexture;
  uniform float u_writeIndex;
  uniform float u_timeSamples;
  
  varying float v_amplitude;
  
  void main() {
    vec2 uv = uv;
    uv.y = fract(uv.y + u_writeIndex);
    
    vec4 audioData = texture2D(u_audioTexture, uv);
    float height = audioData.r;
    v_amplitude = height;
    
    vec3 newPosition = position;
    newPosition.y = height * 25.0;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

export const solidFragmentShader = `
  uniform vec3 u_colorBase;
  uniform vec3 u_colorLow;
  uniform vec3 u_colorMid;
  uniform vec3 u_colorHigh;

  varying float v_amplitude;

  void main() {
    float h = clamp(v_amplitude, 0.0, 1.0);
    vec3 col;

    if (h < 0.3333) {
      col = mix(u_colorBase, u_colorLow, h * 3.0);
    } else if (h < 0.6666) {
      col = mix(u_colorLow, u_colorMid, (h - 0.3333) * 3.0);
    } else {
      col = mix(u_colorMid, u_colorHigh, (h - 0.6666) * 3.0);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const wireFragmentShader = `
  uniform float u_opacity;
  
  void main() {
    gl_FragColor = vec4(1.0, 1.0, 1.0, u_opacity);
  }
`;