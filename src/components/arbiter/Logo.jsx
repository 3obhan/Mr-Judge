import React from 'react';
import { motion } from 'framer-motion';

/**
 * Logo Component
 * Minimalist luxury-style logo for The Arbiter
 * Features balanced scales symbolizing fair judgment
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
      {/* Logo Icon - Abstract balanced scales */}
      <svg
        width={width}
        height={height}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        {/* Center pillar */}
        <motion.rect
          x="30"
          y="16"
          width="4"
          height="40"
          fill="#d4af37"
          initial={animated ? { scaleY: 0 } : {}}
          animate={animated ? { scaleY: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ transformOrigin: 'bottom' }}
        />
        
        {/* Base */}
        <motion.path
          d="M20 56 H44 L40 52 H24 L20 56Z"
          fill="#1e293b"
          initial={animated ? { opacity: 0 } : {}}
          animate={animated ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.4 }}
        />
        
        {/* Top beam */}
        <motion.rect
          x="8"
          y="14"
          width="48"
          height="3"
          rx="1.5"
          fill="#1e293b"
          initial={animated ? { scaleX: 0 } : {}}
          animate={animated ? { scaleX: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
        />
        
        {/* Left scale pan */}
        <motion.g
          initial={animated ? { y: -10, opacity: 0 } : {}}
          animate={animated ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <line x1="16" y1="17" x2="16" y2="28" stroke="#d4af37" strokeWidth="1.5" />
          <path d="M8 28 L16 24 L24 28 L22 34 H10 L8 28Z" fill="#1e293b" />
          <ellipse cx="16" cy="34" rx="7" ry="2" fill="#d4af37" fillOpacity="0.3" />
        </motion.g>
        
        {/* Right scale pan */}
        <motion.g
          initial={animated ? { y: -10, opacity: 0 } : {}}
          animate={animated ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <line x1="48" y1="17" x2="48" y2="28" stroke="#d4af37" strokeWidth="1.5" />
          <path d="M40 28 L48 24 L56 28 L54 34 H42 L40 28Z" fill="#1e293b" />
          <ellipse cx="48" cy="34" rx="7" ry="2" fill="#d4af37" fillOpacity="0.3" />
        </motion.g>
        
        {/* Crown detail at top */}
        <motion.circle
          cx="32"
          cy="10"
          r="4"
          fill="#d4af37"
          initial={animated ? { scale: 0 } : {}}
          animate={animated ? { scale: 1 } : {}}
          transition={{ duration: 0.3, delay: 0.7 }}
        />
      </svg>

      {/* Logo Text */}
      <div className="flex flex-col items-center">
        <span className={`${text} font-semibold tracking-wider text-amber-600`} style={{ color: '#d4af37' }}>
          Mr Judge
        </span>
      </div>
    </Wrapper>
  );
}