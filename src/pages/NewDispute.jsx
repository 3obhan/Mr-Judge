import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { appClient } from '@/api/appClient';
import { createPageUrl } from "@/utils";
import DisputeForm from "@/components/arbiter/DisputeForm";
import Logo from "@/components/arbiter/Logo";
import { ArrowLeft, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { buildAnalysisPrompt, normalizeAnalysisResult } from '@/lib/dispute-analysis';
import { useLanguage } from '@/lib/LanguageContext';

const COPY = {
  en: {
    back: 'Back',
    analyzing: 'Analyzing Dispute',
    evaluating: 'Judge is evaluating both perspectives...',
    errorTitle: 'Analysis failed',
    errorBody: 'Could not reach the AI judge. Please try again.',
    technicalDetails: 'Technical details'
  },
  fa: {
    back: 'بازگشت',
    analyzing: 'در حال بررسی اختلاف',
    evaluating: 'قاضی در حال ارزیابی هر دو دیدگاه است...',
    errorTitle: 'تحلیل ناموفق بود',
    errorBody: 'ارتباط با قاضی هوش مصنوعی برقرار نشد. لطفاً دوباره تلاش کنید.',
    technicalDetails: 'جزئیات فنی'
  }
};

/**
 * NewDispute Page
 * Form for submitting a new dispute for AI analysis
 */
export default function NewDispute() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorDetail, setErrorDetail] = useState(null);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = COPY[language];

  /**
   * @param {{ personA_statement: string; personB_statement: string; language: string }} formData
   */
  const analyzeDispute = async (formData) => {
    setIsLoading(true);
    setErrorDetail(null);
    
    try {
      // Real AI judge (Groq / GPT-OSS 120B) via the Vercel Function. No local
      // fallback - if this fails, the person sees a real error and can
      // retry, rather than silently getting a fake "offline estimate"
      // verdict that looks the same as a real one.
      const rawResult = await appClient.integrations.Core.InvokeLLM({
        prompt: buildAnalysisPrompt(formData)
      });
      const result = normalizeAnalysisResult(rawResult);

      // Save dispute to database
      const dispute = await appClient.entities.Dispute.create({
        personA_statement: formData.personA_statement,
        personB_statement: formData.personB_statement,
        personA_score: result.personA_score,
        personB_score: result.personB_score,
        verdict: result.verdict,
        explanation: result.explanation,
        verdict_reasoning: result.reasoning || null,
        language: formData.language,
        status: 'analyzed'
      });

      // Navigate to results page
      navigate(createPageUrl('Results') + `?id=${dispute.id}`);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      setErrorDetail(error?.message || String(error));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t.back}
            </Button>
          </Link>
          <Logo size="small" animated={false} />
          <div className="w-[76px]" aria-hidden="true" />
        </div>
      </div>

      {/* Content Section */}
      <div className="px-6 py-12">
        {errorDetail && (
          <div className="max-w-2xl mx-auto mb-6">
            <div
              dir={language === 'fa' ? 'rtl' : 'ltr'}
              className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800">{t.errorTitle}</p>
                <p className="text-sm text-red-700 mt-0.5">{t.errorBody}</p>
                <Collapsible className="mt-2">
                  <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors">
                    <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]:rotate-180" />
                    {t.technicalDetails}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <p dir="ltr" className="text-[11px] font-mono text-red-600/70 mt-1.5 break-words">
                      {errorDetail}
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          </div>
        )}
        <DisputeForm 
          onSubmit={analyzeDispute} 
          isLoading={isLoading} 
        />
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <motion.div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-sm mx-6"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-16 h-16 mx-auto mb-6 relative">
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-slate-200"
              />
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-t-amber-500 border-r-transparent border-b-transparent border-l-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <h3 className="text-xl font-medium text-slate-800 mb-2">
              {t.analyzing}
            </h3>
            <p className="text-slate-500">
              {t.evaluating}
            </p>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}