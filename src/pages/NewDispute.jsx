import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import DisputeForm from "@/components/arbiter/DisputeForm";
import CreditsDisplay from "@/components/arbiter/CreditsDisplay";
import Logo from "@/components/arbiter/Logo";
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { Card } from "@/components/ui/card";
import { analyzeDispute as analyzeLocally } from '@/lib/dispute-analysis';

/**
 * NewDispute Page
 * Form for submitting a new dispute for AI analysis
 */
export default function NewDispute() {
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState({ remaining_credits: 0, total_purchased: 0 });
  const [loadingCredits, setLoadingCredits] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadCredits = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        setLoadingCredits(false);
        return;
      }

      try {
        const user = await base44.auth.me();
        let creditRecords = await base44.entities.Credit.filter({ 
          user_email: user.email 
        });

        if (creditRecords.length === 0) {
          // Create new credit record with 2 free credits
          const newCredit = await base44.entities.Credit.create({
            user_email: user.email,
            remaining_credits: 2,
            total_purchased: 0
          });
          setCredits(newCredit);
        } else {
          setCredits(creditRecords[0]);
        }
      } catch (error) {
        console.error('Failed to load credits:', error);
        // Set default credits to allow page to render
        setCredits({ remaining_credits: 0, total_purchased: 0 });
      } finally {
        setLoadingCredits(false);
      }
    };

    loadCredits();
  }, []);

  /**
   * @param {{ personA_statement: string; personB_statement: string; language: string }} formData
   */
  const analyzeDispute = async (formData) => {
    // Check if user has credits
    if (credits.remaining_credits <= 0) {
      navigate(createPageUrl('Credits'));
      return;
    }

    setIsLoading(true);
    
    try {
      const result = analyzeLocally({
        personA_statement: formData.personA_statement,
        personB_statement: formData.personB_statement,
        language: formData.language
      });

      // Deduct 1 credit
      if (credits?.id) {
        await base44.entities.Credit.update(credits.id, {
          remaining_credits: credits.remaining_credits - 1
        });
      }

      // Save dispute to database
      const dispute = await base44.entities.Dispute.create({
        personA_statement: formData.personA_statement,
        personB_statement: formData.personB_statement,
        personA_score: result.personA_score,
        personB_score: result.personB_score,
        verdict: result.verdict,
        explanation: result.explanation,
        language: formData.language,
        status: 'analyzed'
      });

      // Navigate to results page
      navigate(createPageUrl('Results') + `?id=${dispute.id}`);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      setIsLoading(false);
    }
  };

  if (loadingCredits || !credits) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
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
        {(credits?.remaining_credits || 0) <= 0 && (
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="p-6 bg-amber-50 border-amber-200 text-center">
              <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-3" />
              <h3 className="text-xl font-medium text-slate-800 mb-2">
                No Credits Remaining
              </h3>
              <p className="text-slate-600 mb-4">
                Purchase credits to analyze disputes.
              </p>
              <Link to={createPageUrl('Credits')}>
                <Button className="bg-slate-800 hover:bg-slate-700">
                  Buy Credits
                </Button>
              </Link>
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
              Analyzing Dispute
            </h3>
            <p className="text-slate-500">
              Judge is evaluating both perspectives...
            </p>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}