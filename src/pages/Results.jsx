import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import VerdictDisplay from "@/components/arbiter/VerdictDisplay";
import { Loader2 } from 'lucide-react';

/**
 * Results Page
 * Displays the AI verdict and analysis results
 */
export default function Results() {
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadDispute = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const disputeId = urlParams.get('id');

      if (!disputeId) {
        navigate(createPageUrl('Home'));
        return;
      }

      try {
        const disputes = await base44.entities.Dispute.filter({ id: disputeId });
        if (disputes && disputes.length > 0) {
          setDispute(disputes[0]);
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
  }, [navigate]);

  const handleReset = () => {
    navigate(createPageUrl('NewDispute'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading verdict...</p>
        </motion.div>
      </div>
    );
  }

  if (!dispute) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Results Section */}
      <div className="px-6 py-12 md:py-16">
        <VerdictDisplay 
          result={{
            personA_score: dispute.personA_score,
            personB_score: dispute.personB_score,
            verdict: dispute.verdict,
            explanation: dispute.explanation
          }}
          onReset={handleReset}
          language={dispute.language || 'en'}
        />
      </div>

      {/* Decorative Elements */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </div>
  );
}