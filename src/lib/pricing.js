import { api } from '@/lib/account';
import { getLanguage } from '@/locales';

/** Public settings from the server (which payment methods are on, prices). Cached for the session. */
let cached = null;
export function fetchPublicConfig() {
  if (!cached) {
    cached = api('config', { action: 'public' }, { key: '' }).catch((e) => { cached = null; throw e; });
  }
  return cached;
}

/** Price text, e.g. "$1.00" or "۲۵۰٬۰۰۰ تومان". */
export function priceText(kind, config, lang) {
  if (!config?.prices) return '';
  if (kind === 'toman') return `${new Intl.NumberFormat('fa-IR').format(config.prices.toman)} تومان`;
  return new Intl.NumberFormat(getLanguage(lang).locale, { style: 'currency', currency: 'USD' }).format(Number(config.prices.usd));
}

/** The price shown in big letters on the Credits page. Visitors in Iran / Persian readers see Toman when ZarinPal (or the Bazaar app) is available. */
export function headlinePrice(config, lang, { bazaar = false } = {}) {
  const toman = (lang === 'fa' || config?.country === 'IR') && (bazaar || config?.methods?.zarinpal);
  return priceText(toman ? 'toman' : 'usd', config, lang);
}
