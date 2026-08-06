import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/arbiter/Logo';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';

/**
 * Layout Component
 * Provides consistent styling and a shared site header across pages.
 */
export default function Layout({ children, currentPageName }) {
  const isHome = currentPageName === 'Home';
  const isCredits = currentPageName === 'Credits';
  const isNewDispute = currentPageName === 'NewDispute';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
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
        
        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: var(--gray-100);
        }
        
        ::-webkit-scrollbar-thumb {
          background: var(--gray-300);
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: var(--gray-400);
        }
        
        /* Selection color */
        ::selection {
          background: rgba(212, 175, 55, 0.2);
          color: var(--navy);
        }
      `}</style>

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to={createPageUrl('Home')} className="flex items-center gap-3">
            <Logo size="small" animated={false} />
          </Link>

          <nav className="flex items-center gap-2">
            <Link to={createPageUrl('Home')}>
              <Button variant={isHome ? 'secondary' : 'ghost'} size="sm" className="text-slate-700">
                Home
              </Button>
            </Link>
            <Link to={createPageUrl('NewDispute')}>
              <Button variant={isNewDispute ? 'secondary' : 'ghost'} size="sm" className="text-slate-700">
                New Dispute
              </Button>
            </Link>
            <Link to={createPageUrl('Credits')}>
              <Button variant={isCredits ? 'secondary' : 'ghost'} size="sm" className="text-slate-700">
                Credits
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}