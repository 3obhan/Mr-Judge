const STRONG_TERMS = [
  'should', 'must', 'wrong', 'fair', 'agreed', 'promise', 'refund', 'breach', 'late',
  'owe', 'responsible', 'clear', 'unfair', 'violated', 'contract', 'paid', 'agreement',
  'failed', 'delayed', 'damage', 'expecting', 'request', 'due', 'issue', 'told',
  'accepted', 'scheduled', 'guarantee', 'informed', 'did not', 'didn\'t', 'never',
  'broken', 'missed', 'prevented', 'stated', 'confirmed', 'received', 'sent', 'apologized',
  'liable', 'penalty', 'law', 'valid', 'canceled', 'cancelled', 'replied', 'warning',
  'refund', 'pay', 'owe', 'promised', 'arranged', 'agreed', 'satisfied', 'disappointed'
];

const WEAK_TERMS = [
  'maybe', 'perhaps', 'unclear', 'sorry', 'unknown', 'not sure', 'i think', 'probably',
  'might', 'could', 'seems', 'kind of', 'sort of', 'uncertain', 'not clear', 'not sure',
  'i guess', 'likely', 'possibly', 'assume', 'assumed'
];

const RESPONSIBILITY_TERMS = [
  'my fault', 'your fault', 'i was responsible', 'you were responsible', 'i paid',
  'you paid', 'i agreed', 'you agreed', 'i promised', 'you promised', 'i told you',
  'you told me', 'i informed you', 'you informed me', 'i failed', 'you failed',
  'i apologized', 'you apologized', 'i notified', 'you notified', 'i confirmed', 'you confirmed'
];

const EVIDENCE_TERMS = [
  'because', 'proof', 'message', 'email', 'text', 'receipt', 'invoice', 'record', 'document',
  'video', 'photo', 'chat', 'call', 'witness', 'signed', 'written', 'confirmed', 'calendar',
  'ticket', 'transaction', 'bank', 'account', 'contract', 'agreement'
];

const normalizeText = (value) => String(value || '').toLowerCase().trim();

const countMatches = (text, terms) => terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function analyzeDispute({ personA_statement, personB_statement, language = 'en' }) {
  const personAText = normalizeText(personA_statement);
  const personBText = normalizeText(personB_statement);

  const scoreStatement = (text) => {
    const strongCount = countMatches(text, STRONG_TERMS);
    const weakCount = countMatches(text, WEAK_TERMS);
    const responsibilityCount = countMatches(text, RESPONSIBILITY_TERMS);
    const evidenceCount = countMatches(text, EVIDENCE_TERMS);
    const lengthScore = Math.min(25, Math.max(0, Math.round(text.split(/\s+/).filter(Boolean).length / 6)));

    let score = 50 + strongCount * 7 + evidenceCount * 4 + responsibilityCount * 5 + lengthScore - weakCount * 6;

    if (text.includes('not fair') || text.includes('unreasonable') || text.includes('too much')) {
      score -= 6;
    }

    return clamp(Math.round(score), 15, 95);
  };

  const personAScore = scoreStatement(personAText);
  const personBScore = scoreStatement(personBText);
  const difference = personAScore - personBScore;

  let verdict;
  let explanation;

  if (language === 'fa') {
    if (difference > 10) {
      verdict = 'شخص الف حق بیشتری دارد';
    } else if (difference < -10) {
      verdict = 'شخص ب حق بیشتری دارد';
    } else if (personAScore < 35 && personBScore < 35) {
      verdict = 'هیچ‌کدام حق ندارند';
    } else {
      verdict = 'هر دو طرف تا حدی حق دارند';
    }

    explanation = 'این تحلیل بر پایه‌ی قدرت استدلال، وضوح، مسئولیت و تناسب هر بیانیه انجام شده است. نتیجه بر اساس واژه‌ها و ساختار اختلاف، نه بر اساس مدل خارجی زنده، ارزیابی شده است.';
  } else {
    if (difference > 10) {
      verdict = 'Person A is more justified';
    } else if (difference < -10) {
      verdict = 'Person B is more justified';
    } else if (personAScore < 35 && personBScore < 35) {
      verdict = 'Neither party is justified';
    } else {
      verdict = 'Both parties are partially justified';
    }

    explanation = 'This analysis compares the strength, clarity, responsibility, and proportionality of each statement. The result is based on the wording and structure of the dispute rather than a live external model.';
  }

  return {
    personA_score: personAScore,
    personB_score: personBScore,
    verdict,
    explanation
  };
}

export function normalizeAnalysisResult(result, { personA_statement, personB_statement, language = 'en' }) {
  if (
    result &&
    typeof result === 'object' &&
    Number.isFinite(Number(result.personA_score)) &&
    Number.isFinite(Number(result.personB_score)) &&
    typeof result.verdict === 'string' &&
    typeof result.explanation === 'string'
  ) {
    return {
      personA_score: clamp(Math.round(Number(result.personA_score)), 0, 100),
      personB_score: clamp(Math.round(Number(result.personB_score)), 0, 100),
      verdict: result.verdict,
      explanation: result.explanation
    };
  }

  return analyzeDispute({ personA_statement, personB_statement, language });
}
