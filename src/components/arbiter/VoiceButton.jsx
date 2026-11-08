import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { transcribeAudio } from '@/lib/geminiClient';
import { preparePcm } from '@/lib/audioUtils';
import { startPcmRecording } from '@/lib/pcmRecorder';
import { translate } from '@/locales';

const MAX_SECONDS = 240;   // auto-stop after 4 minutes
const MIN_SECONDS = 0.6;   // ignore accidental taps

const MESSAGE_KEYS = ['unsupported', 'mic', 'noMic', 'tooShort', 'noSpeech', 'quota', 'key', 'server', 'network', 'generic'];
const messagesFor = (lang) => Object.fromEntries(MESSAGE_KEYS.map((k) => [k, translate(lang, `voice.${k}`)]));

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const joinText = (base, addition) => `${base || ''} ${addition || ''}`.replace(/\s+/g, ' ').trim();

/**
 * VoiceButton Component
 * Voice-to-text input in any language of the app. Records raw microphone audio (works in every browser),
 * cleans it (16 kHz mono WAV, volume boost, long recordings split in pieces) and transcribes it with Gemini.
 *
 * @param {string} value - current textarea value
 * @param {function} onChange - setter for the textarea value
 * @param {string} language - language code (en, fa, ar, ...)
 */
export default function VoiceButton({ value, onChange, language = 'en' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [progress, setProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [errorDetail, setErrorDetail] = useState('');

  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const languageRef = useRef(language);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const levelRef = useRef(0);
  const stopRef = useRef(null);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { languageRef.current = language; }, [language]);

  const msgs = messagesFor;

  const showError = (message, detail = '') => { setErrorMsg(message); setErrorDetail(detail); };
  const clearError = () => { setErrorMsg(''); setErrorDetail(''); };

  // Clear error message after a while
  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(clearError, 9000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const discardRecording = async () => {
    clearTimer();
    const rec = recorderRef.current;
    recorderRef.current = null;
    setIsRecording(false);
    try { await rec?.cancel(); } catch { /* noop */ }
  };

  // Switching language while recording: throw the recording away
  useEffect(() => {
    if (recorderRef.current) discardRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Release the microphone if the component disappears
  useEffect(() => () => {
    clearTimer();
    try { recorderRef.current?.cancel(); } catch { /* noop */ }
  }, []);

  const errorToMessage = (err, m) => {
    const s = err?.status;
    if (s === 429) return m.quota;
    if (s === 404 || s === 405) return m.server;
    if (s === 401 || s === 403 || s === 500) return m.key;
    if (err instanceof TypeError) return m.network; // fetch itself failed
    return m.generic;
  };

  const processRecording = async (samples, sampleRate) => {
    const lang = languageRef.current;
    const m = msgs(lang);
    setIsProcessing(true);
    try {
      if (samples.length / sampleRate < MIN_SECONDS) {
        showError(m.tooShort);
        return;
      }
      const audio = await preparePcm(samples, sampleRate);
      if (audio.peak < 0.01) {
        showError(m.noSpeech); // silence: do not waste a request
        return;
      }

      // Long recordings arrive in several pieces; transcribe them in order, each with the text so far as context.
      let collected = '';
      const total = audio.chunks.length;
      try {
        for (let i = 0; i < total; i++) {
          if (total > 1) setProgress(`${i + 1}/${total}`);
          const piece = await transcribeAudio(audio.chunks[i], {
            mimeType: audio.mimeType,
            language: lang,
            context: joinText(valueRef.current, collected),
          });
          collected = joinText(collected, piece);
        }
      } catch (err) {
        // Keep whatever was already transcribed, then report the problem
        if (collected) onChangeRef.current(joinText(valueRef.current, collected));
        throw err;
      }

      if (!collected) {
        showError(m.noSpeech);
        return;
      }
      onChangeRef.current(joinText(valueRef.current, collected));
    } catch (err) {
      console.error('Transcription failed:', err);
      showError(errorToMessage(err, m), err?.detail || String(err?.message || '').slice(0, 180));
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const stopRecording = async () => {
    clearTimer();
    const rec = recorderRef.current;
    recorderRef.current = null;
    setIsRecording(false);
    if (!rec) return;
    const { samples, sampleRate } = await rec.stop();
    processRecording(samples, sampleRate);
  };
  stopRef.current = stopRecording;

  // NOTE: no await before startPcmRecording(): Safari needs the audio context created inside the tap.
  const startRecording = async () => {
    const m = msgs(languageRef.current);
    try {
      levelRef.current = 0;
      const rec = await startPcmRecording((peak) => { if (peak > levelRef.current) levelRef.current = peak; });
      recorderRef.current = rec;
      setElapsed(0);
      setIsRecording(true);

      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(secs);
        setLevel(Math.min(1, levelRef.current * 2));
        levelRef.current *= 0.6; // decay so the bar follows the voice
        if (secs >= MAX_SECONDS) stopRef.current?.();
      }, 150);
    } catch (err) {
      console.error('Microphone access failed:', err);
      if (err?.code === 'unsupported') showError(m.unsupported);
      else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') showError(m.noMic);
      else showError(m.mic, err?.name || '');
    }
  };

  const toggleRecording = () => {
    clearError();
    if (isProcessing) return;
    if (isRecording) stopRecording();
    else startRecording();
  };

  return (
    <div className="flex items-center gap-2">
      {errorMsg && (
        <span className="flex items-start gap-1 text-xs text-red-500 max-w-[240px]">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            <span className="line-clamp-3">{errorMsg}</span>
            {errorDetail && <span className="block text-[10px] opacity-70 break-words" dir="ltr">{errorDetail}</span>}
          </span>
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`gap-1.5 transition-all duration-200 shrink-0 ${
          isRecording
            ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{translate(language, 'voice.transcribing')}{progress ? ` ${progress}` : ''}</span>
          </>
        ) : isRecording ? (
          <>
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="inline-block h-2.5 w-8 rounded bg-red-200 overflow-hidden" dir="ltr" aria-hidden="true">
              <span className="block h-full bg-red-500 transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} />
            </span>
            <span className="tabular-nums" dir="ltr">{fmtTime(elapsed)}</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5" />
            <span>{translate(language, 'voice.button')}</span>
          </>
        )}
      </Button>
    </div>
  );
}
