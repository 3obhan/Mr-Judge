import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Scale, User, Users, ArrowRight, Loader2 } from 'lucide-react';

/**
 * DisputeForm Component
 * Elegant form for entering dispute details from both parties
 * Supports English and Persian languages
 */
export default function DisputeForm({ onSubmit, isLoading, disabled = false }) {
  const [personA, setPersonA] = useState('');
  const [personB, setPersonB] = useState('');
  const [language, setLanguage] = useState('en');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (personA.trim() && personB.trim()) {
      onSubmit({ personA_statement: personA, personB_statement: personB, language });
    }
  };

  const labels = {
    en: {
      title: 'Present Your Case',
      subtitle: 'Enter both perspectives for fair analysis',
      personA: 'Person A\'s Statement',
      personB: 'Person B\'s Statement',
      placeholderA: 'Describe the situation from Person A\'s perspective...',
      placeholderB: 'Describe the situation from Person B\'s perspective...',
      submit: 'Analyze Dispute',
      language: 'Language'
    },
    fa: {
      title: 'پرونده خود را ارائه دهید',
      subtitle: 'هر دو دیدگاه را برای تحلیل منصفانه وارد کنید',
      personA: 'بیانیه شخص الف',
      personB: 'بیانیه شخص ب',
      placeholderA: 'وضعیت را از دیدگاه شخص الف شرح دهید...',
      placeholderB: 'وضعیت را از دیدگاه شخص ب شرح دهید...',
      submit: 'تحلیل اختلاف',
      language: 'زبان'
    }
  };

  const t = labels[language];
  const isRTL = language === 'fa';

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
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-6"
        >
          <Scale className="w-8 h-8 text-amber-500" />
        </motion.div>
        <h2 className="text-2xl md:text-3xl font-light text-slate-800 mb-2">
          {t.title}
        </h2>
        <p className="text-slate-500">{t.subtitle}</p>
      </div>

      {/* Language selector */}
      <div className="mb-8">
        <Label className="text-slate-600 mb-2 block">{t.language}</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-40 bg-white border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="fa">فارسی (Persian)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Person A Input */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Label className="flex items-center gap-2 text-slate-700 mb-3 text-base">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          {t.personA}
        </Label>
        <Textarea
          value={personA}
          onChange={(e) => setPersonA(e.target.value)}
          placeholder={t.placeholderA}
          className="min-h-[140px] bg-white border-slate-200 focus:border-amber-500 focus:ring-amber-500/20 resize-none text-slate-700 placeholder:text-slate-400"
          required
        />
      </motion.div>

      {/* Divider */}
      <div className="flex items-center justify-center my-6">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="px-4">
          <Users className="w-5 h-5 text-slate-300" />
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </div>

      {/* Person B Input */}
      <motion.div
        className="mb-10"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Label className="flex items-center gap-2 text-slate-700 mb-3 text-base">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100">
            <User className="w-4 h-4 text-purple-600" />
          </div>
          {t.personB}
        </Label>
        <Textarea
          value={personB}
          onChange={(e) => setPersonB(e.target.value)}
          placeholder={t.placeholderB}
          className="min-h-[140px] bg-white border-slate-200 focus:border-amber-500 focus:ring-amber-500/20 resize-none text-slate-700 placeholder:text-slate-400"
          required
        />
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
          className="w-full h-14 text-base font-medium tracking-wide bg-slate-800 hover:bg-slate-700 text-white transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              {t.submit}
              <ArrowRight className={`w-5 h-5 ${isRTL ? 'mr-2 rotate-180' : 'ml-2'} group-hover:translate-x-1 transition-transform`} />
            </>
          )}
        </Button>
      </motion.div>
    </motion.form>
  );
}