import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useLang } from '@/lib/i18n';

/**
 * CreditsDisplay Component
 * Shows remaining dispute analysis credits
 */
export default function CreditsDisplay({ credits, compact = false }) {
  const { t, n } = useLang();
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-full">
        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-500" />
        <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
          {n(credits)} {credits === 1 ? t('credits.one') : t('credits.many')}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      className="bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 rounded-2xl p-6 shadow-xl"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{t('credits.available')}</p>
          <p className="text-4xl font-light text-white">{n(credits)}</p>
        </div>
        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-amber-500" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-700 dark:border-slate-600">
        <p className="text-slate-400 text-xs">
          {t('credits.each')}
        </p>
      </div>
    </motion.div>
  );
}
