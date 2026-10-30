// Stands in for src/lib/i18n.jsx (needs React) in tests: only the digit helper is used by the judge.
export const toPersianDigits = (s) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
