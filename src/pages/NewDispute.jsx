import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from "@/utils";
import DisputeForm from "@/components/arbiter/DisputeForm";
import { AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { Card } from "@/components/ui/card";

/**
 * NewDispute Page
 * Form for submitting a new dispute for AI analysis
 */
export default function NewDispute() {
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState(null);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadCredits = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) {
        setLoadingCredits(false);
        base44.auth.redirectToLogin(window.location.href);
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

  const analyzeDispute = async (formData) => {
    // Check if user has credits
    if (!credits || credits.remaining_credits <= 0) {
      navigate(createPageUrl('Credits'));
      return;
    }

    setIsLoading(true);
    
    try {
      // Create the AI prompt based on language
      const isEnglish = formData.language === 'en';
      
      const prompt = isEnglish ? `
You are Judge, an AI dispute resolution system. Analyze the following dispute between two parties.

EVALUATION CRITERIA:
1. Logical Consistency: How coherent and logical is each party's argument?
2. Responsibility: Who bears more responsibility for the situation?
3. Proportionality: Are reactions and expectations proportional to the situation?
4. Clarity of Expectations: Were expectations clearly communicated?

RULES:
- Be completely neutral and analytical
- Do NOT make moral judgments
- Do NOT give advice
- Do NOT use psychology
- Focus only on facts and logic
- This works for ANY type of dispute (business, personal, legal, etc.)

PERSON A's STATEMENT:
${formData.personA_statement}

PERSON B's STATEMENT:
${formData.personB_statement}

Analyze this dispute and provide your verdict.
` : `
شما داور هستید، یک سیستم حل اختلاف با هوش مصنوعی. اختلاف زیر را بین دو طرف تحلیل کنید.

معیارهای ارزیابی:
۱. سازگاری منطقی: استدلال هر طرف چقدر منسجم و منطقی است؟
۲. مسئولیت: چه کسی مسئولیت بیشتری در قبال وضعیت دارد؟
۳. تناسب: آیا واکنش‌ها و انتظارات متناسب با وضعیت است؟
۴. وضوح انتظارات: آیا انتظارات به وضوح بیان شده بود؟

قوانین:
- کاملاً بی‌طرف و تحلیلی باشید
- قضاوت اخلاقی نکنید
- نصیحت ندهید
- از روانشناسی استفاده نکنید
- فقط روی حقایق و منطق تمرکز کنید

بیانیه شخص الف:
${formData.personA_statement}

بیانیه شخص ب:
${formData.personB_statement}

این اختلاف را تحلیل کنید و حکم خود را ارائه دهید.
`;

      // Call AI for analysis
      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            personA_score: { 
              type: "number", 
              description: "Score for Person A from 0-100 based on how justified their position is" 
            },
            personB_score: { 
              type: "number", 
              description: "Score for Person B from 0-100 based on how justified their position is" 
            },
            verdict: { 
              type: "string",
              description: isEnglish 
                ? "One of: 'Person A is more justified', 'Person B is more justified', 'Both parties are partially justified', 'Neither party is justified'"
                : "یکی از: 'شخص الف حق بیشتری دارد'، 'شخص ب حق بیشتری دارد'، 'هر دو طرف تا حدی حق دارند'، 'هیچ‌کدام حق ندارند'"
            },
            explanation: { 
              type: "string",
              description: "Concise, neutral, analytical explanation in maximum 6 sentences"
            }
          },
          required: ["personA_score", "personB_score", "verdict", "explanation"]
        }
      });

      // Deduct 1 credit
      await base44.entities.Credit.update(credits.id, {
        remaining_credits: credits.remaining_credits - 1
      });

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