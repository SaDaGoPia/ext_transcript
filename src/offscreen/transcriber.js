import { pipeline, env } from '@xenova/transformers';

let configured = false;
function configureEnvironment() {
  if (configured) return;
  env.allowLocalModels = false;
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('offscreen/ort-wasm/');
  }
  configured = true;
}

let cachedPipelinePromise = null;
async function defaultPipelineFactory() {
  configureEnvironment();
  if (!cachedPipelinePromise) {
    cachedPipelinePromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
  }
  return cachedPipelinePromise;
}

export async function decodeBlobToFloat32Array(blob, audioContext) {
  // Chrome caps concurrent AudioContexts per document (6), so a context we
  // created ourselves must be closed again. A caller-supplied one is left
  // alone — it belongs to the caller.
  const ctx = audioContext ?? new AudioContext({ sampleRate: 16000 });
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return audioBuffer.getChannelData(0);
  } finally {
    if (!audioContext) await ctx.close();
  }
}

export async function transcribeAudioBlob(blob, {
  pipelineFactory = defaultPipelineFactory,
  decodeAudio = decodeBlobToFloat32Array,
  language = 'spanish',
} = {}) {
  const audioData = await decodeAudio(blob);
  const transcriber = await pipelineFactory();
  const result = await transcriber(audioData, { language, task: 'transcribe' });
  return result.text;
}
