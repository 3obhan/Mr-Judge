import React from 'react';
import { motion } from 'framer-motion';
import { translate } from '@/locales';
import { toPersianDigits } from '@/lib/i18n';

/**
 * ScoreGauge Component
 * Elegant circular gauge showing party's score percentage
 */
export default function ScoreGauge({ score, label, delay = 0, language = 'en' }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const isFa = language === 'fa';
  const pointsLabel = translate(language, 'gauge.points');
  const displayScore = isFa ? toPersianDigits(Math.round(score)) : Math.round(score);

  // Color based on score
  const getScoreColor = (score) => {
    if (score >= 70) return '#22c55e'; // green
    if (score >= 50) return '#d4af37'; // gold
    if (score >= 30) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const color = getScoreColor(score);

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
    >
      <div className="relative w-36 h-36">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          {/* Animated progress circle */}
          <motion.circle
            cx="72"
            cy="72"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, delay: delay + 0.3, ease: 'easeOut' }}
          />
        </svg>

        {/* Score number in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-light text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: delay + 0.8 }}
          >
            {displayScore}
          </motion.span>
          <span className="text-xs text-muted-foreground tracking-widest">{pointsLabel}</span>
        </div>
      </div>

      {/* Label */}
      <motion.div
        className="mt-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: delay + 0.5 }}
      >
        <span className="text-sm font-medium tracking-wide text-muted-foreground">
          {label}
        </span>
      </motion.div>
    </motion.div>
  );
}
