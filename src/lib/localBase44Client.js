import { analyzeDispute } from '@/lib/dispute-analysis';

const STORAGE_KEYS = {
  user: 'mrjudge_local_user',
  credits: 'mrjudge_local_credits',
  disputes: 'mrjudge_local_disputes'
};

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

const ensureLocalCredits = (userEmail) => {
  const records = readStorage(STORAGE_KEYS.credits, []);
  const existing = records.find((record) => record.user_email === userEmail);

  if (existing) return existing;

  const newRecord = {
    id: `credit-${Date.now()}`,
    user_email: userEmail,
    remaining_credits: 5,
    total_purchased: 0
  };

  records.push(newRecord);
  writeStorage(STORAGE_KEYS.credits, records);
  return newRecord;
};

const updateLocalCredits = (creditId, updates) => {
  const records = readStorage(STORAGE_KEYS.credits, []);
  const index = records.findIndex((record) => record.id === creditId);
  if (index === -1) {
    return null;
  }
  records[index] = { ...records[index], ...updates };
  writeStorage(STORAGE_KEYS.credits, records);
  return records[index];
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

const buildLocalAnalysisResult = (prompt) => {
  const { personA, personB } = parseAnalysisPrompt(prompt);
  const isPersian = /[ا-ی]/.test(prompt);
  return analyzeDispute({
    personA_statement: personA,
    personB_statement: personB,
    language: isPersian ? 'fa' : 'en'
  });
};

export function createLocalBase44LikeClient() {
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
      Credit: {
        filter: async ({ user_email }) => [ensureLocalCredits(user_email)],
        create: async (payload) => {
          const record = {
            id: `credit-${Date.now()}`,
            ...payload
          };
          const records = readStorage(STORAGE_KEYS.credits, []);
          records.push(record);
          writeStorage(STORAGE_KEYS.credits, records);
          return record;
        },
        update: async (id, updates) => updateLocalCredits(id, updates)
      },
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
        UploadFile: async ({ file }) => ({ file_url: `local://${file?.name || 'capture'}` }),
        TranscribeAudio: async () => ({ text: '' }),
        InvokeLLM: async ({ prompt }) => buildLocalAnalysisResult(prompt)
      }
    },
    appLogs: {
      logUserInApp: async () => {}
    }
  };
}
