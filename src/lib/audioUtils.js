/**
 * Audio helpers for speech-to-text.
 * Browsers record in different containers (webm on Chrome/Android, mp4 on Safari/iOS).
 * We decode whatever was recorded and re-encode it as 16 kHz mono WAV, which Gemini reads reliably
 * and which is small and fast to upload.
 */

const TARGET_RATE = 16000;
// Each request must stay small (Vercel functions accept ~4.5 MB). 75 s of 16 kHz mono WAV is ~2.4 MB.
const MAX_CHUNK_SECONDS = 75;

/** Split samples into pieces of at most maxSec, cutting at the quietest moment so words are not chopped. */
export function splitAtQuietPoints(pcm, rate = TARGET_RATE, maxSec = MAX_CHUNK_SECONDS) {
  const maxLen = Math.floor(maxSec * rate);
  if (pcm.length <= maxLen) return [pcm];
  const block = Math.floor(rate * 0.1);
  const chunks = [];
  let start = 0;
  while (pcm.length - start > maxLen) {
    const from = start + maxLen - rate * 10;
    const to = start + maxLen - block;
    let best = start + maxLen;
    let bestEnergy = Infinity;
    for (let i = from; i <= to; i += block) {
      let e = 0;
      for (let j = i; j < i + block; j++) e += pcm[j] * pcm[j];
      if (e < bestEnergy) { bestEnergy = e; best = i + Math.floor(block / 2); }
    }
    chunks.push(pcm.subarray(start, best));
    start = best;
  }
  chunks.push(pcm.subarray(start));
  return chunks;
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

function resampleLinear(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = pos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

async function resampleTo16k(samples, sampleRate) {
  if (sampleRate === TARGET_RATE) return samples;
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  try {
    if (!OfflineCtx) throw new Error('no OfflineAudioContext');
    const length = Math.max(1, Math.ceil((samples.length * TARGET_RATE) / sampleRate));
    const offline = new OfflineCtx(1, length, TARGET_RATE);
    const buffer = offline.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  } catch {
    // Very old browsers: simple (slightly lower quality) fallback
    return resampleLinear(samples, sampleRate, TARGET_RATE);
  }
}

/**
 * Turn raw recorded PCM into what the speech model needs: 16 kHz mono WAV, volume boosted if quiet.
 * Long recordings are cut into several WAV pieces (chunks) so each upload stays small.
 * Returns { chunks: Blob[], mimeType, duration, peak } where peak is the loudest sample (0..1) before boosting.
 */
export async function preparePcm(samples, sampleRate) {
  const duration = samples.length / sampleRate;
  const pcm = await resampleTo16k(samples, sampleRate);

  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]);
    if (a > peak) peak = a;
  }

  // Boost quiet recordings (up to 8x) so speech is clearly audible to the model.
  if (peak > 0.01 && peak < 0.6) {
    const gain = Math.min(8, 0.9 / peak);
    const boosted = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) boosted[i] = pcm[i] * gain;
    return finish(boosted, duration, peak);
  }
  return finish(pcm, duration, peak);
}

function finish(pcm, duration, peak) {
  const chunks = splitAtQuietPoints(pcm, TARGET_RATE).map((part) => encodeWav(part, TARGET_RATE));
  return { chunks, mimeType: 'audio/wav', duration, peak };
}
