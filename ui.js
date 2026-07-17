import * as THREE from 'three';
import { audioState, startAudio, stopAudio } from './audio.js';

let labelSprites = [];
let currentScene = null;
let uiConfig = {};

function createLabelSprite(text, x, y, z, customWidth = 128, customHeight = 32) {
  const canvas = document.createElement('canvas');
  canvas.width = customWidth; 
  canvas.height = customHeight;
  const ctx = canvas.getContext('2d');
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'Bold 16px Arial'; 
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center'; 
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  
  sprite.position.set(x, y, z);
  sprite.scale.set(customWidth / 12.8, customHeight / 12.8, 1);
  return sprite;
}

export function generateAllAxisLabels() {
  if (!currentScene || !audioState.analyser) return;

  // Clean up all previously rendered sprites, corner lines, and floor boundaries
  labelSprites.forEach(obj => currentScene.remove(obj));
  labelSprites = [];

  const { width, depth } = uiConfig;

  // 1. Frequency Labels (X-Axis)
  const numXLabels = 10;
  const freqSpan = (audioState.targetFrequency || 10000) - (audioState.minFrequency || 0);
  for (let i = 0; i < numXLabels; i++) {
    const freq = (audioState.minFrequency || 0) + (i / (numXLabels - 1)) * freqSpan;
    const text = freq < 1000 ? `${Math.round(freq)} Hz` : `${(freq / 1000).toFixed(1)} kHz`;
    const x = -width / 2 + (i / (numXLabels - 1)) * width;
    
    // Front edge frequency label
    const spriteFront = createLabelSprite(text, x, 1.5, depth / 2 + 5, 128, 32);
    currentScene.add(spriteFront); 
    labelSprites.push(spriteFront);

    // Back edge (opposite side) frequency label
    const spriteBack = createLabelSprite(text, x, 1.5, -depth / 2 - 5, 128, 32);
    currentScene.add(spriteBack); 
    labelSprites.push(spriteBack);
  }

  // 2. Amplitude Labels (Y-Axis)
  const dbRange = audioState.analyser.maxDecibels - audioState.analyser.minDecibels;
  for (let i = 0; i < 5; i++) {
    const fraction = i / 4;
    const text = `${Math.round(audioState.analyser.minDecibels + fraction * dbRange)} dB`;
    const y = fraction * 25; 
    
    // Left-front amplitude label
    const spriteLeftFront = createLabelSprite(text, -width / 2 - 8, y, depth / 2 + 1, 128, 32);
    currentScene.add(spriteLeftFront); 
    labelSprites.push(spriteLeftFront);

    // Right-back (opposite corner) amplitude label
    const spriteRightBack = createLabelSprite(text, width / 2 + 8, y, -depth / 2 - 1, 128, 32);
    currentScene.add(spriteRightBack); 
    labelSprites.push(spriteRightBack);
  }

  // 3. Timeline Labels (Z-Axis) - Moved closer from -8 to -4
  const totalSeconds = audioState.timeWindow;
  for (let i = 0; i < 5; i++) {
    const fraction = i / 4;
    const text = fraction === 0 ? 'Now' : `-${(fraction * totalSeconds).toFixed(1)}s`;
    const z = depth / 2 - fraction * depth;
    
    // Left side timeline label
    const spriteLeftTimeline = createLabelSprite(text, -width / 2 - 4, 1.5, z, 128, 32);
    currentScene.add(spriteLeftTimeline); 
    labelSprites.push(spriteLeftTimeline);

    // Right side (opposite side) timeline label
    const spriteRightTimeline = createLabelSprite(text, width / 2 + 4, 1.5, z, 128, 32);
    currentScene.add(spriteRightTimeline); 
    labelSprites.push(spriteRightTimeline);
  }

  // 4. Explanatory Labels
  // Front: Current Spectrogram
  const currentSpecLabel = createLabelSprite('Current Spectrogram', 0, 1.5, depth / 2 + 10, 256, 32);
  currentScene.add(currentSpecLabel);
  labelSprites.push(currentSpecLabel);

  // Back: Max Spectrogram (Peak Hold)
  const maxSpecLabel = createLabelSprite('Max Spectrogram (Peak Hold)', 0, 1.5, -depth / 2 - 10, 256, 32);
  currentScene.add(maxSpecLabel);
  labelSprites.push(maxSpecLabel);

  // Left Z-Axis label: Max Amplitude - Moved closer from -24 to -14
  const zSpecLabel = createLabelSprite('Max Amplitude', -width / 2 - 14, 1.5, 0, 256, 32);
  currentScene.add(zSpecLabel);
  labelSprites.push(zSpecLabel);

  // Right Z-Axis label: Average Amplitude - Moved closer from 24 to 14
  const zAverageSpecLabel = createLabelSprite('Average Amplitude', width / 2 + 14, 1.5, 0, 256, 32);
  currentScene.add(zAverageSpecLabel);
  labelSprites.push(zAverageSpecLabel);

  // 5. Vertical Corner Lines (White, matching the main DB/Amplitude line on the front-left)
  const verticalCorners = [
    { x: -width / 2, z: depth / 2 },  // Front-Left
    { x: -width / 2, z: -depth / 2 }, // Back-Left
    { x: width / 2, z: -depth / 2 },  // Back-Right
    { x: width / 2, z: depth / 2 }    // Front-Right
  ];

  verticalCorners.forEach(corner => {
    const points = [
      new THREE.Vector3(corner.x, 0, corner.z),
      new THREE.Vector3(corner.x, 25, corner.z)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
    const line = new THREE.Line(geometry, material);
    
    currentScene.add(line);
    labelSprites.push(line);
  });

  // 6. Bottom Boundary Lines (Completes the floor frame on the Back and Right sides)
  const bottomEdges = [
    // Back Boundary Edge: runs from Back-Left to Back-Right
    [new THREE.Vector3(-width / 2, 0, -depth / 2), new THREE.Vector3(width / 2, 0, -depth / 2)],
    // Right Boundary Edge: runs from Front-Right to Back-Right
    [new THREE.Vector3(width / 2, 0, depth / 2), new THREE.Vector3(width / 2, 0, -depth / 2)]
  ];

  bottomEdges.forEach(edgePoints => {
    const geometry = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
    const line = new THREE.Line(geometry, material);
    
    currentScene.add(line);
    labelSprites.push(line);
  });
}

export function initUI(scene, config) {
  currentScene = scene;
  uiConfig = config;

  const startButton = document.getElementById('startButton');
  const sourceSelect = document.getElementById('sourceSelect');
  const minFreqSlider = document.getElementById('minFreqSlider');
  const minFreqLabel = document.getElementById('minFreqLabel');
  const freqSlider = document.getElementById('freqSlider');
  const sliderLabel = document.getElementById('sliderLabel');
  const timeSlider = document.getElementById('timeSlider');
  const timeLabel = document.getElementById('timeLabel');

  sourceSelect.value = audioState.sourceType || 'mic';

  startButton.addEventListener('click', () => {
    if (!audioState.isRecording) {
      startButton.textContent = 'Stop';
      startAudio(() => generateAllAxisLabels());
    } else {
      startButton.textContent = 'Start';
      stopAudio();
    }
  });

  sourceSelect.addEventListener('change', (e) => {
    const wasRecording = audioState.isRecording;
    if (wasRecording) {
      stopAudio();
      startButton.textContent = 'Start';
    }
    audioState.sourceType = e.target.value;
  });

  minFreqSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    audioState.minFrequency = val;
    minFreqLabel.textContent = val < 1000 ? `Min Frequency: ${val} Hz` : `Min Frequency: ${(val / 1000).toFixed(1)} kHz`;
    freqSlider.min = val + 1000;

    const currentMaxVal = parseInt(freqSlider.value);
    if (audioState.targetFrequency !== currentMaxVal) {
      audioState.targetFrequency = currentMaxVal;
      sliderLabel.textContent = `Max Frequency: ${(currentMaxVal / 1000).toFixed(1)} kHz`;
    }

    if (audioState.context && audioState.analyser) {
      generateAllAxisLabels();
    }
  });

  freqSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    audioState.targetFrequency = val;
    sliderLabel.textContent = `Max Frequency: ${(val / 1000).toFixed(1)} kHz`;
    minFreqSlider.max = val - 1000;

    const currentMinVal = parseInt(minFreqSlider.value);
    if (audioState.minFrequency !== currentMinVal) {
      audioState.minFrequency = currentMinVal;
      minFreqLabel.textContent = currentMinVal < 1000 ? `Min Frequency: ${currentMinVal} Hz` : `Min Frequency: ${(currentMinVal / 1000).toFixed(1)} kHz`;
    }

    if (audioState.context && audioState.analyser) {
      generateAllAxisLabels();
    }
  });

  timeSlider.addEventListener('input', (e) => {
    const seconds = parseFloat(e.target.value);
    audioState.timeWindow = seconds;
    timeLabel.textContent = `Time Window: ${seconds.toFixed(1)}s`;
    if (audioState.context && audioState.analyser) {
      generateAllAxisLabels();
    }
  });
}