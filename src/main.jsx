import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { captureReturnFromPayment } from '@/lib/paymentReturn'
import { detectLanguage } from '@/locales'
import { splitLangPath, withLang } from '@/lib/langPath'
import '@/index.css'

// 1) Every language has its own address (/de/…). A visit without one (or an old "#/…" link) goes to the visitor's language.
if (!splitLangPath(window.location.pathname).lang) {
  let saved = null;
  try { saved = localStorage.getItem('judge_lang'); } catch { /* ignore */ }
  const code = detectLanguage(saved, [...(navigator.languages || []), navigator.language]);
  const { pathname, search, hash } = window.location;
  const oldHashRoute = /^#\/(\w+)/.exec(hash); // old links like /#/Credits
  const rest = oldHashRoute ? `/${oldHashRoute[1]}` : pathname;
  window.history.replaceState(null, '', `${withLang(code, rest)}${search}${oldHashRoute ? '' : hash}`);
}
// 2) Coming back from a payment page: remember it and open the Credits page of the same language
captureReturnFromPayment()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
