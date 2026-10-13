const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Validates the shape of a real AI response. There is deliberately no local
// fallback here anymore - an earlier version of this app quietly substituted
// a keyword-counting heuristic whenever the AI call failed or returned a
// malformed shape, which produced a fake verdict that looked identical to a
// real one. Throwing instead means a bad response is a visible, retryable
// error on the submission page, never a silent wrong answer on Results.
export function normalizeAnalysisResult(result) {
  const isValidShape =
    result &&
    typeof result === 'object' &&
    Number.isFinite(Number(result.personA_score)) &&
    Number.isFinite(Number(result.personB_score)) &&
    typeof result.verdict === 'string' &&
    typeof result.explanation === 'string';

  if (!isValidShape) {
    throw new Error('AI judge returned an unexpected response shape');
  }

  return {
    personA_score: clamp(Math.round(Number(result.personA_score)), 0, 100),
    personB_score: clamp(Math.round(Number(result.personB_score)), 0, 100),
    verdict: result.verdict,
    explanation: result.explanation,
    reasoning: typeof result.reasoning === 'string' ? result.reasoning : undefined
  };
}

// Builds the prompt passed to appClient.integrations.Core.InvokeLLM(), which
// routes through the real AI judge (Groq / GPT-OSS 120B).
//
// IMPORTANT: the "PERSON A's STATEMENT:" / "PERSON B's STATEMENT:" markers (and
// their Persian equivalents) must stay in sync with parseAnalysisPrompt() in
// localClient.js, which extracts personA/personB back out of this string
// before forwarding them to the /api/analyze backend.
export function buildAnalysisPrompt({ personA_statement, personB_statement, language = 'en' }) {
  if (language === 'fa') {
    return `بیانیه شخص الف:\n${personA_statement}\n\nبیانیه شخص ب:\n${personB_statement}`;
  }

  return `PERSON A's STATEMENT:\n${personA_statement}\n\nPERSON B's STATEMENT:\n${personB_statement}`;
}
