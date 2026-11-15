import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createDispute } from '@/lib/localStore';
import { fetchCredits, getCachedCredits, spendCredit, refundCredit } from '@/lib/account';
import { createPageUrl } from "@/utils";
import { judgeDispute } from '@/lib/judge';
import { clearDraft } from '@/lib/draft';
import { useLang } from '@/lib/i18n';
import DisputeForm from "@/components/arbiter/DisputeForm";
import CreditsDisplay from "@/components/arbiter/CreditsDisplay";
import Logo from "@/components/arbiter/Logo";
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { Card } from "@/components/ui/card";

/**
 * NewDispute Page
 * Form for submitting a new dispute for AI analysis
 */
export default function NewDispute() {
  const { t } = useLang();
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState(null);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setCredits(getCachedCredits());
    setLoadingCredits(false);
    fetchCredits().then(setCredits).catch(() => {});
  }, []);

  const analyzeDispute = async (formData) => {
    if (isLoading) return; // ignore double taps
    // Quick check with the last known balance (the server makes the final decision below)
    if (credits && credits.remaining_credits <= 0) {
      navigate(createPageUrl('Credits'));
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    let ticket = null;
    try {
      // The server takes the credit first and gives a one-time ticket for this analysis
      const spent = await spendCredit();
      ticket = spent.ticket;
      setCredits({ remaining_credits: spent.credits });

      // Prompt, scoring and verdict wording all live in lib/judge.js
      const result = await judgeDispute({ ...formData, ticket });

      // Save dispute to database
      const dispute = createDispute({
        personA_statement: formData.personA_statement,
        personB_statement: formData.personB_statement,
        personA_score: result.personA_score,
        personB_score: result.personB_score,
        verdict: result.verdict,
        explanation: result.explanation,
        language: formData.language,
        status: 'analyzed'
      });

      clearDraft();

      // Navigate to results page
      navigate(createPageUrl('Results') + `?id=${dispute.id}`);

    } catch (error) {
      console.error('Analysis failed:', error);
      if (error?.code === 'NO_CREDITS') {
        setCredits({ remaining_credits: 0 });
        setIsLoading(false);
        navigate(createPageUrl('Credits'));
        return;
      }
      // The analysis did not work: give the credit back (the server refuses if the AI had already answered)
      if (ticket) {
        const left = await refundCredit(ticket);
        if (left !== null) setCredits({ remaining_credits: left });
      }
      const m = error?.code === 'NETWORK' ? t('new.offline') : error?.message ? ` (${String(error.message).slice(0, 160)})` : '';
      setErrorMsg(error?.code === 'NETWORK' ? m : `${t('new.failed')}${m}`);
      setIsLoading(false);
    }
  };

  if (loadingCredits) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-muted border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border safe-top">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
              {t('common.back')}
            </Button>
          </Link>
          <Logo size="small" animated={false} />
          <Link to={createPageUrl('Credits')}>
            <CreditsDisplay credits={credits?.remaining_credits || 0} compact />
          </Link>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-6 py-12">
        {credits && credits.remaining_credits <= 0 && (
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="p-6 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-center">
              <AlertCircle className="w-12 h-12 text-amber-600 dark:text-amber-500 mx-auto mb-3" />
              <h3 className="text-xl font-medium text-foreground mb-2">
                {t('new.noCredits')}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t('new.noCreditsDesc')}
              </p>
              <Link to={createPageUrl('Credits')}>
                <Button className="bg-primary hover:bg-primary/90">
                  {t('new.buy')}
                </Button>
              </Link>
            </Card>
          </div>
        )}
        {errorMsg && (
          <div className="max-w-2xl mx-auto mb-6">
            <Card className="p-4 border-red-300 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm" dir="auto">
              {errorMsg}
            </Card>
          </div>
        )}
        <DisputeForm
          onSubmit={analyzeDispute}
          isLoading={isLoading}
          disabled={(credits?.remaining_credits || 0) <= 0}
        />
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <motion.div
          className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="bg-card rounded-2xl p-8 shadow-2xl text-center max-w-sm mx-6"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-16 h-16 mx-auto mb-6 relative">
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-muted"
              />
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-t-amber-500 border-r-transparent border-b-transparent border-l-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">
              {t('new.analyzingTitle')}
            </h3>
            <p className="text-muted-foreground">
              {t('new.analyzingDesc')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
