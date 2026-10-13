import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import ScoreGauge from './ScoreGauge';
import VerdictReport from './VerdictReport';
import { 
  Download, 
  RotateCcw, 
  Scale, 
  CheckCircle2,
  Equal,
  ChevronDown
} from 'lucide-react';

/**
 * VerdictDisplay Component
 * Animated display of the AI verdict with scores and explanation
 * "Download PDF" prints the hidden VerdictReport layout via the browser's
 * native print dialog (see handleDownload for why, and pdf-report.js).
 */
export default function VerdictDisplay({ result, personA_statement, personB_statement, onReset, language = 'en' }) {
  const contentRef = useRef(null);

  const labels = {
    en: {
      verdict: 'The Verdict',
      explanation: 'Analysis',
      personA: 'Person A',
      personB: 'Person B',
      newDispute: 'New Dispute',
      download: 'Download PDF',
      showReasoning: 'Why this result?'
    },
    fa: {
      verdict: 'حکم',
      explanation: 'تحلیل',
      personA: 'شخص الف',
      personB: 'شخص ب',
      newDispute: 'اختلاف جدید',
      download: 'دانلود PDF',
      showReasoning: 'چرا این نتیجه؟'
    }
  };

  const t = labels[language];
  const isRTL = language === 'fa';

  // Determine verdict icon and color
  const getVerdictStyle = () => {
    const { personA_score, personB_score } = result;
    const diff = Math.abs(personA_score - personB_score);
    
    if (diff <= 10) {
      return { 
        icon: Equal, 
        color: 'text-amber-600', 
        bg: 'bg-amber-50',
        border: 'border-amber-200'
      };
    }
    if (personA_score > personB_score) {
      return { 
        icon: CheckCircle2, 
        color: 'text-blue-600', 
        bg: 'bg-blue-50',
        border: 'border-blue-200'
      };
    }
    return { 
      icon: CheckCircle2, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50',
      border: 'border-purple-200'
    };
  };

  const verdictStyle = getVerdictStyle();
  const VerdictIcon = verdictStyle.icon;

  // "Download PDF" opens the browser's native print dialog (choose "Save as
  // PDF" as the destination) instead of generating a file directly. This is
  // deliberate: an earlier html2canvas+jsPDF version of this had persistent,
  // hard-to-fully-fix bugs with Persian/Arabic text rendering (see
  // pdf-report.js for the full explanation) - printing through the browser's
  // own renderer, the one already displaying this text correctly on screen,
  // sidesteps that whole bug class rather than patching it one property at a
  // time. print:hidden below hides this interactive view and shows the
  // formal VerdictReport layout in its place only while printing.
  const handleDownload = () => {
    window.print();
  };

  return (
    <>
      {/* Hidden on screen, shown only when printing (see index.css @page and
          handleDownload above) - this is what actually gets saved as the PDF. */}
      <div className="hidden print:block">
        <VerdictReport
          result={result}
          personA_statement={personA_statement}
          personB_statement={personB_statement}
          language={language}
        />
      </div>

      <motion.div
        className="w-full max-w-2xl mx-auto print:hidden"
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
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6 shadow-xl">
          <Scale className="w-10 h-10 text-amber-500" />
        </div>
        <h2 className="text-3xl md:text-4xl font-light text-slate-800 mb-2">
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
          language={language}
        />
        <ScoreGauge 
          score={result.personB_score} 
          label={t.personB}
          delay={0.7}
          language={language}
        />
      </motion.div>

      {/* Verdict Statement */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.9 }}
      >
        <Card className={`p-6 mb-6 ${verdictStyle.bg} ${verdictStyle.border} border-2`}>
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-full ${verdictStyle.bg}`}>
              <VerdictIcon className={`w-6 h-6 ${verdictStyle.color}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 mb-1">
                {result.verdict}
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
        <Card className="p-6 mb-8 bg-white border-slate-200">
          <h4 className={`text-sm font-medium text-slate-500 uppercase mb-4 ${isRTL ? '' : 'tracking-wider'}`}>
            {t.explanation}
          </h4>
          <p className="text-slate-700 leading-relaxed">
            {result.explanation}
          </p>

          {result.reasoning && (
            <Collapsible className="mt-4 pt-4 border-t border-slate-100">
              <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-data-[state=open]:rotate-180" />
                {t.showReasoning}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-sm text-slate-500 leading-relaxed mt-3 whitespace-pre-wrap">
                  {result.reasoning}
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}
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
          className="h-12 px-6 border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t.newDispute}
        </Button>
        <Button
          onClick={handleDownload}
          className="h-12 px-6 bg-slate-800 hover:bg-slate-700 text-white"
        >
          <Download className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t.download}
        </Button>
      </motion.div>
      </motion.div>
    </>
  );
}