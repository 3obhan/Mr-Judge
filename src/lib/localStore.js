/**
 * Local storage for the dispute history and the unsent draft (stays on the user's own device).
 * Credits and the account live on the server: see lib/account.js.
 */
const DISPUTES_KEY = 'judge_disputes_v1';
const DRAFT_KEY = 'judge_draft_v1';

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error('Storage write failed', e); }
};

const newId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

// ---------- disputes ----------
export function listDisputes() {
  return read(DISPUTES_KEY, []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
}

export function getDispute(id) {
  return read(DISPUTES_KEY, []).find((d) => d.id === id) || null;
}

export function createDispute(data) {
  const list = read(DISPUTES_KEY, []);
  const dispute = { ...data, id: newId(), created_date: new Date().toISOString() };
  list.push(dispute);
  write(DISPUTES_KEY, list);
  return dispute;
}

export function deleteDispute(id) {
  write(DISPUTES_KEY, read(DISPUTES_KEY, []).filter((d) => d.id !== id));
}

export function deleteAllData() {
  // includes the account key and cached balance (lib/account.js) and the payment return markers
  [DISPUTES_KEY, DRAFT_KEY, 'judge_account_key_v1', 'judge_credits_cache_v1', 'judge_account_info_v1', 'judge_credits_v1', 'judge_pending_payment_v1', 'judge_play_tokens_v1']
    .forEach((k) => localStorage.removeItem(k));
  try { ['judge_pp_order', 'judge_pay_return', 'judge_pay_cancelled'].forEach((k) => sessionStorage.removeItem(k)); } catch { /* ignore */ }
}
