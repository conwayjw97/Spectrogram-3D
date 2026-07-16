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
const timeSamples = 128;
const freqSamples = 128;
const width = 100;
const depth = 100;

// Delta Time Capture Tracking Parameters
let lastTime = performance.now();
let timeAccumulator = 0;

// 3. Setup Audio Texture Map Allocation
const size = timeSamples * freqSamples;
const audioData = new Uint8Array(4 * size);
const dataTexture = new THREE.DataTexture(audioData, freqSamples, timeSamples, THREE.RGBAFormat);
dataTexture.needsUpdate = true;

// 4. Assemble Main Dual Mesh Terrain Layouts
const geometry = new THREE.PlaneGeometry(width, depth, freqSamples - 1, timeSamples - 1);
geometry.rotateX(-Math.PI / 2);

const solidMesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
  uniforms: { u_audioTexture: { value: dataTexture } },
  vertexShader, 
  fragmentShader: solidFragmentShader,
  side: THREE.DoubleSide,
  polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
}));
scene.add(solidMesh);

const wireframeMesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
  uniforms: { u_audioTexture: { value: dataTexture } },
  vertexShader, 
  fragmentShader: wireFragmentShader,
  wireframe: true, side: THREE.DoubleSide, transparent: true
}));
scene.add(wireframeMesh);

// 5. Construct Live Monitoring Edge Lines
const frontLineGeometry = new THREE.BufferGeometry();
const frontLinePositions = new Float32Array(freqSamples * 3);
for (let i = 0; i < freqSamples; i++) {
  frontLinePositions[i * 3] = -width / 2 + (i / (freqSamples - 1)) * width;
  frontLinePositions[i * 3 + 1] = 0;
  frontLinePositions[i * 3 + 2] = depth / 2 + 0.1;
}
frontLineGeometry.setAttribute('position', new THREE.BufferAttribute(frontLinePositions, 3));
const frontLine = new THREE.Line(frontLineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 10 }));
scene.add(frontLine);

// Left Side Line: Max Amplitude Tracking
const sideLineGeometry = new THREE.BufferGeometry();
const sideLinePositions = new Float32Array(timeSamples * 3);
const historyAmplitudes = new Float32Array(timeSamples);
for (let i = 0; i < timeSamples; i++) {
  sideLinePositions[i * 3] = -width / 2 - 0.2;
  sideLinePositions[i * 3 + 1] = 0;
  sideLinePositions[i * 3 + 2] = depth / 2 - (i / (timeSamples - 1)) * depth;
}
sideLineGeometry.setAttribute('position', new THREE.BufferAttribute(sideLinePositions, 3));
const sideLine = new THREE.Line(sideLineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 10 }));
scene.add(sideLine);

// Right Side Line: Average Amplitude Tracking
const avgSideLineGeometry = new THREE.BufferGeometry();
const avgSideLinePositions = new Float32Array(timeSamples * 3);
const historyAvgAmplitudes = new Float32Array(timeSamples);
for (let i = 0; i < timeSamples; i++) {
  avgSideLinePositions[i * 3] = width / 2 + 0.2;
  avgSideLinePositions[i * 3 + 1] = 0;
  avgSideLinePositions[i * 3 + 2] = depth / 2 - (i / (timeSamples - 1)) * depth;
}
avgSideLineGeometry.setAttribute('position', new THREE.BufferAttribute(avgSideLinePositions, 3));
const avgSideLine = new THREE.Line(avgSideLineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 10 }));
scene.add(avgSideLine);

// Back Line: Max Spectrogram (Peak Hold) Tracking
const backLineGeometry = new THREE.BufferGeometry();
const backLinePositions = new Float32Array(freqSamples * 3);
const peakSpectrum = new Float32Array(freqSamples);
for (let i = 0; i < freqSamples; i++) {
  backLinePositions[i * 3] = -width / 2 + (i / (freqSamples - 1)) * width;
  backLinePositions[i * 3 + 1] = 0;
  backLinePositions[i * 3 + 2] = -depth / 2 - 0.2; // Placed at the very back edge
}
backLineGeometry.setAttribute('position', new THREE.BufferAttribute(backLinePositions, 3));
const backLine = new THREE.Line(backLineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 10 }));
scene.add(backLine);

// 6. Draw Fixed Blueprint Structural Guides
function createAxisLine(start, end) {
  const lineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...start), new THREE.Vector3(...end)]);
  scene.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xffffff })));
}
createAxisLine([-width / 2, 0.1, depth / 2], [width / 2, 0.1, depth / 2]);
createAxisLine([-width / 2, 0, depth / 2], [-width / 2, 25, depth / 2]);
createAxisLine([-width / 2, 0.1, depth / 2], [-width / 2, 0.1, -depth / 2]);

// 7. Initialise User Controls
initUI(scene, { width, depth, freqSamples, timeSamples });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 8. Dynamic Frame Render Engine Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  if (audioState.isRecording && audioState.analyser) {
    audioState.analyser.getByteFrequencyData(audioState.dataArray);

    // Calculate lower and upper index range based on custom slider values
    const minIndex = Math.floor((audioState.minFrequency / audioState.context.sampleRate) * audioState.analyser.fftSize);
    const maxIndex = Math.floor((audioState.targetFrequency / audioState.context.sampleRate) * audioState.analyser.fftSize);
    const indexRange = Math.max(1, maxIndex - minIndex);

    let currentFramePeak = 0;
    let currentFrameSum = 0;
    const linePositions = frontLineGeometry.attributes.position.array;

    // Phase A: Update the front line immediately every frame for maximum responsiveness
    for (let i = 0; i < freqSamples; i++) {
      const mappedIndex = Math.min(
        minIndex + Math.floor((i / (freqSamples - 1)) * indexRange), 
        audioState.dataArray.length - 1
      );
      const val = audioState.dataArray[mappedIndex];
      if (val > currentFramePeak) currentFramePeak = val;
      currentFrameSum += val;
      
      linePositions[i * 3 + 1] = (val / 255.0) * 25.0;
    }
    const currentFrameAvg = currentFrameSum / freqSamples;
    frontLineGeometry.attributes.position.needsUpdate = true;

    // Phase B: Throttled historical buffer shifts
    const now = performance.now();
    const delta = now - lastTime;
    lastTime = now;
    timeAccumulator += delta;

    const targetInterval = (audioState.timeWindow * 1000) / timeSamples;

    if (timeAccumulator >= targetInterval) {
      timeAccumulator = timeAccumulator % targetInterval;

      // Roll structural texture coordinates back one step in time
      for (let i = timeSamples - 1; i > 0; i--) {
        const rowOffset = i * freqSamples * 4;
        const prevRowOffset = (i - 1) * freqSamples * 4;
        for (let j = 0; j < freqSamples * 4; j++) {
          audioData[rowOffset + j] = audioData[prevRowOffset + j];
        }
      }

      // Roll the left and right side-line amplitude trace array values backward
      for (let i = timeSamples - 1; i > 0; i--) {
        historyAmplitudes[i] = historyAmplitudes[i - 1];
        historyAvgAmplitudes[i] = historyAvgAmplitudes[i - 1];
      }

      // Commit the current resampled snapshot arrays into row index 0
      for (let i = 0; i < freqSamples; i++) {
        const mappedIndex = Math.min(
          minIndex + Math.floor((i / (freqSamples - 1)) * indexRange), 
          audioState.dataArray.length - 1
        );
        const val = audioState.dataArray[mappedIndex];
        const index = i * 4;
        audioData[index] = val;
        audioData[index + 1] = val;
        audioData[index + 2] = val;
        audioData[index + 3] = 255;
      }

      historyAmplitudes[0] = (currentFramePeak / 255.0) * 25.0;
      historyAvgAmplitudes[0] = (currentFrameAvg / 255.0) * 25.0;

      // Calculate Peak Hold (Max Spectrogram) across all active historical slices
      for (let j = 0; j < freqSamples; j++) {
        let maxBinVal = 0;
        for (let i = 0; i < timeSamples; i++) {
          const rowOffset = i * freqSamples * 4;
          const val = audioData[rowOffset + j * 4];
          if (val > maxBinVal) maxBinVal = val;
        }
        peakSpectrum[j] = (maxBinVal / 255.0) * 25.0;
      }

      dataTexture.needsUpdate = true;
    }

    // Phase C: Redraw side-line profiles and back peak-hold spectrum
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