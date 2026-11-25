import { getLanguage } from '@/locales';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  .replace(/\r?\n/g, '<br>');

const formatDigits = (value, language) => language === 'fa'
  ? String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
  : String(value);

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const listSection = (title, values) => {
  const items = Array.isArray(values) ? values.filter((item) => hasText(item)) : [];
  if (!items.length) return null;
  return {
    title,
    html: `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
  };
};
const textSection = (title, value) => hasText(value)
  ? { title, html: `<p>${escapeHtml(value)}</p>` }
  : null;

export async function generateVerdictPdf(data, language = 'en') {
  const info = getLanguage(language);
  const isFa = language === 'fa';
  const dir = info.dir || (isFa ? 'rtl' : 'ltr');
  const t = isFa ? {
    title: 'گزارش نهایی ارزیابی اختلاف',
    case: 'شناسه پرونده',
    date: 'تاریخ صدور',
    outcome: 'نتیجه ارزیابی',
    partyA: 'طرف اول',
    partyB: 'طرف دوم',
    summary: 'خلاصه اجرایی رأی',
    reasoning: 'استدلال و مبانی ارزیابی',
    settlement: 'راهکار پیشنهادی حل اختلاف',
    claimsA: 'ادعاها و مواضع طرف اول',
    claimsB: 'ادعاها و مواضع طرف دوم',
    strongestA: 'قوی‌ترین استدلال طرف اول',
    strongestB: 'قوی‌ترین استدلال طرف دوم',
    weaknessA: 'نقطه‌ضعف اصلی موضع طرف اول',
    weaknessB: 'نقطه‌ضعف اصلی موضع طرف دوم',
    scope: 'بررسی دامنه و دقت ادعاها',
    causal: 'بررسی رابطه علت و معلول',
    proportionality: 'سنجش تناسب نتیجه',
    agreed: 'نقاط مورد توافق',
    disputed: 'موضوعات مورد اختلاف',
    contradictions: 'تناقض‌ها و ناسازگاری‌ها',
    evidenceA: 'ادله و مستندات طرف اول',
    evidenceB: 'ادله و مستندات طرف دوم',
    unknowns: 'موارد نامشخص و اطلاعات ناکافی',
    responsibility: 'عوامل مؤثر در تعیین مسئولیت',
    principle: 'اصل راهنمای ارزیابی',
    confidence: 'میزان اطمینان',
    statementA: 'متن کامل اظهارات طرف اول',
    statementB: 'متن کامل اظهارات طرف دوم',
    disclaimer: 'این گزارش حاصل تحلیل هوش مصنوعی بر پایه اطلاعات ارائه‌شده است؛ حکم دادگاه رسمی یا مشاوره حقوقی محسوب نمی‌شود.'
  } : {
    title: 'FINAL DISPUTE ASSESSMENT',
    case: 'CASE REFERENCE',
    date: 'ISSUED',
    outcome: 'ASSESSMENT RESULT',
    partyA: 'PARTY A',
    partyB: 'PARTY B',
    summary: 'EXECUTIVE SUMMARY',
    reasoning: 'REASONING & ASSESSMENT',
    settlement: 'PROPOSED RESOLUTION',
    claimsA: 'PARTY A — CLAIMS & POSITION',
    claimsB: 'PARTY B — CLAIMS & POSITION',
    strongestA: 'PARTY A — STRONGEST ARGUMENT',
    strongestB: 'PARTY B — STRONGEST ARGUMENT',
    weaknessA: 'PARTY A — MAIN WEAKNESS',
    weaknessB: 'PARTY B — MAIN WEAKNESS',
    scope: 'CLAIM SCOPE & PRECISION',
    causal: 'CAUSAL ANALYSIS',
    proportionality: 'PROPORTIONALITY OF OUTCOME',
    agreed: 'AGREED POINTS',
    disputed: 'DISPUTED ISSUES',
    contradictions: 'CONTRADICTIONS',
    evidenceA: 'PARTY A — EVIDENCE',
    evidenceB: 'PARTY B — EVIDENCE',
    unknowns: 'UNKNOWN / UNVERIFIED INFORMATION',
    responsibility: 'RESPONSIBILITY FACTORS',
    principle: 'GUIDING PRINCIPLE',
    confidence: 'CONFIDENCE',
    statementA: 'PARTY A — FULL STATEMENT',
    statementB: 'PARTY B — FULL STATEMENT',
    disclaimer: 'This AI-assisted report is based on the information provided. It is not a court judgment or formal legal advice.'
  };

  const now = new Date();
  const date = now.toLocaleDateString(info.locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const caseCode = `MJ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-5)}`;
  const scoreA = Math.max(0, Math.min(100, Math.round(Number(data.personA_score) || 0)));
  const scoreB = Math.max(0, Math.min(100, Math.round(Number(data.personB_score) || 0)));
  const verdict = hasText(data.verdict) ? data.verdict : (isFa ? 'ارزیابی تکمیل شد' : 'Assessment completed');
  const analysis = data.analysis || {};

  const sections = [
    textSection(t.statementA, data.personA_statement),
    textSection(t.statementB, data.personB_statement),
    textSection(t.summary, data.executive_summary || data.explanation),
    textSection(t.reasoning, data.reasoning),
    textSection(t.settlement, data.settlement),
    listSection(t.claimsA, analysis.claims_a),
    listSection(t.claimsB, analysis.claims_b),
    textSection(t.strongestA, analysis.strongest_argument_a),
    textSection(t.strongestB, analysis.strongest_argument_b),
    textSection(t.weaknessA, analysis.main_weakness_a),
    textSection(t.weaknessB, analysis.main_weakness_b),
    textSection(t.scope, analysis.scope_analysis),
    textSection(t.causal, analysis.causal_analysis),
    textSection(t.proportionality, analysis.proportionality_analysis),
    listSection(t.agreed, analysis.agreed_points),
    listSection(t.disputed, analysis.disputed_facts),
    listSection(t.contradictions, analysis.contradictions),
    listSection(t.evidenceA, analysis.evidence_a),
    listSection(t.evidenceB, analysis.evidence_b),
    listSection(t.unknowns, analysis.unknowns),
    listSection(t.responsibility, analysis.responsibility_factors),
    textSection(t.principle, data.governing_principle),
    textSection(t.confidence, data.confidence)
  ].filter(Boolean);

  const pageStyle = `
    width:794px;height:1123px;box-sizing:border-box;padding:54px 62px 48px;
    display:flex;flex-direction:column;gap:12px;overflow:hidden;
    color:#151515;background:transparent;
    font-family:${isFa ? "'Vazirmatn',Tahoma,sans-serif" : "Arial,Helvetica,sans-serif"};
  `;
  const makePage = (pageNumber) => {
    const page = document.createElement('main');
    page.dir = dir;
    page.style.cssText = pageStyle;
    page.innerHTML = `
      <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:5px 10px 12px;border-bottom:2px solid #171717">
        <div>
          <div style="font:800 10px Arial,sans-serif;letter-spacing:1.5px;color:#9a7829">MR JUDGE</div>
          <div style="font-size:18px;font-weight:900;margin-top:5px">${t.title}</div>
        </div>
        <div style="text-align:${isFa ? 'left' : 'right'};font:10px/1.8 Arial,sans-serif;color:#444">
          <div>${t.case}: <b>${formatDigits(caseCode, language)}</b></div>
          <div>${t.date}: <b>${escapeHtml(date)}</b></div>
          <div>${isFa ? 'صفحه' : 'PAGE'} ${formatDigits(pageNumber, language)}</div>
        </div>
      </header>
      ${pageNumber === 1 ? `
        <section style="padding:12px 14px;border:1px solid #171717;background:#fffdf5;display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div>
            <div style="font:700 9px Arial,sans-serif;color:#8d6d22;margin-bottom:5px">${t.outcome}</div>
            <div style="font-size:14px;font-weight:900;line-height:1.5">${escapeHtml(verdict)}</div>
          </div>
          <div style="font:700 11px/1.8 Arial,sans-serif;white-space:nowrap;text-align:${isFa ? 'left' : 'right'}">
            <div>${t.partyA}: ${formatDigits(scoreA, language)}٪</div>
            <div>${t.partyB}: ${formatDigits(scoreB, language)}٪</div>
          </div>
        </section>` : ''}
      <div class="report-sections" style="display:flex;flex-direction:column;gap:9px;flex:1;min-height:0"></div>
      <footer style="border-top:1.5px solid #171717;padding:8px 10px 0;font-size:8px;line-height:1.55;color:#555;text-align:justify">
        ${t.disclaimer}
        <div style="font:700 8px Arial,sans-serif;color:#92701e;margin-top:4px;letter-spacing:.5px">MR JUDGE · AI DISPUTE ANALYSIS</div>
      </footer>`;
    return page;
  };

  const makeCard = (section) => {
    const card = document.createElement('section');
    card.style.cssText = 'padding:9px 12px 10px;background:rgba(255,255,255,.72);border:1px solid rgba(212,212,212,.9);break-inside:avoid';
    card.innerHTML = `
      <div style="font:800 10px Arial,sans-serif;color:#171717;border-bottom:1px solid #b08d32;padding-bottom:5px;margin-bottom:7px">${section.title}</div>
      <div class="report-body" style="font-size:9.5px;line-height:1.65;text-align:justify;color:#222">${section.html}</div>`;
    const body = card.querySelector('.report-body');
    body.querySelectorAll('p').forEach((p) => { p.style.margin = '0'; p.style.whiteSpace = 'pre-wrap'; });
    body.querySelectorAll('ul').forEach((ul) => { ul.style.margin = '0'; ul.style.paddingInlineStart = isFa ? '18px' : '20px'; });
    body.querySelectorAll('li').forEach((li) => { li.style.marginBottom = '4px'; li.style.paddingInlineStart = '2px'; });
    return card;
  };

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-12000px;top:0;width:794px;z-index:-1;pointer-events:none';
  document.body.appendChild(container);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const pages = [makePage(1)];
    container.appendChild(pages[0]);
    for (const section of sections) {
      let page = pages[pages.length - 1];
      let stack = page.querySelector('.report-sections');
      const card = makeCard(section);
      stack.appendChild(card);
      if (stack.scrollHeight > stack.clientHeight + 2 && stack.children.length > 1) {
        stack.removeChild(card);
        page = makePage(pages.length + 1);
        pages.push(page);
        container.appendChild(page);
        page.querySelector('.report-sections').appendChild(card);
      }
    }

    const { default: html2canvas } = await import('html2canvas');
    const { PDFDocument } = await import('pdf-lib');
    const templateUrl = `${import.meta.env.BASE_URL}templates/report-template.pdf`;
    const templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok) throw new Error(`PDF template could not be loaded (${templateResponse.status}).`);

    const templateDoc = await PDFDocument.load(await templateResponse.arrayBuffer());
    const templatePages = templateDoc.getPages();
    if (!templatePages.length) throw new Error('The PDF template has no pages.');
    const outputDoc = await PDFDocument.create();
    const templatePage = templatePages[0];
    const { width, height } = templatePage.getSize();

    for (let index = 0; index < pages.length; index += 1) {
      const pageElement = pages[index];
      const canvas = await html2canvas(pageElement, {
        scale: 2, useCORS: true, backgroundColor: null,
        width: 794, height: 1123, windowWidth: 794, windowHeight: 1123, logging: false
      });
      const copied = await outputDoc.copyPages(templateDoc, [0]);
      const outputPage = copied[0];
      outputDoc.addPage(outputPage);
      const overlay = await outputDoc.embedPng(canvas.toDataURL('image/png'));
      outputPage.drawImage(overlay, { x: 0, y: 0, width, height });
    }

    const outputBytes = await outputDoc.save();
    const blob = new Blob([outputBytes], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `mr-judge-report-${info.code}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } finally {
    container.remove();
  }
}
