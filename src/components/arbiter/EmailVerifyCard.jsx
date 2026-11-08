import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from '@/components/ui/use-toast';
import { Mail } from 'lucide-react';
import { useLang } from '@/lib/i18n';
import { requestEmailCode, verifyEmailCode } from '@/lib/account';

const ERROR_KEYS = {
  BAD_EMAIL: 'email.bad',
  TOO_MANY_REQUESTS: 'email.tooMany',
  TOO_MANY_ATTEMPTS: 'email.tooMany',
  WRONG_CODE: 'email.wrong',
  CODE_EXPIRED: 'email.expired',
  EMAIL_SEND_FAILED: 'email.sendFailed',
  EMAIL_NOT_CONFIGURED: 'email.sendFailed',
  ALREADY_HAS_EMAIL: 'email.alreadyHas',
  NETWORK: 'email.network',
};

/**
 * Email verification: 1) enter email -> we send a 6-digit code, 2) enter the code.
 * The first time an email is verified it gives the free analyses; an email that already has an account signs in to it.
 * onDone() is called after success so the page can refresh the balance.
 */
export default function EmailVerifyCard({ onDone }) {
  const { t } = useLang();
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = (e) => toast({ title: t(ERROR_KEYS[e?.code] || 'email.sendFailed'), variant: 'destructive' });

  const send = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await requestEmailCode(email.trim());
      setStep('code');
      toast({ title: t('email.codeSent') });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const verify = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await verifyEmailCode(email.trim(), code.trim());
      toast({ title: t(r.granted > 0 ? 'email.granted' : 'email.signedIn') });
      onDone?.(r);
    } catch (e) {
      fail(e);
      if (e?.code === 'CODE_EXPIRED' || e?.code === 'TOO_MANY_ATTEMPTS') { setStep('email'); setCode(''); }
    } finally { setBusy(false); }
  };

  return (
    <Card className="p-6 bg-card border-border mb-6">
      <h2 className="text-lg font-medium text-foreground mb-2 flex items-center gap-2">
        <Mail className="w-5 h-5" />
        {t('email.title')}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">{t('email.desc')}</p>

      {step === 'email' ? (
        <div className="flex items-center gap-2">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('email.placeholder')}
          />
          <Button type="button" onClick={send} disabled={busy || !email.trim()} className="min-h-[44px]">
            {t('email.send')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder={t('email.codePlaceholder')}
              className="font-mono tracking-widest text-center"
            />
            <Button type="button" onClick={verify} disabled={busy || code.length !== 6} className="min-h-[44px]">
              {t('email.verify')}
            </Button>
          </div>
          <button
            type="button"
            onClick={() => { setStep('email'); setCode(''); }}
            className="text-sm text-amber-600 hover:underline"
          >
            {t('email.change')}
          </button>
        </div>
      )}
    </Card>
  );
}
