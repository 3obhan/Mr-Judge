import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchCredits, getCachedCredits, authedApi, setCachedCredits } from '@/lib/account';
import { PAY_RETURN_KEY, PAY_CANCELLED_KEY } from '@/lib/paymentReturn';
import { fetchPublicConfig, headlinePrice } from '@/lib/pricing';
import { billingReady } from '@/lib/billing';
import { createPageUrl } from "@/utils";
import { useLang } from '@/lib/i18n';
import Logo from "@/components/arbiter/Logo";
import CreditsDisplay from "@/components/arbiter/CreditsDisplay";
import PaymentButtons from "@/components/arbiter/PaymentButtons";
import PullToRefresh from "@/components/arbiter/PullToRefresh";
import { ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { restorePurchases, subscribeGranted } from '@/lib/billing';
import { toast } from '@/components/ui/use-toast';
import { Card } from "@/components/ui/card";

/**
 * Credits Page
 * Manage and purchase dispute analysis credits
 */
export default function Credits() {
  const { t, n, lang } = useLang();
  const [config, setConfig] = useState(null);
  useEffect(() => { fetchPublicConfig().then(setConfig).catch(() => {}); }, []);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);

  const initializeCredits = useCallback(async () => {
    setCredits((c) => c || getCachedCredits()); // show the last known balance right away
    // Returning from a payment page: the server asks the provider if the money really arrived, then adds the credits
    let pending = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(PAY_RETURN_KEY) || 'null');
      if (sessionStorage.getItem(PAY_CANCELLED_KEY)) {
        sessionStorage.removeItem(PAY_CANCELLED_KEY);
        toast({ title: t('credits.paymentCancelled'), variant: 'destructive' });
      }
    } catch { /* ignore */ }
    if (pending?.provider && pending?.id) {
      const call = {
        zarinpal: () => authedApi('zarinpal', { action: 'verify', authority: pending.id }),
        paypal: () => authedApi('paypal', { action: 'capture', orderId: pending.id }),
        stripe: () => authedApi('stripe', { action: 'verify', sessionId: pending.id }),
      }[pending.provider];
      try {
        const r = await call();
        setCachedCredits(r.credits);
        if (r.granted) toast({ title: t('credits.purchaseDone') });
        sessionStorage.removeItem(PAY_RETURN_KEY);
      } catch (e) {
        if (e.code !== 'NETWORK') { // network problems: keep it and try again next time
          try { sessionStorage.removeItem(PAY_RETURN_KEY); } catch { /* ignore */ }
          toast({ title: t('credits.purchaseFailed'), variant: 'destructive' });
        }
      }
    }
    // Bazaar app: finish any paid-but-unfinished purchase (no-op on the web)
    try { await restorePurchases(); } catch (e) { console.warn('Purchase restore skipped:', e); }
    try {
      setCredits(await fetchCredits());
    } catch (e) {
      console.warn('Could not load credits:', e);
      setCredits((c) => c || { remaining_credits: 0 });
      toast({ title: t('credits.loadFailed'), variant: 'destructive' });
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    initializeCredits();
  }, [initializeCredits]);

  // A store purchase finished: refresh the balance and confirm
  useEffect(() => subscribeGranted(() => {
    setCredits(getCachedCredits());
    toast({ title: t('credits.purchaseDone') });
  }), [t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-muted border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('credits.loading')}</p>
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
          <div className="w-20" />
        </div>
      </div>

      {/* Content */}
      <PullToRefresh onRefresh={initializeCredits}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-10">
            <h1 className="text-3xl font-light text-foreground mb-2">
              {t('credits.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('credits.subtitle')}
            </p>
          </div>

          {/* Current Credits */}
          <div className="mb-8">
            <CreditsDisplay credits={credits?.remaining_credits || 0} />
          </div>

          {/* Pricing Card */}
          <Card className="p-8 bg-card border-border shadow-lg">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 dark:bg-amber-950/30 rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-amber-600 dark:text-amber-500" />
              </div>
              <h2 className="text-2xl font-medium text-foreground mb-2">
                {t('credits.buyMore')}
              </h2>
              <p className="text-muted-foreground mb-6">
                {t('credits.offer', { n: n(config?.packCredits ?? 5), price: n(headlinePrice(config, lang, { bazaar: billingReady() })) })}
              </p>

              {/* Pricing Display (store builds show the price in the store's own dialog) */}
              <div className="bg-muted rounded-xl p-6 mb-6">
                <div className="text-5xl font-light text-foreground mb-2">
                  {n(headlinePrice(config, lang, { bazaar: billingReady() })) || '…'}
                </div>
                <div className="text-muted-foreground">
                  {t('credits.equals', { n: n(config?.packCredits ?? 5) })}
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3 mb-8 text-start">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground">{t('credits.f1')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground">{t('credits.f2')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground">{t('credits.f3')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <span className="text-foreground">{t('credits.f4')}</span>
                </div>
              </div>

              {/* Payment Buttons */}
              <PaymentButtons />
            </div>
          </Card>

          {/* Info */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t('credits.free')}
            </p>
            {credits?.total_purchased > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {t('credits.total', { n: n(credits.total_purchased) })}
              </p>
            )}
          </div>
        </motion.div>
      </div>
      </PullToRefresh>
    </div>
  );
}
