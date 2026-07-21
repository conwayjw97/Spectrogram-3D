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

// Hover Visualisation Raycasting Engine variables
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById('spectrogramTooltip');

// Tracks normalised coordinates inside the viewport
window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Move the HTML overlay box relative to the cursor position
  if (tooltip) {
    tooltip.style.left = (event.clientX + 16) + 'px';
    tooltip.style.top = (event.clientY + 16) + 'px';
  }

  updateTooltip();
});

// Update the tooltip mapping if the camera moves while the graph is paused
controls.addEventListener('change', () => {
  updateTooltip();
});

// 2. Spectrogram Fixed Boundary Settings
let timeSamples = 128;
let freqSamples = 128;
const width = 100;
const depth = 100;

let lastTime = performance.now();
let timeAccumulator = 0;
let writeIndex = 0;

let audioData, dataTexture, geometry, solidMesh, wireframeMesh;
let frontLine, frontLineGeometry;
let maxSideLine, maxSideLineGeometry, historyAmplitudes;
let avgSideLine, avgSideLineGeometry, historyAvgAmplitudes;
let backLine, backLineGeometry, peakSpectrum;
let previousFrameData = null;

// Grab DOM reference early to avoid configuration sequence errors
const perimeterToggle = document.getElementById('perimeterToggle');

function updatePerimeterVisibility() {
  if (!perimeterToggle) return;
  const showLines = perimeterToggle.checked;

  if (frontLine) frontLine.visible = showLines;
  if (maxSideLine) maxSideLine.visible = showLines;
  if (avgSideLine) avgSideLine.visible = showLines;
  if (backLine) backLine.visible = showLines;
}

// 3. Reusable Visualiser Element Lifecycle Setup
function setupVisualiserElements() {
  if (solidMesh) scene.remove(solidMesh);
  if (wireframeMesh) scene.remove(wireframeMesh);
  if (frontLine) scene.remove(frontLine);
  if (maxSideLine) scene.remove(maxSideLine);
  if (avgSideLine) scene.remove(avgSideLine);
  if (backLine) scene.remove(backLine);

  if (geometry) geometry.dispose();
  if (dataTexture) dataTexture.dispose();
  if (frontLineGeometry) frontLineGeometry.dispose();
  if (maxSideLineGeometry) maxSideLineGeometry.dispose();
  if (avgSideLineGeometry) avgSideLineGeometry.dispose();
  if (backLineGeometry) backLineGeometry.dispose();

  writeIndex = 0;
  previousFrameData = new Float32Array(freqSamples);

  const size = timeSamples * freqSamples;
  audioData = new Uint8Array(4 * size);
  
  dataTexture = new THREE.DataTexture(audioData, freqSamples, timeSamples, THREE.RGBAFormat);
  dataTexture.minFilter = THREE.LinearFilter;
  dataTexture.magFilter = THREE.LinearFilter;
  dataTexture.wrapS = THREE.ClampToEdgeWrapping;
  dataTexture.wrapT = THREE.ClampToEdgeWrapping;
  dataTexture.needsUpdate = true;

  geometry = new THREE.PlaneGeometry(width, depth, freqSamples - 1, timeSamples - 1);
  geometry.rotateX(-Math.PI / 2);

  const shaderUniforms = {
    u_audioTexture: { value: dataTexture },
    u_writeIndex: { value: 0.0 },
    u_timeSamples: { value: timeSamples },
    u_colorScheme: { value: audioState.colorScheme } 
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

  maxSideLineGeometry = new THREE.BufferGeometry();
  const maxSideLinePositions = new Float32Array(timeSamples * 3);
  historyAmplitudes = new Float32Array(timeSamples);
  for (let i = 0; i < timeSamples; i++) {
    maxSideLinePositions[i * 3] = -width / 2 - 0.2;
    maxSideLinePositions[i * 3 + 1] = 0;
    maxSideLinePositions[i * 3 + 2] = depth / 2 - (i / (timeSamples - 1)) * depth;
  }
  maxSideLineGeometry.setAttribute('position', new THREE.BufferAttribute(maxSideLinePositions, 3));
  maxSideLine = new THREE.Line(maxSideLineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 10 }));
  scene.add(maxSideLine);

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

  updatePerimeterVisibility();
}

setupVisualiserElements();

// 4. Draw Fixed Blueprint Structural Guides
const axisLinesGroup = new THREE.Group();
const boxLinesGroup = new THREE.Group();
const topLinesGroup = new THREE.Group();
scene.add(axisLinesGroup);
scene.add(boxLinesGroup);
scene.add(topLinesGroup);

function createAxisLine(start, end, targetGroup) {
  const lineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...start), new THREE.Vector3(...end)]);
  const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 }));
  targetGroup.add(line);
}

// Minimal Primary Structural Axes
createAxisLine([-width / 2, 0,  depth / 2], [ width / 2, 0,  depth / 2], axisLinesGroup); // X Axis
createAxisLine([-width / 2, 0,  depth / 2], [-width / 2, 25,  depth / 2], axisLinesGroup); // Y Axis
createAxisLine([-width / 2, 0, -depth / 2], [-width / 2, 0,  depth / 2], axisLinesGroup); // Z Axis

// Outer Blueprint Framing Extensions
createAxisLine([ width / 2, 0,  depth / 2], [ width / 2, 0, -depth / 2], boxLinesGroup);    // Right floor boundary
createAxisLine([ width / 2, 0, -depth / 2], [-width / 2, 0, -depth / 2], boxLinesGroup);    // Back floor boundary
createAxisLine([-width / 2, 0, -depth / 2], [-width / 2, 25, -depth / 2], boxLinesGroup);   // Back-Left pillar
createAxisLine([ width / 2, 0, -depth / 2], [ width / 2, 25, -depth / 2], boxLinesGroup);   // Back-Right pillar
createAxisLine([ width / 2, 0,  depth / 2], [ width / 2, 25,  depth / 2], boxLinesGroup);   // Front-Right pillar

// Upper Structural Bounds (y = 25 Ceiling Perimeter)
createAxisLine([-width / 2, 25,  depth / 2], [ width / 2, 25,  depth / 2], topLinesGroup);   // Front top
createAxisLine([ width / 2, 25,  depth / 2], [ width / 2, 25, -depth / 2], topLinesGroup);   // Right top
createAxisLine([ width / 2, 25, -depth / 2], [-width / 2, 25, -depth / 2], topLinesGroup);   // Back top
createAxisLine([-width / 2, 25, -depth / 2], [-width / 2, 25,  depth / 2], topLinesGroup);   // Left top

// 5. Initialise User Controls & Precision Listener
initUI(scene, { width, depth, freqSamples, timeSamples }, { axisLinesGroup, boxLinesGroup, topLinesGroup });

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

if (perimeterToggle) {
  perimeterToggle.addEventListener('change', updatePerimeterVisibility);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Dedicated Raycasting Calculation Engine
function updateTooltip() {
  if (!tooltip) return;

  if (solidMesh && solidMesh.visible) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(solidMesh);
  
    if (intersects.length > 0) {
      const point = intersects[0].point;
  
      // 1. Map X-Axis position (-50 to 50) directly to Frequency limits
      const pctX = (point.x + (width / 2)) / width;
      const clampedPctX = Math.max(0, Math.min(1, pctX));
      const minF = audioState.minFrequency || 0;
      const maxF = audioState.targetFrequency || 10000;
      const frequencyHz = minF + clampedPctX * (maxF - minF);
  
      // 2. Map Z-Axis position (50 is Now, -50 is past) to Time Windows
      const pctZ = ((depth / 2) - point.z) / depth;
      const clampedPctZ = Math.max(0, Math.min(1, pctZ));
      const timeOffsetSec = clampedPctZ * audioState.timeWindow;
  
      // 3. Locate array layout indices matching coordinates
      const freqIndex = Math.floor(clampedPctX * (freqSamples - 1));
      const timeIndex = Math.floor(clampedPctZ * (timeSamples - 1));
  
      // Synchronise extraction sequence against your rolling ring buffer
      const targetRow = (writeIndex - timeIndex + timeSamples) % timeSamples;
      const dataIndex = (targetRow * freqSamples + freqIndex) * 4;
  
      // Extract raw byte volume density parameter safely
      const byteValue = audioData ? audioData[dataIndex] : 0;
  
      // Translate byte factor back into decibels using active analyser boundaries or safe defaults
      const dbMin = audioState.analyser ? audioState.analyser.minDecibels : -100;
      const dbMax = audioState.analyser ? audioState.analyser.maxDecibels : -30;
      const currentDb = dbMin + (byteValue / 255.0) * (dbMax - dbMin);
  
      // Normalise output text formatting
      const freqText = frequencyHz < 1000 ? `${Math.round(frequencyHz)} Hz` : `${(frequencyHz / 1000).toFixed(2)} kHz`;
      const timeText = timeIndex === 0 ? "Now" : `-${timeOffsetSec.toFixed(2)}s`;
      const dbText = `${Math.round(currentDb)} dB`;
  
      // Render out content to window component overlay
      tooltip.style.display = 'block';
      tooltip.innerHTML = `
        <strong>Freq:</strong> ${freqText}<br/>
        <strong>Time:</strong> ${timeText}<br/>
        <strong>Volume:</strong> ${dbText}
      `;
    } else {
      tooltip.style.display = 'none';
    }
  } else {
    tooltip.style.display = 'none';
  }
}

// 6. Dynamic Frame Render Engine Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  if (wireframeMesh) {
    wireframeMesh.visible = audioState.showWireframe;
  }

  if (solidMesh && solidMesh.material.uniforms.u_colorScheme) {
    solidMesh.material.uniforms.u_colorScheme.value = audioState.colorScheme;
  }
  if (wireframeMesh && wireframeMesh.material.uniforms.u_colorScheme) {
    wireframeMesh.material.uniforms.u_colorScheme.value = audioState.colorScheme;
  }

  if (audioState.isRecording && audioState.analyser) {
    audioState.analyser.getByteFrequencyData(audioState.dataArray);

    const minIndex = Math.floor((audioState.minFrequency / audioState.context.sampleRate) * audioState.analyser.fftSize);
    const maxIndex = Math.floor((audioState.targetFrequency / audioState.context.sampleRate) * audioState.analyser.fftSize);
    const indexRange = Math.max(1, maxIndex - minIndex);

    const currentFrameData = new Float32Array(freqSamples);
    let currentFramePeak = 0;
    let currentFrameSum = 0;
    const linePositions = frontLineGeometry.attributes.position.array;

    for (let i = 0; i < freqSamples; i++) {
      const continuousIndex = minIndex + (i / (freqSamples - 1)) * indexRange;
      const indexLow = Math.floor(continuousIndex);
      const indexHigh = Math.min(indexLow + 1, audioState.dataArray.length - 1);
      const weight = continuousIndex - indexLow;
      
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

    const stepsToTake = Math.floor(timeAccumulator / targetInterval);
    let stepCount = 0;

    while (timeAccumulator >= targetInterval) {
      timeAccumulator -= targetInterval;
      updatedThisFrame = true;
      stepCount++;

      // 1. Shift all texture rows down by one row space to clear room at the top
      const rowSize = freqSamples * 4;
      audioData.copyWithin(rowSize, 0, audioData.length - rowSize);

      // 2. Shift the perimeter history arrays down
      for (let i = timeSamples - 1; i > 0; i--) {
        historyAmplitudes[i] = historyAmplitudes[i - 1];
        historyAvgAmplitudes[i] = historyAvgAmplitudes[i - 1];
      }

      const t = stepsToTake > 0 ? stepCount / stepsToTake : 1.0;

      // 3. Inject the new frame data directly at the beginning of the texture (Row 0)
      for (let i = 0; i < freqSamples; i++) {
        const val = previousFrameData[i] * (1.0 - t) + currentFrameData[i] * t;
        const index = i * 4; // Row 0 offset
        audioData[index] = val;
        audioData[index + 1] = val;
        audioData[index + 2] = val;
        audioData[index + 3] = 255;
      }

      historyAmplitudes[0] = (currentFramePeak / 255.0) * 25.0;
      historyAvgAmplitudes[0] = (currentFrameAvg / 255.0) * 25.0;
    }

    previousFrameData.set(currentFrameData);

    // Inside the updatedThisFrame block in animate()
    if (updatedThisFrame) {
      for (let j = 0; j < freqSamples; j++) {
        let maxBinVal = 0;
        for (let i = 0; i < timeSamples; i++) {
          const checkOffset = i * freqSamples * 4;
          const val = audioData[checkOffset + j * 4];
          if (val > maxBinVal) maxBinVal = val;
        }
        peakSpectrum[j] = (maxBinVal / 255.0) * 25.0;
      }

      // Lock the offset uniform to 0.0 since the data layout is no longer rolling
      solidMesh.material.uniforms.u_writeIndex.value = 0.0;
      wireframeMesh.material.uniforms.u_writeIndex.value = 0.0;

      dataTexture.needsUpdate = true;
    }

    const maxSidePositions = maxSideLineGeometry.attributes.position.array;
    const avgSidePositions = avgSideLineGeometry.attributes.position.array;
    const backPositions = backLineGeometry.attributes.position.array;

    for (let i = 0; i < timeSamples; i++) {
      maxSidePositions[i * 3 + 1] = historyAmplitudes[i];
      avgSidePositions[i * 3 + 1] = historyAvgAmplitudes[i];
    }
    for (let i = 0; i < freqSamples; i++) {
      backPositions[i * 3 + 1] = peakSpectrum[i];
    }

    maxSideLineGeometry.attributes.position.needsUpdate = true;
    avgSideLineGeometry.attributes.position.needsUpdate = true;
    backLineGeometry.attributes.position.needsUpdate = true;
  }

  updateTooltip();
  renderer.render(scene, camera);
}

animate();
