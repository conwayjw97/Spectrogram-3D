# 3D Audio Spectrogram Visualiser

https://conwayjw97.github.io/Spectrogram-3D/

A real-time, hardware-accelerated 3D audio spectrogram visualiser that renders incoming audio frequencies from a browser tab or audio input as a dynamic, scrolling terrain. Built using Three.js, custom GLSL shaders, and the Web Audio API.

<img width="1428" height="1117" alt="image" src="https://github.com/user-attachments/assets/93ec908f-b5a6-45f8-9f1b-400906ed8c1f" />

## Key Features

* **Dual-Mesh Terrain Rendering:** Combines plane geometry with custom vertex and fragment shaders to dynamically deform a solid mesh with a wireframe overlay.
* **Interactive Viewport:** Built-in `OrbitControls` let you rotate, pan, and zoom to inspect the frequency terrain from any angle.
* **Real-time Edge Analysis:**
  * **Front (X-Axis):** Active real-time frequency spectrum.
  * **Back (X-Axis):** A historic maximum spectrum (Peak Hold) trace that maps transient peaks over the full time window.
  * **Left (Z-Axis):** Maximum historical amplitude trace over time.
  * **Right (Z-Axis):** Average historical amplitude trace over time.
* **Dynamic Billboard Labels:** Auto-orienting 2D labels that scale dynamically, detailing active frequencies (Hz/kHz), decibels (dB), and time history.
* **Interactive Control Panel:** Real-time sliders to modulate the min/max frequencies, adjust the temporal window, and toggle between audio input or audio stream inputs.

## Tech Stack

* **Three.js:** Handles 3D rendering, lighting, lines, and sprite rendering.
* **GLSL Shaders:** Custom vertex and fragment shaders process high-frequency displacement calculations directly on the GPU.
* **Web Audio API:** Manages real-time audio routing, FFT analysis, and custom source selection.

## File Structure

* `app.js`: Main initialisation file, responsible for setting up the Three.js viewport, managing the rendering loop, and updating the boundary data.
* `ui.js`: Manages user control bindings, updates axis labels dynamically, and handles layout rendering.
* `audio.js`: Configures the audio context, handles permissions, and processes live frequency buffers.
* `shaders.js`: Houses custom GLSL shader code for material styling and mesh displacement.

## Getting Started

Since the project relies on ES Modules, you need to run it via a local development server to avoid CORS policy restrictions.

1. Clone this repository to your local machine.
2. Open your terminal in the project folder and start a quick local server. For example:
   ```bash
   python -m http.server
   ```
   ```bash
   npx serve .
   ```
