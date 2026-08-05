import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';

/**
 * VoiceButton Component
 * Adds voice-to-text input.
 *
 * Dual strategy:
 * - English: uses the browser's Web Speech API (real-time, no credits)
 * - Persian: records audio via MediaRecorder, then transcribes with Whisper
 *   (which supports fa) via the TranscribeAudio integration.
 *   This is needed because Chrome's Web Speech API doesn't support fa-IR.
 *
 * @param {string} value - current textarea value
 * @param {function} onChange - setter for the textarea value
 * @param {string} language - 'en' | 'fa'
 */
export default function VoiceButton({ value, onChange, language = 'en' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // --- Shared refs ---
  const languageRef = useRef(language);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { languageRef.current = language; }, [language]);

  // Auto-clear error
  useEffect(() => {
    if (!errorMsg) return;
    const timer = setTimeout(() => setErrorMsg(''), 6000);
    return () => clearTimeout(timer);
  }, [errorMsg]);

  // --- Web Speech API refs (English) ---
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const baseTextRef = useRef('');
  const finalTextRef = useRef('');
  const restartTimeoutRef = useRef(null);

  // --- MediaRecorder refs (Persian) ---
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Create Web Speech recognition once
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interimText = '';
      let newFinalText = finalTextRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) newFinalText += transcript;
        else interimText += transcript;
      }
      finalTextRef.current = newFinalText;
      const base = baseTextRef.current;
      const parts = [base, newFinalText, interimText].filter(s => s && s.trim());
      let combined = parts.join(' ').replace(/\s+/g, ' ').trim();
      onChangeRef.current(combined);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      const messages = {
        'not-allowed': 'Microphone permission denied.',
        'service-not-allowed': 'Speech service unavailable.',
        'network': 'Network error.',
        'audio-capture': 'No microphone found.',
      };
      setErrorMsg(messages[event.error] || 'Speech recognition error.');
      setIsRecording(false);
      isRecordingRef.current = false;
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (isRecordingRef.current && recognitionRef.current) {
            recognitionRef.current.lang = 'en-US';
            try { recognitionRef.current.start(); } catch (e) { }
          }
        }, 150);
      } else {
        setIsRecording(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isRecordingRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      try { recognition.stop(); } catch (e) { }
    };
  }, []);

  // --- English: Web Speech API ---
  const startWebSpeech = () => {
    if (!recognitionRef.current) {
      setErrorMsg('Voice not supported in this browser.');
      return;
    }
    recognitionRef.current.lang = 'en-US';
    baseTextRef.current = valueRef.current || '';
    finalTextRef.current = '';
    isRecordingRef.current = true;
    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (e) {
      setErrorMsg('Failed to start. Please try again.');
      isRecordingRef.current = false;
    }
  };

  const stopWebSpeech = () => {
    isRecordingRef.current = false;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    try { recognitionRef.current.stop(); } catch (e) { }
    setIsRecording(false);
  };

  // --- Persian: MediaRecorder + Whisper transcription ---
  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // Release microphone
        streamRef.current.getTracks().forEach(t => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

        setIsTranscribing(true);
        try {
          // Upload then transcribe with Whisper
          const { file_url } = await base44.integrations.Core.UploadFile({ file: audioFile });
          const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });

          // Append to existing text
          const current = valueRef.current || '';
          const newText = (current + ' ' + transcript).replace(/\s+/g, ' ').trim();
          onChangeRef.current(newText);
        } catch (err) {
          console.error('Transcription failed:', err);
          setErrorMsg('خطا در تبدیل صوت به متن. دوباره تلاش کنید.');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access failed:', err);
      setErrorMsg('دسترسی به میکروفون ممکن نشد.');
    }
  };

  const stopMediaRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // --- Toggle ---
  const toggleRecording = () => {
    setErrorMsg('');
    const isFa = languageRef.current === 'fa';

    if (isRecording) {
      isFa ? stopMediaRecorder() : stopWebSpeech();
    } else {
      isFa ? startMediaRecorder() : startWebSpeech();
    }
  };

  const isBusy = isRecording || isTranscribing;

  return (
    <div className="flex items-center gap-2">
      {errorMsg && (
        <span className="flex items-center gap-1 text-xs text-red-500 max-w-[220px]">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="line-clamp-3">{errorMsg}</span>
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggleRecording}
        disabled={isTranscribing}
        className={`gap-1.5 transition-all duration-200 shrink-0 ${
          isRecording
            ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100 hover:text-red-700'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {isTranscribing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{language === 'fa' ? 'در حال تبدیل...' : 'Transcribing'}</span>
          </>
        ) : isRecording ? (
          <>
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="animate-pulse">
              {language === 'fa' ? 'در حال ضبط...' : 'Listening'}
            </span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5" />
            <span>Voice</span>
          </>
        )}
      </Button>
    </div>
  );
}