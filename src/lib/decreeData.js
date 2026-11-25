import { translate } from '@/locales';

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const list = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
const score = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

/**
 * A saved dispute -> the data printed on the decree.
 * Also reads disputes saved by the earlier judge (independent scores, other field names), so history stays printable.
 */
export function toDecree(data, language = 'en') {
  const partyAScore = score(data.personA_score);
  const partyBScore = score(data.personB_score);
  const winner = data.winner
    || (Math.abs(partyAScore - partyBScore) <= 10 ? 'equal' : partyAScore > partyBScore ? 'partyA' : 'partyB');
  const timestamp = Number(data.timestamp) || Date.parse(data.created_date) || Date.now();

  return {
    partyA: { name: translate(language, 'verdict.personA'), claimText: str(data.personA_statement) },
    partyB: { name: translate(language, 'verdict.personB'), claimText: str(data.personB_statement) },
    verdict: {
      decreeCode: str(data.decreeCode) || `MJ-${timestamp.toString(36).toUpperCase()}`,
      timestamp,
      winner,
      partyAScore,
      partyBScore,
      verdictTitle: str(data.verdictTitle) || str(data.verdict),
      executiveSummary: str(data.executiveSummary) || str(data.executive_summary) || str(data.explanation),
      pureReasoning: str(data.pureReasoning) || str(data.reasoning),
      factualAnalysis: str(data.factualAnalysis),
      realityCheck: str(data.realityCheck),
      keyFactors: list(data.keyFactors ?? data.analysis?.responsibility_factors),
      suggestedSettlement: str(data.suggestedSettlement) || str(data.settlement),
      judicialMaxims: list(data.judicialMaxims ?? [data.governing_principle]),
    },
  };
}
