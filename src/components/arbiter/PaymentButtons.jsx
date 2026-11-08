import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { authedApi } from '@/lib/account';
import { useLang } from '@/lib/i18n';
import { EXTERNAL_PAYMENTS_ALLOWED } from '@/lib/store';
import { billingReady, buyCredits } from '@/lib/billing';
import { fetchPublicConfig, priceText } from '@/lib/pricing';
import { toast } from '@/components/ui/use-toast';

/**
 * PaymentButtons Component
 * Website: Stripe (cards, Apple Pay, Google Pay) and PayPal for everybody in every language, plus Zibal (Iranian Shetab
 * cards) for visitors in Iran or reading Persian.
 * Only the methods that are switched on in the server settings (api/config.js) are shown.
 * Cafe Bazaar app: Bazaar's own billing (Poolakey).
 * The price, the pack size and the check that the money really arrived are handled on the server, never in the app.
 */
export default function PaymentButtons() {
  const { t, lang, n } = useLang();
  const [busy, setBusy] = useState('');
  const [config, setConfig] = useState(null);
  const [configFailed, setConfigFailed] = useState(false);
  const storeBilling = billingReady();

  useEffect(() => {
    if (storeBilling || !EXTERNAL_PAYMENTS_ALLOWED) return;
    fetchPublicConfig().then(setConfig).catch(() => setConfigFailed(true));
  }, [storeBilling]);

  const fail = (e) => {
    console.error('Payment start failed:', e);
    const code = e?.data?.zibalCode;
    const notReady = /NOT_CONFIGURED$/.test(e?.code || '');
    toast({
      title: t(notReady ? 'credits.gatewayNotReady' : 'credits.purchaseFailed'),
      description: code ? `${t('credits.gatewayCode')} ${code}` : undefined,
      variant: 'destructive',
    });
    setBusy('');
  };

  // Website: the server creates the payment, so the price and the buyer's account cannot be tampered with.
  const start = async (method) => {
    setBusy(method);
    try {
      const site = `${window.location.origin}${window.location.pathname}`;
      const back = `${window.location.origin}/${lang}/Credits`; // site already ends with the language: /de/
      let url;
      if (method === 'stripe') ({ url } = await authedApi('stripe', { action: 'create', returnUrl: `${site}?pay=stripe`, cancelUrl: back, locale: lang }));
      else if (method === 'paypal') ({ approveUrl: url } = await authedApi('paypal', { action: 'create', returnUrl: `${site}?pp=1`, cancelUrl: back }));
      else ({ payUrl: url } = await authedApi('zibal', { action: 'create', callbackUrl: `${site}?zp=1` }));
      window.location.href = url;
    } catch (e) { fail(e); }
  };

  // Cafe Bazaar app: credits are added (and the screen refreshed) by lib/billing.js
  const bazaarBuy = async () => {
    setBusy('bazaar');
    try { await buyCredits(); } catch (e) {
      console.error('Bazaar purchase failed:', e);
      toast({ title: t(e?.code === 'BAZAAR_NOT_FOUND' ? 'credits.bazaarMissing' : 'credits.purchaseFailed'), variant: 'destructive' });
    } finally { setBusy(''); }
  };

  if (storeBilling) {
    return (
      <div className="space-y-3">
        <Button onClick={bazaarBuy} disabled={!!busy} size="lg" className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-medium text-base shadow-lg">
          {t('credits.payBazaar')}
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">{t('credits.secureBazaar')}</p>
      </div>
    );
  }
  // Bazaar build opened outside the Android app (e.g. in a browser): no way to pay there
  if (!EXTERNAL_PAYMENTS_ALLOWED) return <p className="text-sm text-muted-foreground text-center">{t('credits.storeNotice')}</p>;

  if (configFailed) return <p className="text-sm text-muted-foreground text-center">{t('credits.pay.none')}</p>;
  if (!config) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const methods = [];
  // Visitors inside Iran cannot use PayPal / Stripe: they only see the Shetab card option
  const inIran = config.country === 'IR';
  if (!inIran && config.methods.stripe) methods.push({ id: 'stripe', label: t('credits.pay.card'), price: priceText('usd', config, lang), cls: 'bg-indigo-600 hover:bg-indigo-700', icon: <CreditCard className="w-5 h-5" /> });
  if (!inIran && config.methods.paypal) methods.push({ id: 'paypal', label: t('credits.pay.paypal'), price: priceText('usd', config, lang), cls: 'bg-[#0070ba] hover:bg-[#005ea6]', icon: <ExternalLink className="w-4 h-4" /> });
  // Zibal: for visitors in Iran (whatever language they picked) and for everyone reading Persian
  if (config.methods.zibal && (lang === 'fa' || config.country === 'IR')) methods.unshift({ id: 'zibal', label: t('credits.pay.shetab'), price: priceText('toman', config, lang), cls: 'bg-green-600 hover:bg-green-700', icon: <CreditCard className="w-5 h-5" /> });
  if (!methods.length) console.warn('No payment method is switched on. The server says:', config); // open /api/config to see which keys are missing
  if (!methods.length) return <p className="text-sm text-muted-foreground text-center">{t('credits.pay.none')}</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">{t('credits.pay.choose')}</p>
      {methods.map((m) => (
        <Button
          key={m.id}
          onClick={() => start(m.id)}
          disabled={!!busy}
          size="lg"
          className={`w-full h-14 text-white font-medium text-base shadow-lg hover:shadow-xl transition-all duration-300 ${m.cls}`}
        >
          {busy === m.id ? <Loader2 className="w-5 h-5 animate-spin" /> : m.icon}
          <span className="mx-2">{m.label}</span>
          <span className="opacity-90">· {lang === 'fa' ? n(m.price) : m.price}</span>
        </Button>
      ))}
      <p className="text-xs text-muted-foreground text-center mt-2">{t('credits.pay.secure')}</p>
    </div>
  );
}
