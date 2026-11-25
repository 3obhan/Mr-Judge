import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getDispute } from '@/lib/localStore';
import { createPageUrl } from "@/utils";
import { useLang } from '@/lib/i18n';
import VerdictDisplay from "@/components/arbiter/VerdictDisplay";
import Logo from "@/components/arbiter/Logo";
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";

/**
 * Results Page
 * Displays the AI verdict and analysis results
 */
export default function Results() {
  const { t } = useLang();
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const loadDispute = async () => {
      const disputeId = searchParams.get('id');

      if (!disputeId) {
        navigate(createPageUrl('Home'));
        return;
      }

      try {
        const found = getDispute(disputeId);
        if (found) {
          setDispute(found);
        } else {
          navigate(createPageUrl('Home'));
        }
      } catch (error) {
        console.error('Failed to load dispute:', error);
        navigate(createPageUrl('Home'));
      } finally {
        setLoading(false);
      }
    };

    loadDispute();
  }, [navigate, searchParams]);

  const handleReset = () => {
    navigate(createPageUrl('NewDispute'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('results.loading')}</p>
        </motion.div>
      </div>
    );
  }

  if (!dispute) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border safe-top">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 me-2 rtl:rotate-180" />
              {t('common.home')}
            </Button>
          </Link>
          <Logo size="small" animated={false} />
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Results Section */}
      <div className="px-6 py-12 md:py-16">
        <VerdictDisplay
          result={{
            personA_score: dispute.personA_score,
            personB_score: dispute.personB_score,
            verdict: dispute.verdict,
            explanation: dispute.explanation,
            executive_summary: dispute.executive_summary,
            reasoning: dispute.reasoning,
            settlement: dispute.settlement,
            governing_principle: dispute.governing_principle,
            confidence: dispute.confidence,
            personA_statement: dispute.personA_statement,
            personB_statement: dispute.personB_statement,
            analysis: dispute.analysis
          }}
          onReset={handleReset}
          language={dispute.language || 'en'}
        />
      </div>

      {/* Decorative Elements */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </div>
  );
}
