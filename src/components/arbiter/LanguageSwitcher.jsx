import React from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useLang } from '@/lib/i18n';

/**
 * LanguageSwitcher: a small pill in the top corner of every page (top-right, top-left in right-to-left languages).
 * It opens a menu with every language in its own name.
 */
export default function LanguageSwitcher() {
  const { lang, setLang, languages, t, dir } = useLang();
  const current = languages.find((l) => l.code === lang) || languages[0];
  return (
    <div className="safe-top">
      <div className="max-w-4xl mx-auto px-4 pt-3 flex justify-end">
        <DropdownMenu dir={dir}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('lang.label')}
              className="inline-flex items-center gap-2 h-10 px-3.5 rounded-full border border-border bg-card/80 backdrop-blur text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Globe className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <span lang={current.code}>{current.name}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 max-h-[70vh] overflow-y-auto">
            {languages.map((l) => (
              <DropdownMenuItem
                key={l.code}
                onSelect={() => setLang(l.code)}
                lang={l.code}
                dir={l.dir}
                className="flex items-center justify-between gap-3 min-h-[40px] cursor-pointer"
              >
                <span className="text-sm">{l.name}</span>
                {l.code === lang && <Check className="w-4 h-4 text-primary" aria-hidden="true" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
