import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Brain, FileText, Sparkles } from 'lucide-react';
import { createPageUrl } from "@/utils";
import { useLang } from '@/lib/i18n';
import { fetchCredits, getCachedCredits } from '@/lib/account';
import Logo from "@/components/arbiter/Logo";
import CreditsDisplay from "@/components/arbiter/CreditsDisplay";
import PullToRefresh from "@/components/arbiter/PullToRefresh";

/**
 * Home Page
 * Elegant welcome screen with branding and call-to-action
 */
export default function Home() {
  const { t } = useLang();
  const [credits, setCredits] = useState(null);
  const loadUser = useCallback(async () => {
    setCredits((c) => c || getCachedCredits()); // last known balance first, then the real one from the server
    try { setCredits(await fetchCredits()); } catch (e) { console.warn('Could not load credits:', e); }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const features = [
    { icon: Brain, title: t('home.f1.title'), description: t('home.f1.desc') },
    { icon: Shield, title: t('home.f2.title'), description: t('home.f2.desc') },
    { icon: FileText, title: t('home.f3.title'), description: t('home.f3.desc') }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      {credits && (
        <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border safe-top">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-end">
            <Link to={createPageUrl('Credits')}>
              <CreditsDisplay credits={credits?.remaining_credits || 0} compact />
            </Link>
          </div>
        </div>
      )}

      <PullToRefresh onRefresh={loadUser}>
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Logo */}
        <Logo size="large" animated={true} />

        {/* Tagline */}
        <motion.p
          className="text-center text-muted-foreground text-lg md:text-xl max-w-md mt-8 mb-12 font-light"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          {t('home.tagline')}
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
              className="h-14 px-10 text-base font-medium tracking-wide bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              {t('home.begin')}
              <ArrowRight className="w-5 h-5 ms-2 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
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
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
                <feature.icon className="w-6 h-6 text-amber-600 dark:text-amber-500" />
              </div>
              <h3 className="text-foreground font-medium mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
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
        <p className="text-muted-foreground text-sm">
          {t('home.footer')}
        </p>
      </motion.footer>
      </PullToRefresh>
    </div>
  );
}
