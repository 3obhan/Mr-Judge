import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

/**
 * CreditsDisplay Component
 * Shows remaining dispute analysis credits
 */
export default function CreditsDisplay({ credits, compact = false }) {
  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
        <Sparkles className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-medium text-amber-900">
          {credits} {credits === 1 ? 'Credit' : 'Credits'}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-xl"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">Available Credits</p>
          <p className="text-4xl font-light text-white">{credits}</p>
        </div>
        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-amber-500" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-700">
        <p className="text-slate-400 text-xs">
          Each credit = 1 dispute analysis
        </p>
      </div>
    </motion.div>
  );
}