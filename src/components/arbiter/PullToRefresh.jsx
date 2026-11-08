import React, { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * PullToRefresh Component
 * Detects pull-down at scroll top and triggers a refresh callback.
 * Shows a spinner indicator while pulling / refreshing.
 */
export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const handleTouchStart = (e) => {
    if (window.scrollY <= 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!pulling.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 80));
    }
  };

  const handleTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance > 60) {
      setIsRefreshing(true);
      setPullDistance(60);
      try {
        await onRefresh?.();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ height: pullDistance }}
        >
          <Loader2
            className={`w-6 h-6 text-amber-500 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </div>
      )}
      {children}
    </div>
  );
}
