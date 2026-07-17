export const audioState = {
  context: null,
  analyser: null,
  dataArray: null,
  isRecording: false,
  minFrequency: 0,
  targetFrequency: 10000,
  timeWindow: 2.0,
  sourceType: 'mic',    
  activeStream: null,    
  showWireframe: true,
  showTopLines: false,           
  showBlueprintLines: true,      
  axisLinesOnly: false,          
  disableAllLinesLabels: false   
};

export async function startAudio(onSuccess) {
  if (!audioState.context) {
    audioState.context = new (window.AudioContext || window.webkitAudioContext)();
    audioState.analyser = audioState.context.createAnalyser();
    
    audioState.analyser.fftSize = 2048; 
    audioState.analyser.minDecibels = -100;
    audioState.analyser.maxDecibels = -30;

    const bufferLength = audioState.analyser.frequencyBinCount; 
    audioState.dataArray = new Uint8Array(bufferLength);
  } else {
    audioState.context.resume();
  }

  try {
    let stream;
    if (audioState.sourceType === 'tab') {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      stream.getVideoTracks().forEach(track => track.stop());

      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach(track => track.stop());

        const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
        
        if (isFirefox) {
          throw new Error(
            'Firefox does not support capturing browser tab or system audio. ' +
            'Please run this visualiser in a Chromium-based browser (such as Chrome or Edge) to share tab audio, ' +
            'or switch your Audio Source back to "Microphone".'
          );
        } else {
          throw new Error(
            'No audio selected! Ensure the "Share tab audio" checkbox is checked. ' +
            '(Note: You must share a specific browser tab, as choosing "Entire Screen" or "Window" does not support audio capture.)'
          );
        }
      }
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    audioState.activeStream = stream;
    const source = audioState.context.createMediaStreamSource(stream);
    source.connect(audioState.analyser);
    audioState.isRecording = true;
    
    if (onSuccess) onSuccess();
  } catch (err) {
    console.error('Failed to acquire audio input stream:', err);
    stopAudio();
    alert(err.message || 'Could not access audio stream source.');
  }
}

export function stopAudio() {
  if (audioState.activeStream) {
    audioState.activeStream.getTracks().forEach(track => track.stop());
    audioState.activeStream = null;
  }
  if (audioState.context) {
    audioState.context.close();
    audioState.context = null;
    audioState.analyser = null;
    audioState.dataArray = null;
    audioState.isRecording = false;
  }
}