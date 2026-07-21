export const vertexShader = `
  uniform sampler2D u_audioTexture;
  varying vec2 vUv;

  void main() {
    vUv = uv;

    // Sample the texture directly using UV coordinates
    vec4 audioSample = texture2D(u_audioTexture, uv);

    vec3 pos = position;
    // Scale vertex height directly based on red channel height
    pos.y = (audioSample.r) * 25.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
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
    gl_FragColor = vec4(0.05, 0.05, 0.05, u_opacity);
  }
`;