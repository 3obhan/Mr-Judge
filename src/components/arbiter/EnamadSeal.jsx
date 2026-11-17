import React, { useEffect } from 'react';
import { useLang } from '@/lib/i18n';
import { enamadHtml } from '@/lib/enamad';

/**
 * EnamadSeal: Enamad's trust seal, on the Persian pages only.
 * The /fa/ page already contains the seal in its static HTML (#enamad-static, see scripts/postbuild.mjs): then this
 * component only shows/hides it when the language changes. In any other case (the visitor switched to Persian) it draws the seal itself.
 */
export default function EnamadSeal() {
  const { lang } = useLang();
  const staticSeal = typeof document !== 'undefined' ? document.getElementById('enamad-static') : null;

  useEffect(() => {
    const el = document.getElementById('enamad-static');
    if (el) el.style.display = lang === 'fa' ? '' : 'none';
  }, [lang]);

  if (lang !== 'fa' || staticSeal) return null;
  return <div className="text-center pt-4 pb-28" dangerouslySetInnerHTML={{ __html: enamadHtml() }} />; // fixed text from src/lib/enamad.js, no user input
}
