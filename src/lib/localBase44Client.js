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
  const match = prompt.match(/PERSON A['’]s STATEMENT:\s*([\s\S]*?)PERSON B['’]s STATEMENT:\s*([\s\S]*)/i);
  return {
    personA: match?.[1]?.trim() || '',
    personB: match?.[2]?.trim() || ''
  };
};

const calcLocalHeuristicScore = (statement) => {
  const normalized = String(statement || '').toLowerCase();
  const strongTerms = ['should', 'must', 'wrong', 'fair', 'agreed', 'promise', 'refund', 'breach', 'late', 'owe', 'responsible', 'clear', 'unfair', 'violated', 'contract'];
  const weakTerms = ['maybe', 'perhaps', 'unclear', 'sorry', 'unknown', 'not sure'];
  const strongCount = strongTerms.filter((term) => normalized.includes(term)).length;
  const weakCount = weakTerms.filter((term) => normalized.includes(term)).length;
  const lengthScore = Math.min(35, Math.round(normalized.split(/\s+/).filter(Boolean).length / 2));

  return Math.max(20, Math.min(95, 50 + strongCount * 7 + lengthScore - weakCount * 5));
};

const buildLocalAnalysisResult = (prompt) => {
  const { personA, personB } = parseAnalysisPrompt(prompt);
  const personAScore = calcLocalHeuristicScore(personA);
  const personBScore = calcLocalHeuristicScore(personB);

  let verdict = 'Both parties are partially justified';
  if (personAScore > personBScore + 10) verdict = 'Person A is more justified';
  else if (personBScore > personAScore + 10) verdict = 'Person B is more justified';

  const explanation = `This local analysis compares the relative clarity, responsibility language, and strength of each statement. The result is based on the wording and structure of the dispute rather than a live external model.`;

  return {
    personA_score: Math.round(personAScore),
    personB_score: Math.round(personBScore),
    verdict,
    explanation
  };
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
