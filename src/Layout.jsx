import React from 'react';

/**
 * Layout Component
 * Minimal wrapper that provides consistent styling across pages
 */
export default function Layout({ children }) {
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
      
      {children}
    </div>
  );
}