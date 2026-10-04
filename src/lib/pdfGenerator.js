const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const SEAL_URL = "https://media.db.com/images/public/698eb5584a1e1acb6b06d744/bf0fbf165_Bazaart_E05C165E-5151-4633-9A21-E708ABEA254A2.png";

// Convert Western digits to Persian digits
function toPersianDigits(str) {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, d => persianDigits[parseInt(d, 10)]);
}

function localizeNumber(value, language) {
  const num = Math.round(value || 0);
  return language === 'fa' ? toPersianDigits(num) : String(num);
}

// Escape HTML to prevent injection / broken layout
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br/>');
}

// Truncate text to a max character count with ellipsis
function truncate(text, maxLen) {
  if (!text) return '';
  const str = String(text);
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1).trimEnd() + '…';
}

/**
 * Generate a beautiful one-page PDF verdict report with the gold seal at the bottom.
 * Includes statements from both parties.
 * @param {Object} data - { personA_score, personB_score, verdict, explanation, personA_statement, personB_statement }
 * @param {string} language - 'en' | 'fa'
 */
export async function generateVerdictPdf(data, language = 'en') {
  const isFa = language === 'fa';
  const dir = isFa ? 'rtl' : 'ltr';
  const fontFamily = isFa
    ? "'Tahoma', 'Vazirmatn', 'Segoe UI', sans-serif"
    : "'Georgia', 'Times New Roman', serif";

  const labels = {
    en: {
      title: 'Dispute Analysis Report',
      verdict: 'Verdict',
      analysis: 'Analysis',
      personA: 'Person A',
      personB: 'Person B',
      statement: 'Statement',
      statementsSection: 'Statements of the Parties',
      certified: 'Certified by Mr Judge',
      date: 'Date',
      mrJudge: 'Mr Judge',
      score: 'Score'
    },
    fa: {
      title: 'گزارش تحلیل اختلاف',
      verdict: 'حکم',
      analysis: 'تحلیل',
      personA: 'بیانگر الف',
      personB: 'بیانگر ب',
      statement: 'بیانیه',
      statementsSection: 'بیانیههای طرفین منازعه',
      certified: 'تأیید شده توسط مستر جاج',
      date: 'تاریخ',
      mrJudge: 'مستر جاج',
      score: 'امتیاز'
    }
  };

  const t = labels[language] || labels.en;
  const dateStr = new Date().toLocaleDateString(isFa ? 'fa-IR' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // Localize scores
  const scoreA = localizeNumber(data.personA_score, language);
  const scoreB = localizeNumber(data.personB_score, language);
  const scoreLabel = t.score;

  // Truncate statements to keep one-page fit (generous limits; layout is compact)
  const MAX_STATEMENT_LEN = 600;
  const stmtA = escapeHtml(truncate(data.personA_statement, MAX_STATEMENT_LEN));
  const stmtB = escapeHtml(truncate(data.personB_statement, MAX_STATEMENT_LEN));
  const verdictText = escapeHtml(data.verdict);
  const explanationText = escapeHtml(truncate(data.explanation, 1200));

  const template = `
    <div dir="${dir}" style="width: 794px; height: 1123px; padding: 50px 50px; font-family: ${fontFamily}; background: #ffffff; display: flex; flex-direction: column; box-sizing: border-box; position: relative; overflow: hidden;">
      <!-- Decorative top border -->
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 7px; background: linear-gradient(90deg, #1e293b 0%, #d4af37 50%, #1e293b 100%);"></div>

      <!-- Ornamental corner accents -->
      <div style="position: absolute; top: 20px; ${isFa ? 'right' : 'left'}: 20px; width: 40px; height: 40px; border-top: 2px solid #d4af37; border-${isFa ? 'right' : 'left'}: 2px solid #d4af37; opacity: 0.5;"></div>
      <div style="position: absolute; top: 20px; ${isFa ? 'left' : 'right'}: 20px; width: 40px; height: 40px; border-top: 2px solid #d4af37; border-${isFa ? 'left' : 'right'}: 2px solid #d4af37; opacity: 0.5;"></div>

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 4px; padding-top: 8px;">
        <div style="font-size: 38px; font-weight: 700; color: #1e293b; letter-spacing: 3px;">${t.mrJudge}</div>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; letter-spacing: 4px; text-transform: uppercase;">◆ ◆ ◆</div>
        <div style="font-size: 16px; color: #475569; margin-top: 10px; letter-spacing: 1.5px; font-style: italic;">${t.title}</div>
        <div style="width: 100px; height: 3px; background: linear-gradient(90deg, transparent, #d4af37, transparent); margin: 14px auto 0; border-radius: 2px;"></div>
      </div>

      <!-- Date -->
      <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-bottom: 22px; letter-spacing: 0.5px;">
        ${t.date}: ${dateStr}
      </div>

      <!-- Verdict Box -->
      <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; ${isFa ? 'border-right' : 'border-left'}: 5px solid #d4af37; border-radius: 12px; padding: 20px 26px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(30,41,59,0.05);">
        <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px; letter-spacing: 3px; font-weight: 700;">${t.verdict}</div>
        <div style="font-size: 17px; font-weight: 500; color: #1e293b; line-height: 1.6;">${verdictText}</div>
      </div>

      <!-- Scores -->
      <div style="display: flex; gap: 18px; margin-bottom: 20px;">
        <div style="flex: 1; text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 16px; position: relative;">
          <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 2px; font-weight: 600; margin-bottom: 8px;">${t.personA}</div>
          <div style="font-size: 46px; font-weight: 700; color: #1e293b; line-height: 1;">${scoreA}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${scoreLabel}</div>
          <div style="width: 100%; height: 5px; background: #e2e8f0; border-radius: 3px; margin-top: 12px; overflow: hidden;">
            <div style="width: ${data.personA_score}%; height: 100%; background: linear-gradient(90deg, #d4af37, #e6be8a); border-radius: 3px;"></div>
          </div>
        </div>
        <div style="flex: 1; text-align: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 16px; position: relative;">
          <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 2px; font-weight: 600; margin-bottom: 8px;">${t.personB}</div>
          <div style="font-size: 46px; font-weight: 700; color: #1e293b; line-height: 1;">${scoreB}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${scoreLabel}</div>
          <div style="width: 100%; height: 5px; background: #e2e8f0; border-radius: 3px; margin-top: 12px; overflow: hidden;">
            <div style="width: ${data.personB_score}%; height: 100%; background: linear-gradient(90deg, #d4af37, #e6be8a); border-radius: 3px;"></div>
          </div>
        </div>
      </div>

      <!-- Statements Section -->
      <div style="margin-bottom: 18px;">
        <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px; letter-spacing: 3px; font-weight: 700; text-align: center;">${t.statementsSection}</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; ${isFa ? 'border-right' : 'border-left'}: 3px solid #1e293b;">
            <div style="font-size: 10px; font-weight: 700; color: #1e293b; margin-bottom: 6px; letter-spacing: 1px;">${t.personA} — ${t.statement}</div>
            <div style="font-size: 12.5px; line-height: 1.7; color: #475569; text-align: justify;">${stmtA}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; ${isFa ? 'border-right' : 'border-left'}: 3px solid #d4af37;">
            <div style="font-size: 10px; font-weight: 700; color: #1e293b; margin-bottom: 6px; letter-spacing: 1px;">${t.personB} — ${t.statement}</div>
            <div style="font-size: 12.5px; line-height: 1.7; color: #475569; text-align: justify;">${stmtB}</div>
          </div>
        </div>
      </div>

      <!-- Analysis -->
      <div style="margin-bottom: 14px;">
        <div style="font-size: 10px; text-transform: uppercase; color: #94a3b8; margin-bottom: 10px; letter-spacing: 3px; font-weight: 700;">${t.analysis}</div>
        <div style="font-size: 13px; line-height: 1.85; color: #334155; text-align: justify;">${explanationText}</div>
      </div>

      <!-- Spacer to push seal to bottom -->
      <div style="flex: 1; min-height: 5px;"></div>

      <!-- Seal at bottom -->
      <div style="text-align: center; padding-top: 16px; border-top: 1px solid #e2e8f0;">
        <img src="${SEAL_URL}" crossorigin="anonymous" style="width: 72px; height: 72px; object-fit: contain; display: block; margin: 0 auto;" />
        <div style="font-size: 10px; color: #94a3b8; margin-top: 10px; letter-spacing: 2px; font-weight: 500; text-transform: uppercase;">${t.certified}</div>
      </div>

      <!-- Ornamental bottom corner accents -->
      <div style="position: absolute; bottom: 20px; ${isFa ? 'right' : 'left'}: 20px; width: 40px; height: 40px; border-bottom: 2px solid #d4af37; border-${isFa ? 'right' : 'left'}: 2px solid #d4af37; opacity: 0.5;"></div>
      <div style="position: absolute; bottom: 20px; ${isFa ? 'left' : 'right'}: 20px; width: 40px; height: 40px; border-bottom: 2px solid #d4af37; border-${isFa ? 'left' : 'right'}: 2px solid #d4af37; opacity: 0.5;"></div>

      <!-- Decorative bottom border -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 7px; background: linear-gradient(90deg, #1e293b 0%, #d4af37 50%, #1e293b 100%);"></div>
    </div>
  `;

  // Create temporary off-screen container
  const container = document.createElement('div');
  container.style.cssText = 'position: fixed; left: -9999px; top: 0; background: white; z-index: -1;';
  container.innerHTML = template;
  document.body.appendChild(container);

  const templateEl = container.firstElementChild;

  // Wait for the seal image to load
  const images = templateEl.querySelectorAll('img');
  await Promise.all(Array.from(images).map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));

  // Small delay to ensure fonts are rendered
  await new Promise(r => setTimeout(r, 100));

  // Capture with html2canvas
  const canvas = await html2canvas(templateEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: 794,
    height: 1123,
    windowWidth: 794,
    windowHeight: 1123,
    logging: false
  });

  // Clean up
  document.body.removeChild(container);

  // Create PDF (A4: 210mm x 297mm) — always exactly one page
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = 210;
  const pdfHeight = 297;
  const imgData = canvas.toDataURL('image/png');
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= pdfHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  } else {
    // Scale down proportionally to fit exactly one page
    const ratio = pdfHeight / imgHeight;
    const scaledWidth = imgWidth * ratio;
    const x = (pdfWidth - scaledWidth) / 2;
    pdf.addImage(imgData, 'PNG', x, 0, scaledWidth, pdfHeight);
  }

  const fileName = isFa ? 'mr-judge-verdict-fa.pdf' : 'mr-judge-verdict.pdf';
  pdf.save(fileName);
}