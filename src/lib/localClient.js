
const STORAGE_KEYS = {
  user: 'mrjudge_local_user',
  disputes: 'mrjudge_local_disputes'
};

// Holds recorded audio files in memory so TranscribeAudio can find them by their fake URL.
const uploadedFiles = new Map();

const safeStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
};

const readStorage = (key, fallback) => {
  const storage = safeStorage();
  if (!storage) return fallback;
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn('Failed to parse local storage value', key, error);
    return fallback;
  }
};

const writeStorage = (key, value) => {
  const storage = safeStorage();
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
};

const ensureLocalUser = () => {
  const existing = readStorage(STORAGE_KEYS.user, null);
  if (existing) return existing;

  const newUser = {
    id: `local-${Date.now()}`,
    email: 'local-user@mrjudge.app',
    name: 'Local User'
  };

  writeStorage(STORAGE_KEYS.user, newUser);
  return newUser;
};

const getLocalDisputes = () => readStorage(STORAGE_KEYS.disputes, []);

const saveLocalDispute = (payload) => {
  const disputes = getLocalDisputes();
  const dispute = {
    id: `dispute-${Date.now()}`,
    created_at: new Date().toISOString(),
    ...payload
  };
  disputes.push(dispute);
  writeStorage(STORAGE_KEYS.disputes, disputes);
  return dispute;
};

const parseAnalysisPrompt = (prompt) => {
  const englishMatch = prompt.match(/PERSON A['’]s STATEMENT:\s*([\s\S]*?)PERSON B['’]s STATEMENT:\s*([\s\S]*)/i);
  const persianMatch = prompt.match(/بیانیه شخص الف:\s*([\s\S]*?)بیانیه شخص ب:\s*([\s\S]*)/i);

  if (persianMatch) {
    return {
      personA: persianMatch[1]?.trim() || '',
      personB: persianMatch[2]?.trim() || ''
    };
  }

  return {
    personA: englishMatch?.[1]?.trim() || '',
    personB: englishMatch?.[2]?.trim() || ''
  };
};

// Calls the real AI (Groq / GPT-OSS 120B) via our Vercel Function. No local
// fallback: an offline/fake verdict that looks like a real one is worse than
// a clear, visible failure the person can retry - this throws on any error,
// and NewDispute.jsx shows it directly instead of quietly substituting a
// keyword-based guess.
const runAiAnalysis = async (prompt) => {
  const { personA, personB } = parseAnalysisPrompt(prompt);
  const isPersian = /[ا-ی]/.test(prompt);

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personA,
      personB,
      language: isPersian ? 'fa' : 'en'
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Analyze API failed (${response.status}): ${errText}`);
  }

  const result = await response.json();
  if (result.error) throw new Error(result.error);
  return result;
};

export function createLocalAppClient() {
  return {
    auth: {
      isAuthenticated: async () => true,
      me: async () => ensureLocalUser(),
      logout: () => {
        const storage = safeStorage();
        storage?.removeItem(STORAGE_KEYS.user);
      },
      redirectToLogin: () => {}
    },
    entities: {
      Dispute: {
        filter: async ({ id }) => {
          const disputes = getLocalDisputes();
          return id ? disputes.filter((item) => item.id === id) : disputes;
        },
        create: async (payload) => saveLocalDispute(payload)
      }
    },
    integrations: {
      Core: {
        UploadFile: async ({ file }) => {
          const url = `local://${Date.now()}-${file?.name || 'capture'}`;
          uploadedFiles.set(url, file);
          return { file_url: url };
        },
        TranscribeAudio: async ({ audio_url, language }) => {
          const file = uploadedFiles.get(audio_url);
          if (!file) {
            throw new Error('No recorded audio found for this session.');
          }

          const formData = new FormData();
          formData.append('audio', file);
          if (language) formData.append('language', language);

          // Throw (rather than swallow) on any failure. VoiceButton relies on this to
          // retry with different payloads and to show the user a real error message -
          // silently returning { text: '' } here made every transcription failure look
          // like nothing happened at all.
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Transcription request failed (${response.status}): ${errText}`);
          }

          return response.json();
        },
        InvokeLLM: async ({ prompt }) => runAiAnalysis(prompt)
      }
    },
    appLogs: {
      logUserInApp: async () => {}
    }
  };
}
