import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Scale, Sparkles, History as HistoryIcon } from 'lucide-react';
import { createPageUrl } from "@/utils";
import { useLang } from '@/lib/i18n';

const tabs = [
  { key: 'tab.home', icon: Home, path: 'Home' },
  { key: 'tab.new', icon: Scale, path: 'NewDispute' },
  { key: 'tab.credits', icon: Sparkles, path: 'Credits' },
  { key: 'tab.history', icon: HistoryIcon, path: 'History' },
];

export default function BottomTabBar() {
  const location = useLocation();
  const { t } = useLang();
  const currentPath = location.pathname.replace(/^\//, '');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-md border-t border-border safe-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2">
        {tabs.map((tab) => {
          const isActive = currentPath === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={createPageUrl(tab.path)}
              className={`flex flex-col items-center gap-1 px-3 py-2 min-h-[44px] justify-center transition-colors select-none ${
                isActive ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{t(tab.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
