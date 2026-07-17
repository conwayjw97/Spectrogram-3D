import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { vertexShader, solidFragmentShader, wireFragmentShader } from './shaders.js';
import { audioState } from './audio.js';
import { initUI } from './ui.js';

// 1. Initialise Scene and Viewport Engine
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
camera.position.set(45, 55, 95);
camera.lookAt(0, 0, 0);

// 2. Spectrogram Fixed Boundary Settings
let timeSamples = 128;
let freqSamples = 128;
const width = 100;
const depth = 100;

// Delta Time Capture Tracking Parameters
let lastTime = performance.now();
let timeAccumulator = 0;

// Circular Buffer Tracking Pointer
let writeIndex = 0;

// Global Allocations for Visual Elements
let audioData, dataTexture, geometry, solidMesh, wireframeMesh;
let frontLine, frontLineGeometry;
let sideLine, sideLineGeometry, historyAmplitudes;
let avgSideLine, avgSideLineGeometry, historyAvgAmplitudes;
let backLine, backLineGeometry, peakSpectrum;

// Persistent cache to smoothly blend historical frames over the time axis
let previousFrameData = null;

// 3. Reusable Visualiser Element Lifecycle Setup
function setupVisualiserElements() {
  // Clear existing items from the scene if they exist
  if (solidMesh) scene.remove(solidMesh);
  if (wireframeMesh) scene.remove(wireframeMesh);
  if (frontLine) scene.remove(frontLine);
  if (sideLine) scene.remove(sideLine);
  if (avgSideLine) scene.remove(avgSideLine);
  if (backLine) scene.remove(backLine);

  // Explicitly dispose geometries and textures to avoid GPU memory leaks
  if (geometry) geometry.dispose();
  if (dataTexture) dataTexture.dispose();
  if (frontLineGeometry) frontLineGeometry.dispose();
  if (sideLineGeometry) sideLineGeometry.dispose();
  if (avgSideLineGeometry) avgSideLineGeometry.dispose();
  if (backLineGeometry) backLineGeometry.dispose();

  // Reset circular pointer and frame history caches on reallocation
  writeIndex = 0;
  previousFrameData = new Float32Array(freqSamples);

  // Re-allocate Audio Texture Map Configuration
  const size = timeSamples * freqSamples;
  audioData = new Uint8Array(4 * size);
  
  dataTexture = new THREE.DataTexture(audioData, freqSamples, timeSamples, THREE.RGBAFormat);
  // Enable bilinear filtering to smooth out samples between texture pixels
  dataTexture.minFilter = THREE.LinearFilter;
  dataTexture.magFilter = THREE.LinearFilter;
  dataTexture.needsUpdate = true;

  // Re-assemble Main Dual Mesh Terrain Layouts with dynamic uniforms
  geometry = new THREE.PlaneGeometry(width, depth, freqSamples - 1, timeSamples - 1);
  geometry.rotateX(-Math.PI / 2);

  const shaderUniforms = {
    u_audioTexture: { value: dataTexture },
    u_writeIndex: { value: 0.0 },
    u_timeSamples: { value: timeSamples }
  };

  solidMesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(shaderUniforms),
    vertexShader, 
    fragmentShader: solidFragmentShader,
    side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
  }));
  solidMesh.material.uniforms.u_audioTexture.value = dataTexture;
  scene.add(solidMesh);

  // Re-construct Live Monitoring Front Line
  frontLineGeometry = new THREE.BufferGeometry();
  const frontLinePositions = new Float32Array(freqSamples * 3);
  for (let i = 0; i < freqSamples; i++) {
    frontLinePositions[i * 3] = -width / 2 + (i / (freqSamples - 1)) * width;
    frontLinePositions[i * 3 + 1] = 0;
    frontLinePositions[i * 3 + 2] = depth / 2 + 0.1;
  }
  frontLineGeometry.setAttribute('position', new THREE.BufferAttribute(frontLinePositions, 3));
  frontLine = new THREE.Line(frontLineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 10 }));
  scene.add(frontLine);

  // Re-construct Left Side Line (Max Amplitude)
  sideLineGeometry = new THREE.BufferGeometry();
  const sideLinePositions = new Float32Array(timeSamples * 3);
  historyAmplitudes = new Float32Array(timeSamples);
  for (let i = 0; i < timeSamples; i++) {
    sideLinePositions[i * 3] = -width / 2 - 0.2;
    sideLinePositions[i * 3 + 1] = 0;
    sideLinePositions[i * 3 + 2] = depth / 2 - (i / (timeSamples - 1)) * depth;
  }
  sideLineGeometry.setAttribute('position', new THREE.BufferAttribute(sideLinePositions, 3));
  sideLine = new THREE.Line(sideLineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 10 }));
  scene.add(sideLine);

  // Re-construct Right Side Line (Average Amplitude)
  avgSideLineGeometry = new THREE.BufferGeometry();
  const avgSideLinePositions = new Float32Array(timeSamples * 3);
  historyAvgAmplitudes = new Float32Array(timeSamples);
  for (let i = 0; i < timeSamples; i++) {
    avgSideLinePositions[i * 3] = width / 2 + 0.2;
    avgSideLinePositions[i * 3 + 1] = 0;
    avgSideLinePositions[i * 3 + 2] = depth / 2 - (i / (timeSamples - 1)) * depth;
  }
  avgSideLineGeometry.setAttribute('position', new THREE.BufferAttribute(avgSideLinePositions, 3));
  avgSideLine = new THREE.Line(avgSideLineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 10 }));
  scene.add(avgSideLine);

  // Re-construct Back Line (Max Spectrogram Peak Hold)
  backLineGeometry = new THREE.BufferGeometry();
  const backLinePositions = new Float32Array(freqSamples * 3);
  peakSpectrum = new Float32Array(freqSamples);
  for (let i = 0; i < freqSamples; i++) {
    backLinePositions[i * 3] = -width / 2 + (i / (freqSamples - 1)) * width;
    backLinePositions[i * 3 + 1] = 0;
    backLinePositions[i * 3 + 2] = -depth / 2 - 0.2;
  }
  backLineGeometry.setAttribute('position', new THREE.BufferAttribute(backLinePositions, 3));
  backLine = new THREE.Line(backLineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 10 }));
  scene.add(backLine);

  const wireOpacity = Math.max(0.03, 0.6 * (128 / freqSamples));

  const wireUniforms = {
    u_audioTexture: { value: dataTexture },
    u_writeIndex: { value: 0.0 },
    u_opacity: { value: wireOpacity },
    u_timeSamples: { value: timeSamples }
  };

  wireframeMesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: wireUniforms,
    vertexShader, 
    fragmentShader: wireFragmentShader,
    wireframe: true, side: THREE.DoubleSide, transparent: true
  }));
  wireframeMesh.material.uniforms.u_audioTexture.value = dataTexture;

  wireframeMesh.visible = audioState.showWireframe;
  scene.add(wireframeMesh);
}

// Initial Generation Call
setupVisualiserElements();

// 4. Draw Fixed Blueprint Structural Guides
function createAxisLine(start, end) {
  const lineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...start), new THREE.Vector3(...end)]);
  scene.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xffffff })));
}
createAxisLine([-width / 2, 0.1, depth / 2], [width / 2, 0.1, depth / 2]);
createAxisLine([-width / 2, 0, depth / 2], [-width / 2, 25, depth / 2]);
createAxisLine([-width / 2, 0.1, depth / 2], [-width / 2, 0.1, -depth / 2]);

// 5. Initialise User Controls & Precision Listener
initUI(scene, { width, depth, freqSamples, timeSamples });

const precisionSlider = document.getElementById('precisionSlider');
const precisionLabel = document.getElementById('precisionLabel');

precisionSlider.addEventListener('input', (e) => {
  const val = e.target.value;
  precisionLabel.textContent = `Mesh Precision: ${val}x${val}`;
});

precisionSlider.addEventListener('change', (e) => {
  const val = parseInt(e.target.value);
  timeSamples = val;
  freqSamples = val;
  setupVisualiserElements();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 6. Dynamic Frame Render Engine Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  if (wireframeMesh) {
    wireframeMesh.visible = audioState.showWireframe;
  }

  if (audioState.isRecording && audioState.analyser) {
    audioState.analyser.getByteFrequencyData(audioState.dataArray);

    const minIndex = Math.floor((audioState.minFrequency / audioState.context.sampleRate) * audioState.analyser.fftSize);
    const maxIndex = Math.floor((audioState.targetFrequency / audioState.context.sampleRate) * audioState.analyser.fftSize);
    const indexRange = Math.max(1, maxIndex - minIndex);

    // Generate a smoothly interpolated snapshot of the current frame's frequency data
    const currentFrameData = new Float32Array(freqSamples);
    let currentFramePeak = 0;
    let currentFrameSum = 0;
    const linePositions = frontLineGeometry.attributes.position.array;

    for (let i = 0; i < freqSamples; i++) {
      const continuousIndex = minIndex + (i / (freqSamples - 1)) * indexRange;
      const indexLow = Math.floor(continuousIndex);
      const indexHigh = Math.min(indexLow + 1, audioState.dataArray.length - 1);
      const weight = continuousIndex - indexLow;
      
      // Perform Linear Interpolation (lerp) across the frequency arrays
      const val = audioState.dataArray[indexLow] * (1.0 - weight) + audioState.dataArray[indexHigh] * weight;
      
      currentFrameData[i] = val;
      if (val > currentFramePeak) currentFramePeak = val;
      currentFrameSum += val;
      
      linePositions[i * 3 + 1] = (val / 255.0) * 25.0;
    }
    const currentFrameAvg = currentFrameSum / freqSamples;
    frontLineGeometry.attributes.position.needsUpdate = true;

    const now = performance.now();
    const delta = now - lastTime;
    lastTime = now;
    timeAccumulator += delta;

    const targetInterval = (audioState.timeWindow * 1000) / timeSamples;
    let updatedThisFrame = false;

    // Calculate total upcoming intervals matching this frame step for time interpolation
    const stepsToTake = Math.floor(timeAccumulator / targetInterval);
    let stepCount = 0;

    // Process all units of elapsed time that built up during this frame step
    while (timeAccumulator >= targetInterval) {
      timeAccumulator -= targetInterval;
      updatedThisFrame = true;
      stepCount++;

      // Advance circular ring buffer row pointer
      writeIndex = (writeIndex + 1) % timeSamples;
      const rowOffset = writeIndex * freqSamples * 4;

      // Roll the 1D side-line array values backward
      for (let i = timeSamples - 1; i > 0; i--) {
        historyAmplitudes[i] = historyAmplitudes[i - 1];
        historyAvgAmplitudes[i] = historyAvgAmplitudes[i - 1];
      }

      // Linear blend factor handling historical rows matching fractional elapsed frame rendering times
      const t = stepsToTake > 0 ? stepCount / stepsToTake : 1.0;

      // Commit the blended, smooth snapshot into the designated circular row index
      for (let i = 0; i < freqSamples; i++) {
        const val = previousFrameData[i] * (1.0 - t) + currentFrameData[i] * t;
        const index = rowOffset + (i * 4);
        audioData[index] = val;
        audioData[index + 1] = val;
        audioData[index + 2] = val;
        audioData[index + 3] = 255;
      }

      historyAmplitudes[0] = (currentFramePeak / 255.0) * 25.0;
      historyAvgAmplitudes[0] = (currentFrameAvg / 255.0) * 25.0;
    }

    // Preserve current processed state data across animation boundaries
    previousFrameData.set(currentFrameData);

    if (updatedThisFrame) {
      // Calculate Peak Hold across the circular grid
      for (let j = 0; j < freqSamples; j++) {
        let maxBinVal = 0;
        for (let i = 0; i < timeSamples; i++) {
          const checkOffset = i * freqSamples * 4;
          const val = audioData[checkOffset + j * 4];
          if (val > maxBinVal) maxBinVal = val;
        }
        peakSpectrum[j] = (maxBinVal / 255.0) * 25.0;
      }

      const normalizedWriteIndex = writeIndex / timeSamples;
      solidMesh.material.uniforms.u_writeIndex.value = normalizedWriteIndex;
      wireframeMesh.material.uniforms.u_writeIndex.value = normalizedWriteIndex;

      dataTexture.needsUpdate = true;
    }

    const sidePositions = sideLineGeometry.attributes.position.array;
    const avgSidePositions = avgSideLineGeometry.attributes.position.array;
    const backPositions = backLineGeometry.attributes.position.array;

    for (let i = 0; i < timeSamples; i++) {
      sidePositions[i * 3 + 1] = historyAmplitudes[i];
      avgSidePositions[i * 3 + 1] = historyAvgAmplitudes[i];
    }
    for (let i = 0; i < freqSamples; i++) {
      backPositions[i * 3 + 1] = peakSpectrum[i];
    }

    sideLineGeometry.attributes.position.needsUpdate = true;
    avgSideLineGeometry.attributes.position.needsUpdate = true;
    backLineGeometry.attributes.position.needsUpdate = true;
  }

  renderer.render(scene, camera);
}

animate();