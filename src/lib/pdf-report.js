// Converts Western digits (0-9) to Persian/Eastern-Arabic digits (۰-۹).
// Only applied for Persian-language reports; English reports keep Western
// digits. This only affects digit glyphs, not the underlying (Gregorian)
// calendar - switching to the Jalali calendar would be a separate feature.
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toLocaleDigits(value, language) {
  const str = String(value);
  if (language !== 'fa') return str;
  return str.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

// Unambiguous YYYY/MM/DD so it reads the same way regardless of language,
// with digits localized per the function above.
export function formatReportDate(date, language) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return toLocaleDigits(`${y}/${m}/${d}`, language);
}

// Same as above, plus the time (HH:MM, 24-hour) - used on the report footer
// stamp so it reads as a specific moment of issue, not just a day.
export function formatReportDateTime(date, language) {
  const dateStr = formatReportDate(date, language);
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const timeStr = toLocaleDigits(`${h}:${min}`, language);
  return `${dateStr} - ${timeStr}`;
}

// Caps a statement's length so the printed report reliably stays on one
// page (the person asked for this explicitly) - everything else on the
// page (scores, verdict, explanation) is already short and prompt-bounded,
// but the statements are free-form user text with no length limit of their
// own, so they're the one part that needs an explicit cap here.
export function truncateForOnePage(text, language, maxLength = 420) {
  const str = String(text || '');
  if (str.length <= maxLength) return str;

  const cut = str.slice(0, maxLength).replace(/\s+\S*$/, ''); // don't cut mid-word
  const note = language === 'fa' ? ' … (متن کامل در برنامه موجود است)' : ' … (full text available in the app)';
  return cut + note;
}

// NOTE: PDF generation itself now happens via the browser's native print
// dialog (window.print(), triggered from VerdictDisplay), not html2canvas +
// jsPDF. html2canvas has long-standing, unresolved upstream bugs rendering
// Persian/Arabic script correctly - letter-spacing, text-align, and several
// other unrelated CSS properties each independently break letter joining in
// different ways (see e.g. github.com/niklasvh/html2canvas/issues/686, open
// for years with no clean fix). The browser's own renderer - the one already
// displaying this text correctly on screen - doesn't have that problem, so
// printing through it sidesteps the whole bug class instead of chasing each
// new triggering property one at a time.
