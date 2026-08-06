import React from 'react';
import { motion } from 'framer-motion';

/**
 * Logo Component
 * Displays the custom Mr Judge brand mark with the new icon across the app.
 */
export default function Logo({ size = 'default', animated = true }) {
  const sizes = {
    small: { width: 40, height: 40, text: 'text-lg' },
    default: { width: 64, height: 64, text: 'text-2xl' },
    large: { width: 96, height: 96, text: 'text-4xl' }
  };

  const { width, height, text } = sizes[size] || sizes.default;

  const Wrapper = animated ? motion.div : 'div';
  const wrapperProps = animated ? {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.6, ease: 'easeOut' }
  } : {};

  return (
    <Wrapper {...wrapperProps} className="flex flex-col items-center gap-3">
      <img
        src="/logo.svg"
        alt="Mr Judge logo"
        width={width}
        height={height}
        className="drop-shadow-lg rounded-2xl"
      />

      <div className="flex flex-col items-center">
        <span className={`${text} font-semibold tracking-wider text-slate-800`}>
          Mr Judge
        </span>
      </div>
    </Wrapper>
  );
}