import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Scale, User, Users, ArrowRight, Loader2 } from 'lucide-react';
import VoiceButton from "./VoiceButton";
import { useLang } from '@/lib/i18n';
import { loadDraft, saveDraft } from '@/lib/draft';
import { MAX_STATEMENT_CHARS } from '@/lib/judge';

/**
 * DisputeForm Component
 * Elegant form for entering dispute details from both parties
 * Texts come from src/locales (any language)
 */
export default function DisputeForm({ onSubmit, isLoading, disabled = false }) {
  const [personA, setPersonA] = useState(() => loadDraft().personA);
  const [personB, setPersonB] = useState(() => loadDraft().personB);
  const { lang: language, n, t: tr, dir } = useLang();

  // Keep what the user typed/dictated safe on this device
  useEffect(() => {
    const id = setTimeout(() => saveDraft(personA, personB), 400);
    return () => clearTimeout(id);
  }, [personA, personB]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (personA.trim() && personB.trim()) {
      onSubmit({ personA_statement: personA, personB_statement: personB, language });
    }
  };

  const t = Object.fromEntries(
    ['title', 'subtitle', 'personA', 'personB', 'placeholderA', 'placeholderB', 'submit', 'voiceHint', 'analyzing'].map((k) => [k, tr(`form.${k}`)])
  );
  const isRTL = dir === 'rtl';

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="text-center mb-10">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary mb-6"
        >
          <Scale className="w-8 h-8 text-amber-500" />
        </motion.div>
        <h2 className="text-2xl md:text-3xl font-light text-foreground mb-2">
          {t.title}
        </h2>
        <p className="text-muted-foreground">{t.subtitle}</p>
      </div>

      {/* Person A Input */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Label className="flex items-center gap-2 text-foreground mb-3 text-base">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/40">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          {t.personA}
          <span className="ms-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{t.voiceHint}</span>
            <VoiceButton value={personA} onChange={setPersonA} language={language} />
          </span>
        </Label>
        <Textarea
          value={personA}
          onChange={(e) => setPersonA(e.target.value)}
          placeholder={t.placeholderA}
          maxLength={MAX_STATEMENT_CHARS}
          className="min-h-[140px] bg-card border-border focus:border-amber-500 focus:ring-amber-500/20 resize-none text-foreground placeholder:text-muted-foreground"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground text-end">
          {n(personA.length)} / {n(MAX_STATEMENT_CHARS)}
        </p>
      </motion.div>

      {/* Divider */}
      <div className="flex items-center justify-center my-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="px-4">
          <Users className="w-5 h-5 text-muted-foreground/50" />
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Person B Input */}
      <motion.div
        className="mb-10"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Label className="flex items-center gap-2 text-foreground mb-3 text-base">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/40">
            <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          {t.personB}
          <span className="ms-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{t.voiceHint}</span>
            <VoiceButton value={personB} onChange={setPersonB} language={language} />
          </span>
        </Label>
        <Textarea
          value={personB}
          onChange={(e) => setPersonB(e.target.value)}
          placeholder={t.placeholderB}
          maxLength={MAX_STATEMENT_CHARS}
          className="min-h-[140px] bg-card border-border focus:border-amber-500 focus:ring-amber-500/20 resize-none text-foreground placeholder:text-muted-foreground"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground text-end">
          {n(personB.length)} / {n(MAX_STATEMENT_CHARS)}
        </p>
      </motion.div>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Button
          type="submit"
          disabled={isLoading || !personA.trim() || !personB.trim() || disabled}
          className="w-full h-14 min-h-[44px] text-base font-medium tracking-wide bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 me-2 animate-spin" />
              {t.analyzing}
            </>
          ) : (
            <>
              {t.submit}
              <ArrowRight className={`w-5 h-5 ms-2 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform`} />
            </>
          )}
        </Button>
      </motion.div>
    </motion.form>
  );
}
