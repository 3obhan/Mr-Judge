import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Brain, FileText, Sparkles } from 'lucide-react';
import { createPageUrl } from "@/utils";
import { base44 } from '@/api/base44Client';
import Logo from "@/components/arbiter/Logo";
import CreditsDisplay from "@/components/arbiter/CreditsDisplay";

/**
 * Home Page
 * Elegant welcome screen with branding and call-to-action
 */
export default function Home() {
  const [credits, setCredits] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          const currentUser = await base44.auth.me();
          setUser(currentUser);
          
          const creditRecords = await base44.entities.Credit.filter({ 
            user_email: currentUser.email 
          });
          if (creditRecords.length > 0) {
            setCredits(creditRecords[0]);
          }
        }
      } catch (error) {
        // User not logged in - that's ok
      }
    };
    
    loadUser();
  }, []);

  const features = [
    {
      icon: Brain,
      title: 'AI-Powered Analysis',
      description: 'Advanced evaluation of logical consistency and proportionality'
    },
    {
      icon: Shield,
      title: 'Neutral & Unbiased',
      description: 'No moral judgment - purely analytical assessment'
    },
    {
      icon: FileText,
      title: 'Detailed Verdict',
      description: 'Clear explanation with downloadable results'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Top Bar */}
      {user && (
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-end">
            <Link to={createPageUrl('Credits')}>
              <CreditsDisplay credits={credits?.remaining_credits || 0} compact />
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Logo */}
        <Logo size="large" animated={true} />

        {/* Tagline */}
        <motion.p
          className="text-center text-slate-500 text-lg md:text-xl max-w-md mt-8 mb-12 font-light"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          Resolve disputes with intelligent, unbiased AI analysis
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
        >
          <Link to={createPageUrl('NewDispute')}>
            <Button 
              size="lg"
              className="h-14 px-10 text-base font-medium tracking-wide bg-slate-800 hover:bg-slate-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              Begin Resolution
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>

        {/* Features */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-4xl w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="text-center p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.4 + index * 0.1 }}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
                <feature.icon className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-slate-800 font-medium mb-2">{feature.title}</h3>
              <p className="text-slate-500 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Footer */}
      <motion.footer
        className="py-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.6 }}
      >
        <p className="text-slate-400 text-sm">
          Fair • Neutral • Analytical
        </p>
      </motion.footer>
    </div>
  );
}