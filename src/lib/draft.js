/**
 * Auto-saves the dispute form on this device so a typed (or dictated) case is not lost
 * if the page is closed, refreshed or the analysis fails.
 */
const DRAFT_KEY = 'judge_draft_v1';

export function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    return { personA: String(d?.personA || ''), personB: String(d?.personB || '') };
  } catch {
    return { personA: '', personB: '' };
  }
}

export function saveDraft(personA, personB) {
  try {
    if (!personA && !personB) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify({ personA, personB }));
  } catch { /* storage full or blocked: ignore */ }
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
}
