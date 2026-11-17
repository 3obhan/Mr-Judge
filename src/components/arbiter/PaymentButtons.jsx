import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, Link2, Loader2 } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { authedApi } from '@/lib/account';
import { useLang } from '@/lib/i18n';
import { externalPaymentsAllowed } from '@/lib/store';
import { billingReady, buyCredits } from '@/lib/billing';
import { fetchPublicConfig, priceText } from '@/lib/pricing';
import { availableMethods } from '@/lib/paymentMethods';
import { toast } from '@/components/ui/use-toast';

/**
 * PaymentButtons Component
 * Website: Stripe (cards, Apple Pay, Google Pay) and PayPal outside Iran, in every language. Persian readers and visitors in
 * Iran get Zibal (or, if you set one up, a hand-confirmed payment link instead). See src/lib/paymentMethods.js.
 * Only the methods that are switched on in the server settings (api/config.js) are shown.
 * Cafe Bazaar app: Bazaar's own billing (Poolakey).
 * The price, the pack size and the check that the money really arrived are handled on the server, never in the app.
 */
export default function PaymentButtons() {
  const { t, lang, n } = useLang();
  const [busy, setBusy] = useState('');
  const [config, setConfig] = useState(null);
  const [configFailed, setConfigFailed] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const storeBilling = billingReady();

  useEffect(() => {
    if (storeBilling || !externalPaymentsAllowed()) return;
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
      else ({ payUrl: url } = await authedApi('zibal', { action: 'create', callbackUrl: `${site}?zb=1` }));
      window.location.href = url;
    } catch (e) { fail(e); }
  };

  // Payment link (Iran): the visitor pays on the link's page, then sends the tracking code; credits are added after you approve it
  const sendTrackingCode = async () => {
    setBusy('link');
    try {
      await authedApi('manualpay', { action: 'submit', reference: trackingCode });
      setTrackingCode('');
      toast({ title: t('credits.link.sent') });
    } catch (e) {
      const key = { BAD_REFERENCE: 'credits.link.bad', DUPLICATE: 'credits.link.dup', TOO_MANY: 'credits.link.tooMany' }[e?.code] || 'credits.purchaseFailed';
      toast({ title: t(key), variant: 'destructive' });
    } finally { setBusy(''); }
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
  // Inside the Android app without the store billing plugin: no way to pay there
  if (!externalPaymentsAllowed()) return <p className="text-sm text-muted-foreground text-center">{t('credits.storeNotice')}</p>;

  if (configFailed) return <p className="text-sm text-muted-foreground text-center">{t('credits.pay.none')}</p>;
  if (!config) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const UI = {
    link: { label: t('credits.pay.link'), price: priceText('toman', config, lang), cls: 'bg-teal-600 hover:bg-teal-700', icon: <Link2 className="w-5 h-5" /> },
    zibal: { label: t('credits.pay.shetab'), price: priceText('toman', config, lang), cls: 'bg-green-600 hover:bg-green-700', icon: <CreditCard className="w-5 h-5" /> },
    stripe: { label: t('credits.pay.card'), price: priceText('usd', config, lang), cls: 'bg-indigo-600 hover:bg-indigo-700', icon: <CreditCard className="w-5 h-5" /> },
    paypal: { label: t('credits.pay.paypal'), price: priceText('usd', config, lang), cls: 'bg-[#0070ba] hover:bg-[#005ea6]', icon: <ExternalLink className="w-4 h-4" /> },
  };
  const methods = availableMethods(config, lang).map((id) => ({ id, ...UI[id] }));
  if (!methods.length) console.warn('No payment method is switched on. The server says:', config); // open /api/config to see which keys are missing
  if (!methods.length) return <p className="text-sm text-muted-foreground text-center">{t('credits.pay.none')}</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">{t('credits.pay.choose')}</p>
      {methods.map((m) => (
        <Button
          key={m.id}
          onClick={() => (m.id === 'link' ? setLinkOpen((v) => !v) : start(m.id))}
          disabled={!!busy}
          size="lg"
          className={`w-full h-14 text-white font-medium text-base shadow-lg hover:shadow-xl transition-all duration-300 ${m.cls}`}
        >
          {busy === m.id ? <Loader2 className="w-5 h-5 animate-spin" /> : m.icon}
          <span className="mx-2">{m.label}</span>
          <span className="opacity-90">· {lang === 'fa' ? n(m.price) : m.price}</span>
        </Button>
      ))}
      {linkOpen && config.linkUrl && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3 text-sm text-foreground">
          <p>{t('credits.link.step1')}</p>
          <a href={config.linkUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium">
            {t('credits.link.open')} <ExternalLink className="w-4 h-4" />
          </a>
          <p>{t('credits.link.step2')}</p>
          <div className="flex items-center gap-2">
            <Input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} placeholder={t('credits.link.placeholder')} dir="ltr" autoComplete="off" maxLength={40} className="font-mono" />
            <Button type="button" onClick={sendTrackingCode} disabled={!!busy || trackingCode.trim().length < 4} className="min-h-[44px]">
              {busy === 'link' ? <Loader2 className="w-4 h-4 animate-spin" /> : t('credits.link.submit')}
            </Button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground text-center mt-2">{t('credits.pay.secure')}</p>
    </div>
  );
}
