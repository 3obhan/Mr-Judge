import { getLanguage } from '@/locales';

const SEAL_URL = `${import.meta.env.BASE_URL}seal.png`;
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

/** Render a single-page A4 decree inspired by Dadgar's formal black-and-gold layout. */
export async function generateVerdictPdf(data, language = 'en') {
  const info = getLanguage(language);
  const isFa = language === 'fa';
  const dir = info.dir || (isFa ? 'rtl' : 'ltr');
  const labels = isFa ? {
    tribunal: 'دیوان داوری هوشمند', title: 'دادنامه نهایی اختلاف',
    file: 'شناسه پرونده', issued: 'تاریخ صدور', page: 'نسخه رسمی · برگ ۱ از ۱',
    result: 'نتیجه داوری', a: 'طرف اول', b: 'طرف دوم', score: 'امتیاز حقانیت',
    claims: 'خلاصه اظهارات طرفین', summary: 'ماده ۱ ـ خلاصه رأی',
    reasoning: 'ماده ۲ ـ مبانی استدلال و ارزیابی ادله',
    settlement: 'ماده ۳ ـ راهکار پیشنهادی حل اختلاف',
    principle: 'قاعده حاکم', confidence: 'میزان اطمینان تحلیل',
    seal: 'ممهور به نشان آقای قاضی',
    disclaimer: 'این سند حاصل تحلیل هوش مصنوعی بر پایه اطلاعات ارائه‌شده از سوی طرفین است؛ حکم دادگاه رسمی یا مشاوره حقوقی محسوب نمی‌شود.'
  } : {
    tribunal: 'RATIONAL ARBITRATION TRIBUNAL', title: 'FINAL DISPUTE DECREE',
    file: 'CASE REFERENCE', issued: 'ISSUED', page: 'OFFICIAL COPY · PAGE 1 OF 1',
    result: 'FINAL FINDING', a: 'PARTY A', b: 'PARTY B', score: 'JUSTIFICATION SCORE',
    claims: 'PARTIES’ STATEMENTS', summary: 'ARTICLE I — EXECUTIVE RULING',
    reasoning: 'ARTICLE II — REASONING & EVIDENCE',
    settlement: 'ARTICLE III — PROPOSED SETTLEMENT',
    principle: 'GOVERNING PRINCIPLE', confidence: 'ASSESSMENT CONFIDENCE',
    seal: 'MR JUDGE · OFFICIAL SEAL',
    disclaimer: 'This document is an AI-assisted assessment based on information supplied by the parties. It is not a court judgment or formal legal advice.'
  };
  const now = new Date();
  const date = now.toLocaleDateString(info.locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const caseCode = `MJ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-5)}`;
  const scoreA = Math.max(0, Math.min(100, Math.round(Number(data.personA_score) || 0)));
  const scoreB = Math.max(0, Math.min(100, Math.round(Number(data.personB_score) || 0)));
  const winner = scoreA - scoreB > 10 ? labels.a : scoreB - scoreA > 10 ? labels.b : (isFa ? 'حقانیت نزدیک به هم' : 'Shared / balanced merit');
  const template = `
  <main dir="${dir}" style="width:794px;height:1123px;padding:30px;background:#fff;color:#111;font-family:${isFa ? "'Vazirmatn',Tahoma,sans-serif" : "Georgia,'Times New Roman',serif"};box-sizing:border-box;display:flex;flex-direction:column;position:relative;overflow:hidden">
    <div style="position:absolute;inset:0;border:2px solid #171717;margin:12px;pointer-events:none"></div>
    <div style="position:absolute;inset:5px;border:1px solid #b08d32;margin:12px;pointer-events:none"></div>
    <header style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #171717;padding:16px 18px 12px;gap:16px">
      <div style="display:flex;align-items:center;gap:12px">
        <img src="${SEAL_URL}" style="width:58px;height:58px;object-fit:contain" />
        <div><div style="font:800 11px Arial;color:#947321;letter-spacing:1px">${labels.tribunal}</div><div style="font-weight:900;font-size:19px;margin-top:5px">MR JUDGE</div></div>
      </div>
      <div style="text-align:${isFa ? 'left' : 'right'};font:11px/1.8 Arial;color:#444">
        <div>${labels.file}: <b style="color:#111">${digits(caseCode, language)}</b></div>
        <div>${labels.issued}: <b style="color:#111">${escapeHtml(date)}</b></div>
        <div style="color:#947321;font-weight:bold">${labels.page}</div>
      </div>
    </header>
    <section style="text-align:center;padding:13px 0 11px;border-bottom:1px solid #ccc">
      <div style="font:700 10px Arial;color:#92701e;letter-spacing:2px">${labels.result}</div>
      <h1 style="font-size:22px;margin:6px 0 0;font-weight:900">${excerpt(data.verdict, 100)}</h1>
    </section>
    <section style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid #171717;background:#fffdf4;margin-top:12px">
      <div><div style="font:700 10px Arial;color:#666">${labels.result}</div><div style="font-weight:900;font-size:15px;margin-top:3px">${escapeHtml(winner)}</div></div>
      <div style="display:flex;gap:16px;font:700 13px Arial;white-space:nowrap">
        <span>${labels.a}: <b>${digits(scoreA, language)}%</b></span>
        <span style="color:#b08d32">|</span>
        <span>${labels.b}: <b>${digits(scoreB, language)}%</b></span>
      </div>
    </section>
    <section style="margin-top:12px">
      <div style="font:800 10px Arial;color:#92701e;margin-bottom:6px">${labels.claims}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;border:1px solid #ccc;background:#fafafa">
        <div style="padding:9px 11px;border-${isFa ? 'left' : 'right'}:1px solid #ccc">
          <b style="font-size:11px">${labels.a}</b><p style="font-size:10.5px;line-height:1.55;margin:5px 0 0;text-align:justify">${excerpt(data.personA_statement, 210)}</p>
        </div>
        <div style="padding:9px 11px"><b style="font-size:11px">${labels.b}</b><p style="font-size:10.5px;line-height:1.55;margin:5px 0 0;text-align:justify">${excerpt(data.personB_statement, 210)}</p></div>
      </div>
    </section>
    <section style="margin-top:12px">
      <div style="font:800 11px Arial;color:#111;border-bottom:1px solid #b08d32;padding-bottom:4px">${labels.summary}</div>
      <p style="font-size:11.5px;line-height:1.65;text-align:justify;margin:6px 0 0">${excerpt(data.executive_summary || data.explanation, 360)}</p>
    </section>
    <section style="margin-top:10px">
      <div style="font:800 11px Arial;color:#111;border-bottom:1px solid #b08d32;padding-bottom:4px">${labels.reasoning}</div>
      <p style="font-size:11px;line-height:1.65;text-align:justify;margin:6px 0 0">${excerpt(data.reasoning || data.explanation, 500)}</p>
    </section>
    <section style="margin-top:10px">
      <div style="font:800 11px Arial;color:#111;border-bottom:1px solid #b08d32;padding-bottom:4px">${labels.settlement}</div>
      <p style="font-size:11px;line-height:1.6;text-align:justify;margin:6px 0 0">${excerpt(data.settlement, 250)}</p>
    </section>
    <div style="margin-top:10px;padding:7px 10px;border:1px solid #ccc;background:#fafafa;font-size:10px;line-height:1.5">
      <b>${labels.principle}:</b> ${excerpt(data.governing_principle, 180)}
      <span style="margin-inline-start:12px"><b>${labels.confidence}:</b> ${escapeHtml(data.confidence || 'medium')}</span>
    </div>
    <footer style="margin-top:auto;border-top:2px solid #171717;padding:10px 12px 8px;display:flex;align-items:center;justify-content:space-between;gap:16px">
      <div style="font-size:8.5px;line-height:1.55;color:#555;max-width:78%;text-align:justify">${labels.disclaimer}<br><b style="color:#111">MR JUDGE · AI DISPUTE ANALYSIS</b></div>
      <div style="text-align:center"><img src="${SEAL_URL}" style="width:58px;height:58px;object-fit:contain"/><div style="font:700 8px Arial;color:#92701e">${labels.seal}</div></div>
    </footer>
  </main>`;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1';
  container.innerHTML = template;
  document.body.appendChild(container);
  try {
    const images = [...container.querySelectorAll('img')];
    await Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })));
    if (document.fonts?.ready) await document.fonts.ready;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(container.firstElementChild, { scale: 2, useCORS: true, backgroundColor: '#fff', width: 794, height: 1123, windowWidth: 794, windowHeight: 1123, logging: false });
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    pdf.save(`mr-judge-decree-${info.code}.pdf`);
  } finally {
    container.remove();
  }
}
