import React from 'react';
import BottomTabBar from '@/components/arbiter/BottomTabBar';
import LanguageSwitcher from '@/components/arbiter/LanguageSwitcher';
import { useLang } from '@/lib/i18n';

/**
 * Layout Component
 * Minimal wrapper that provides consistent styling across pages.
 * Renders the BottomTabBar on mobile and adds bottom padding to prevent overlap.
 */
export default function Layout({ children }) {
  const { dir } = useLang();

  return (
    <div className="min-h-screen bg-background pb-20" dir={dir}>
      <style>{`
        :root {
          --navy: #1e293b;
          --gold: #d4af37;
          --white: #ffffff;
          --gray-50: #f8fafc;
          --gray-100: #f1f5f9;
          --gray-200: #e2e8f0;
          --gray-500: #64748b;
          --gray-700: #334155;
          --gray-800: #1e293b;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        html[lang='fa'] body,
        html[lang='ar'] body {
          font-family: 'Vazirmatn', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, sans-serif;
        }

        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }

        ::-webkit-scrollbar-track {
          background: hsl(var(--muted));
        }

        ::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.4);
          border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.6);
        }

        /* Selection color */
        ::selection {
          background: rgba(212, 175, 55, 0.2);
          color: hsl(var(--foreground));
        }
      `}</style>

      <LanguageSwitcher />
      {children}
      <BottomTabBar />
    </div>
  );
}
