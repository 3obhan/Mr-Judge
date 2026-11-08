import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ScoreGauge from './ScoreGauge';
import { toast } from '@/components/ui/use-toast';
import { useLang, toPersianDigits } from '@/lib/i18n';
import { getLanguage, translate } from '@/locales';
import {
  Download,
  RotateCcw,
  Scale,
  CheckCircle2,
  AlertCircle,
  Equal,
  Loader2,
  Copy
} from 'lucide-react';

/**
 * VerdictDisplay Component
 * Animated display of the AI verdict with scores and explanation
 * Includes PDF download functionality (jspdf & html2canvas loaded on demand)
 */
export default function VerdictDisplay({ result, onReset, language = 'en' }) {
  // language = language the verdict was written in (also used for the PDF); uiLang = current app language
  const { lang: uiLang, t: tr, dir: uiDir } = useLang();
  const contentDir = getLanguage(language).dir;
  const fixDigits = (text) => (language === 'fa' ? toPersianDigits(text) : text);
  const contentRef = useRef(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const t = {
    verdict: tr('verdict.title'), explanation: tr('verdict.explanation'), personA: tr('verdict.personA'),
    personB: tr('verdict.personB'), newDispute: tr('verdict.newDispute'), download: tr('verdict.download'),
    copy: tr('verdict.copy'), copied: tr('verdict.copied'), pdfFailed: tr('verdict.pdfFailed'),
  };
  const isRTL = uiDir === 'rtl';

  // Determine verdict icon and color
  const getVerdictStyle = () => {
    const { personA_score, personB_score } = result;
    const diff = Math.abs(personA_score - personB_score);

    if (diff <= 10) {
      return {
        icon: Equal,
        color: 'text-amber-600 dark:text-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800'
      };
    }
    if (personA_score > personB_score) {
      return {
        icon: CheckCircle2,
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800'
      };
    }
    return {
      icon: CheckCircle2,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
      border: 'border-purple-200 dark:border-purple-800'
    };
  };

  const verdictStyle = getVerdictStyle();
  const VerdictIcon = verdictStyle.icon;

  // PDF Download handler — dynamically import pdfGenerator (which loads jspdf & html2canvas)
  const handleDownload = async () => {
    setGeneratingPdf(true);
    try {
      const { generateVerdictPdf } = await import('@/lib/pdfGenerator');
      await generateVerdictPdf(result, language);
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast({ title: t.pdfFailed, variant: 'destructive' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Plain-text summary for sharing in a chat
  const handleCopy = async () => {
    const text = [
      `${translate(language, 'verdict.word')}: ${fixDigits(result.verdict)}`,
      `${translate(language, 'verdict.personA')}: ${fixDigits(Math.round(result.personA_score))} | ${translate(language, 'verdict.personB')}: ${fixDigits(Math.round(result.personB_score))}`,
      '',
      fixDigits(result.explanation),
      '',
      '— Mr Judge',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t.copied });
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      dir={isRTL ? 'rtl' : 'ltr'}
      ref={contentRef}
    >
      {/* Verdict Header */}
      <motion.div
        className="text-center mb-10"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary mb-6 shadow-xl">
          <Scale className="w-10 h-10 text-amber-500" />
        </div>
        <h2 className="text-3xl md:text-4xl font-light text-foreground mb-2">
          {t.verdict}
        </h2>
      </motion.div>

      {/* Score Gauges */}
      <motion.div
        className="flex justify-center gap-12 md:gap-20 mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <ScoreGauge
          score={result.personA_score}
          label={t.personA}
          delay={0.5}
          language={uiLang}
        />
        <ScoreGauge
          score={result.personB_score}
          label={t.personB}
          delay={0.7}
          language={uiLang}
        />
      </motion.div>

      {/* Verdict Statement */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.9 }}
      >
        <Card className={`p-6 mb-6 ${verdictStyle.bg} ${verdictStyle.border} border-2 bg-card`}>
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-full ${verdictStyle.bg}`}>
              <VerdictIcon className={`w-6 h-6 ${verdictStyle.color}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-1 text-start" dir={contentDir}>
                {fixDigits(result.verdict)}
              </h3>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Explanation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.1 }}
      >
        <Card className="p-6 mb-8 bg-card border-border">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            {t.explanation}
          </h4>
          <p className="text-foreground leading-relaxed text-start" dir={contentDir}>
            {fixDigits(result.explanation)}
          </p>
        </Card>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        className="flex flex-col sm:flex-row gap-4 justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.3 }}
      >
        <Button
          onClick={onReset}
          variant="outline"
          className="h-12 min-h-[44px] px-6 border-border text-foreground hover:bg-muted"
        >
          <RotateCcw className="w-4 h-4 me-2" />
          {t.newDispute}
        </Button>
        <Button
          onClick={handleCopy}
          variant="outline"
          className="h-12 min-h-[44px] px-6 border-border text-foreground hover:bg-muted"
        >
          <Copy className="w-4 h-4 me-2" />
          {t.copy}
        </Button>
        <Button
          onClick={handleDownload}
          disabled={generatingPdf}
          className="h-12 min-h-[44px] px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {generatingPdf ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin me-2" />
              {isRTL ? 'در حال ساخت...' : 'Generating...'}
            </>
          ) : (
            <>
              <Download className="w-4 h-4 me-2" />
              {t.download}
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
