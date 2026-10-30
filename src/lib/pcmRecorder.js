/**
 * Records raw microphone audio (PCM) with the Web Audio API.
 *
 * Why not MediaRecorder? It produces different containers per browser (webm, fragmented mp4...) that
 * often cannot be decoded again or are rejected by the speech model. Raw PCM works the same everywhere
 * (Chrome, Safari, Firefox, Android WebView, iOS) and is converted to WAV in audioUtils.preparePcm.
 *
 * IMPORTANT: call startPcmRecording() directly from the click handler (Safari needs the AudioContext
 * to be created and resumed inside the user gesture).
 */
const concat = (chunks) => {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
};

export async function startPcmRecording(onLevel) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx || !navigator.mediaDevices?.getUserMedia) {
    const e = new Error('Audio recording is not supported'); e.code = 'unsupported'; throw e;
  }

  const ctx = new Ctx();                 // created inside the click (user gesture)
  const resumed = ctx.resume ? ctx.resume() : Promise.resolve();

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
  } catch (err) {
    try { ctx.close(); } catch { /* noop */ }
    throw err;
  }
  try { await resumed; if (ctx.state === 'suspended') await ctx.resume(); } catch { /* noop */ }

  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();         // the processor must be connected to run; keep it silent
  mute.gain.value = 0;

  const chunks = [];
  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    if (onLevel) {
      let peak = 0;
      for (let i = 0; i < input.length; i++) { const a = Math.abs(input[i]); if (a > peak) peak = a; }
      onLevel(peak);
    }
  };
  source.connect(processor);
  processor.connect(mute);
  mute.connect(ctx.destination);

  let finished = false;
  const release = async () => {
    if (finished) return null;
    finished = true;
    processor.onaudioprocess = null;
    try { source.disconnect(); processor.disconnect(); mute.disconnect(); } catch { /* noop */ }
    stream.getTracks().forEach((t) => t.stop());
    const sampleRate = ctx.sampleRate;
    try { await ctx.close(); } catch { /* noop */ }
    return sampleRate;
  };

  return {
    /** Stop and return { samples: Float32Array, sampleRate } */
    async stop() {
      const sampleRate = await release();
      return { samples: concat(chunks), sampleRate: sampleRate || 44100 };
    },
    /** Stop and throw everything away */
    async cancel() { await release(); },
  };
}
