import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import Logo from "@/components/arbiter/Logo";
import CreditsDisplay from "@/components/arbiter/CreditsDisplay";
import PayPalButton from "@/components/arbiter/PayPalButton";
import { ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Credits Page
 * Manage and purchase dispute analysis credits
 */
export default function Credits() {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeCredits = async () => {
      try {
        // Get current user
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        // Check if returning from PayPal
        const urlParams = new URLSearchParams(window.location.search);
        const paymentSuccess = urlParams.get('payment');

        // Get or create credit record
        let creditRecords = await base44.entities.Credit.filter({ 
          user_email: currentUser.email 
        });

        if (creditRecords.length === 0) {
          // Create new credit record with 2 free credits
          const newCredit = await base44.entities.Credit.create({
            user_email: currentUser.email,
            remaining_credits: 2,
            total_purchased: 0
          });
          setCredits(newCredit);
        } else {
          let creditRecord = creditRecords[0];
          
          // If returning from successful PayPal payment, add 5 credits
          if (paymentSuccess === 'success') {
            creditRecord = await base44.entities.Credit.update(creditRecord.id, {
              remaining_credits: creditRecord.remaining_credits + 5,
              total_purchased: creditRecord.total_purchased + 5
            });
            // Clean URL
            window.history.replaceState({}, '', createPageUrl('Credits'));
          }
          
          setCredits(creditRecord);
        }
      } catch (error) {
        console.error('Failed to load credits:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeCredits();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading credits...</p>
        </div>
      </div>
    );
  }

  const returnUrl = `${window.location.origin}${createPageUrl('Credits')}?payment=success`;

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
          <div className="w-20" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-10">
            <h1 className="text-3xl font-light text-slate-800 mb-2">
              Your Credits
            </h1>
            <p className="text-slate-500">
              Purchase credits to analyze disputes
            </p>
          </div>

          {/* Current Credits */}
          <div className="mb-8">
            <CreditsDisplay credits={credits?.remaining_credits || 0} />
          </div>

          {/* Pricing Card */}
          <Card className="p-8 bg-white border-slate-200 shadow-lg">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-2xl font-medium text-slate-800 mb-2">
                Buy More Credits
              </h2>
              <p className="text-slate-500 mb-6">
                Get 5 dispute analyses for just $1
              </p>
              
              {/* Pricing Display */}
              <div className="bg-slate-50 rounded-xl p-6 mb-6">
                <div className="text-5xl font-light text-slate-800 mb-2">
                  $1<span className="text-2xl text-slate-500">.00</span>
                </div>
                <div className="text-slate-600">
                  = 5 Dispute Analyses
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-8 text-left">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-slate-700">AI-powered fair analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-slate-700">Detailed explanations</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-slate-700">Downloadable results</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-slate-700">Credits never expire</span>
                </div>
              </div>

              {/* PayPal Button */}
              <PayPalButton returnUrl={returnUrl} />

              <p className="text-xs text-slate-400 mt-4">
                Secure payment via PayPal
              </p>
            </div>
          </Card>

          {/* Info */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">
              Your first 2 dispute analyses were free! 🎉
            </p>
            {credits?.total_purchased > 0 && (
              <p className="text-sm text-slate-400 mt-1">
                Total purchased: {credits.total_purchased} credits
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}