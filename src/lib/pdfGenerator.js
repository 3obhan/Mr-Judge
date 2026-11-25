import { getLanguage } from '@/locales';

const digits = (value, lang) => lang === 'fa'
  ? String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
  : String(value);

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  .replace(/\r?\n/g, '<br>');

const excerpt = (value, max) => {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return escapeHtml(text.length > max ? `${text.slice(0, max - 1)}…` : text || '—');
};

/**
 * Places a transparent, structured verdict layout over the user's PDF stationery.
 * The supplied PDF remains the actual document background; all dynamic text is
 * rendered by the browser so Persian shaping and RTL text remain correct.
 */
export async function generateVerdictPdf(data, language = 'en') {
  const info = getLanguage(language);
  const isFa = language === 'fa';
  const dir = info.dir || (isFa ? 'rtl' : 'ltr');
  const labels = isFa ? {
    brand: 'MR JUDGE',
    title: 'گزارش نهایی ارزیابی اختلاف',
    file: 'شناسه پرونده',
    issued: 'تاریخ صدور',
    result: 'نتیجه ارزیابی',
    partyA: 'طرف اول',
    partyB: 'طرف دوم',
    score: 'امتیاز ارزیابی',
    claims: 'اظهارات طرفین',
    summary: 'بخش اول ـ خلاصه نتیجه',
    reasoning: 'بخش دوم ـ استدلال و ارزیابی',
    settlement: 'بخش سوم ـ پیشنهاد حل اختلاف',
    principle: 'اصل راهنما',
    confidence: 'میزان اطمینان',
    disclaimer: 'این گزارش حاصل تحلیل هوش مصنوعی بر پایه اطلاعات ارائه‌شده است و حکم دادگاه رسمی یا مشاوره حقوقی محسوب نمی‌شود.'
  } : {
    brand: 'MR JUDGE',
    title: 'FINAL DISPUTE ASSESSMENT',
    file: 'CASE REFERENCE',
    issued: 'ISSUED',
    result: 'ASSESSMENT RESULT',
    partyA: 'PARTY A',
    partyB: 'PARTY B',
    score: 'ASSESSMENT SCORE',
    claims: 'PARTIES’ STATEMENTS',
    summary: 'SECTION I — EXECUTIVE SUMMARY',
    reasoning: 'SECTION II — REASONING & ASSESSMENT',
    settlement: 'SECTION III — PROPOSED RESOLUTION',
    principle: 'GUIDING PRINCIPLE',
    confidence: 'CONFIDENCE',
    disclaimer: 'This report is an AI-assisted assessment based on the information provided. It is not a court judgment or formal legal advice.'
  };

  const now = new Date();
  const date = now.toLocaleDateString(info.locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const caseCode = `MJ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-5)}`;
  const scoreA = Math.max(0, Math.min(100, Math.round(Number(data.personA_score) || 0)));
  const scoreB = Math.max(0, Math.min(100, Math.round(Number(data.personB_score) || 0)));
  const prevailing = scoreA - scoreB > 10
    ? labels.partyA
    : scoreB - scoreA > 10
      ? labels.partyB
      : (isFa ? 'حقانیت نزدیک به هم' : 'Balanced assessment');

  const html = `
    <main dir="${dir}" style="
      width:794px;height:1123px;padding:72px 62px 58px;box-sizing:border-box;
      display:flex;flex-direction:column;gap:11px;overflow:hidden;
      color:#151515;background:transparent;
      font-family:${isFa ? "'Vazirmatn',Tahoma,sans-serif" : "Arial,Helvetica,sans-serif"};
    ">
      <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:8px 12px 12px;border-bottom:2px solid #171717;background:rgba(255,255,255,.94)">
        <div>
          <div style="font:800 10px Arial,sans-serif;letter-spacing:1.5px;color:#9a7829">${labels.brand}</div>
          <div style="font-size:19px;font-weight:900;margin-top:5px">${labels.title}</div>
        </div>
        <div style="text-align:${isFa ? 'left' : 'right'};font:10px/1.8 Arial,sans-serif;color:#444;white-space:nowrap">
          <div>${labels.file}: <b style="color:#111">${digits(caseCode, language)}</b></div>
          <div>${labels.issued}: <b style="color:#111">${escapeHtml(date)}</b></div>
        </div>
      </header>

      <section style="padding:11px 14px;border:1px solid #171717;background:rgba(255,253,245,.96);display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <div style="font:700 9px Arial,sans-serif;color:#8d6d22;margin-bottom:4px">${labels.result}</div>
          <div style="font-size:15px;font-weight:900">${excerpt(data.verdict, 110)}</div>
          <div style="font-size:10px;color:#555;margin-top:4px">${isFa ? 'طرف دارای امتیاز بالاتر:' : 'Higher assessment score:'} <b style="color:#111">${escapeHtml(prevailing)}</b></div>
        </div>
        <div style="display:flex;gap:12px;font:700 12px Arial,sans-serif;white-space:nowrap">
          <span>${labels.partyA}: <b>${digits(scoreA, language)}٪</b></span>
          <span style="color:#b08d32">|</span>
          <span>${labels.partyB}: <b>${digits(scoreB, language)}٪</b></span>
        </div>
      </section>

      <section style="background:rgba(255,255,255,.95);border:1px solid #d4d4d4;padding:9px 11px">
        <div style="font:800 10px Arial,sans-serif;color:#92701e;margin-bottom:7px">${labels.claims}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;border:1px solid #ddd;background:rgba(250,250,250,.94)">
          <div style="padding:8px 10px;border-${isFa ? 'left' : 'right'}:1px solid #ddd">
            <b style="font-size:10px">${labels.partyA}</b>
            <p style="font-size:9.2px;line-height:1.55;margin:5px 0 0;text-align:justify">${excerpt(data.personA_statement, 230)}</p>
          </div>
          <div style="padding:8px 10px">
            <b style="font-size:10px">${labels.partyB}</b>
            <p style="font-size:9.2px;line-height:1.55;margin:5px 0 0;text-align:justify">${excerpt(data.personB_statement, 230)}</p>
          </div>
        </div>
      </section>

      <section style="padding:9px 12px 10px;background:rgba(255,255,255,.95);border:1px solid #d4d4d4">
        <div style="font:800 10px Arial,sans-serif;color:#171717;border-bottom:1px solid #b08d32;padding-bottom:5px;margin-bottom:6px">${labels.summary}</div>
        <p style="font-size:10px;line-height:1.65;text-align:justify;margin:0">${excerpt(data.executive_summary || data.explanation, 420)}</p>
      </section>

      <section style="padding:9px 12px 10px;background:rgba(255,255,255,.95);border:1px solid #d4d4d4">
        <div style="font:800 10px Arial,sans-serif;color:#171717;border-bottom:1px solid #b08d32;padding-bottom:5px;margin-bottom:6px">${labels.reasoning}</div>
        <p style="font-size:9.8px;line-height:1.65;text-align:justify;margin:0">${excerpt(data.reasoning || data.explanation, 520)}</p>
      </section>

      <section style="padding:9px 12px 10px;background:rgba(255,255,255,.95);border:1px solid #d4d4d4">
        <div style="font:800 10px Arial,sans-serif;color:#171717;border-bottom:1px solid #b08d32;padding-bottom:5px;margin-bottom:6px">${labels.settlement}</div>
        <p style="font-size:9.8px;line-height:1.6;text-align:justify;margin:0">${excerpt(data.settlement, 300)}</p>
      </section>

      <section style="padding:8px 11px;border:1px solid #d4d4d4;background:rgba(250,250,250,.96);font-size:9px;line-height:1.55">
        <b>${labels.principle}:</b> ${excerpt(data.governing_principle, 190)}
        <span style="margin-inline-start:12px"><b>${labels.confidence}:</b> ${escapeHtml(data.confidence || '—')}</span>
      </section>

      <footer style="margin-top:auto;padding:9px 12px 0;border-top:2px solid #171717;background:rgba(255,255,255,.94);font-size:8px;line-height:1.55;color:#555;text-align:justify">
        ${labels.disclaimer}
        <div style="font:700 8px Arial,sans-serif;color:#92701e;margin-top:4px;letter-spacing:.5px">MR JUDGE · AI DISPUTE ANALYSIS</div>
      </footer>
    </main>`;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:transparent;z-index:-1;pointer-events:none';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const { default: html2canvas } = await import('html2canvas');
    const pageElement = container.firstElementChild;
    const canvas = await html2canvas(pageElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      width: 794,
      height: 1123,
      windowWidth: 794,
      windowHeight: 1123,
      logging: false
    });

    const templateUrl = `${import.meta.env.BASE_URL}templates/report-template.pdf`;
    const templateResponse = await fetch(templateUrl);
    if (!templateResponse.ok) {
      throw new Error(`PDF template could not be loaded (${templateResponse.status}).`);
    }

    const { PDFDocument } = await import('pdf-lib');
    const templateBytes = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    if (!pages.length) throw new Error('The PDF template has no pages.');

    const page = pages[0];
    const { width, height } = page.getSize();
    const overlay = await pdfDoc.embedPng(canvas.toDataURL('image/png'));
    page.drawImage(overlay, { x: 0, y: 0, width, height });

    const outputBytes = await pdfDoc.save();
    const blob = new Blob([outputBytes], { type: 'application/pdf' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `mr-judge-report-${info.code}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } finally {
    container.remove();
  }
}
