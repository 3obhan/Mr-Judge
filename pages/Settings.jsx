import React, { useState, useEffect } from 'react';
import { deleteAllData } from '@/lib/localStore';
import { ensureAccount, getAccountKey, restoreAccount, deleteServerAccount, fetchAccountInfo, getCachedAccountInfo, signOutLocal } from '@/lib/account';
import EmailVerifyCard from '@/components/arbiter/EmailVerifyCard';
import { fetchPublicConfig } from '@/lib/pricing';
import { toast } from '@/components/ui/use-toast';
import { Input } from "@/components/ui/input";
import { useLang } from '@/lib/i18n';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle, Eye, EyeOff, Copy, KeyRound } from 'lucide-react';

export default function Settings() {
  const { t, lang } = useLang();
  const [deleting, setDeleting] = useState(false);

  const [accountKey, setAccountKey] = useState(getAccountKey());
  const [showKey, setShowKey] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [restoring, setRestoring] = useState(false);

  const [info, setInfo] = useState(getCachedAccountInfo());
  const [emailOn, setEmailOn] = useState(false); // email sign-in only appears when the server can send emails
  useEffect(() => { fetchPublicConfig().then((c) => setEmailOn(!!c.ready?.email)).catch(() => {}); }, []);

  // Make sure this device has an account, so there is a key to show; then load the email status
  useEffect(() => {
    ensureAccount()
      .then((k) => { setAccountKey(k); return fetchAccountInfo(); })
      .then((i) => setInfo({ email: i.email, emailVerified: i.emailVerified }))
      .catch(() => {});
  }, []);

  const handleSignOut = () => {
    if (!window.confirm(t('settings.signOutConfirm'))) return;
    signOutLocal();
    window.location.assign(`/${lang}/`);
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(accountKey);
      toast({ title: t('settings.keyCopied') });
    } catch { /* clipboard blocked: the key is visible, the user can copy by hand */ }
  };

  const handleRestore = async () => {
    if (!restoreInput.trim()) return;
    setRestoring(true);
    try {
      await restoreAccount(restoreInput);
      setAccountKey(getAccountKey());
      setRestoreInput('');
      toast({ title: t('settings.restoreOk') });
    } catch {
      toast({ title: t('settings.restoreFail'), variant: 'destructive' });
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteServerAccount(); // erase the account and credits on the server first
    } catch {
      setDeleting(false);
      toast({ title: t('settings.deleteFailed'), variant: 'destructive' });
      return;
    }
    deleteAllData();
    window.location.assign(`/${lang}/`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md border-b border-border safe-top">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-light text-foreground">{t('settings.title')}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        {info.emailVerified ? (
          <Card className="p-6 bg-card border-border">
            <p className="text-sm text-muted-foreground mb-1">{t('settings.signedInAs')}</p>
            <p className="font-mono text-foreground mb-4" dir="ltr">{info.email}</p>
            <Button type="button" variant="outline" onClick={handleSignOut} className="min-h-[44px]">
              {t('settings.signOut')}
            </Button>
          </Card>
        ) : !emailOn ? null : (
          <EmailVerifyCard onDone={() => fetchAccountInfo().then((i) => { setInfo({ email: i.email, emailVerified: i.emailVerified }); setAccountKey(getAccountKey()); }).catch(() => {})} />
        )}

        <Card className="p-6 bg-card border-border">
          <h2 className="text-lg font-medium text-foreground mb-2 flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            {t('settings.account')}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">{t('settings.accountDesc')}</p>
          <div className="flex items-center gap-2 mb-6">
            <div className="flex-1 min-w-0 px-3 py-2 rounded-md bg-muted font-mono text-sm tracking-wide text-foreground text-center" dir="ltr">
              {accountKey ? (showKey ? accountKey : '••••-••••-••••-••••-••••') : '…'}
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => setShowKey((v) => !v)} title={showKey ? t('settings.hideKey') : t('settings.showKey')} aria-label={showKey ? t('settings.hideKey') : t('settings.showKey')} className="min-h-[44px] min-w-[44px]">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={handleCopyKey} disabled={!accountKey} title={t('settings.copyKey')} aria-label={t('settings.copyKey')} className="min-h-[44px] min-w-[44px]">
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <h3 className="text-base font-medium text-foreground mb-2">{t('settings.restoreTitle')}</h3>
          <div className="flex items-center gap-2">
            <Input
              value={restoreInput}
              onChange={(e) => setRestoreInput(e.target.value)}
              placeholder={t('settings.restorePlaceholder')}
              dir="ltr"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
            <Button type="button" onClick={handleRestore} disabled={restoring || !restoreInput.trim()} className="min-h-[44px]">
              {t('settings.restoreBtn')}
            </Button>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <h2 className="text-lg font-medium text-foreground mb-4">{t('settings.data')}</h2>

          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-amber-600 hover:underline mb-6"
          >
            {t('settings.privacy')}
          </a>

          <div className="border-t border-border pt-6">
            <h3 className="text-base font-medium text-destructive mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('settings.deleteTitle')}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {t('settings.deleteDesc')}
            </p>
            <ul className="text-sm text-muted-foreground mb-6 space-y-1 list-disc list-inside">
              <li>{t('settings.l1')}</li>
              <li>{t('settings.l2')}</li>
            </ul>
            <p className="text-sm text-muted-foreground mb-6">
              {t('settings.irreversible')}
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting} className="min-h-[44px]">
                  <Trash2 className="w-4 h-4 me-2" />
                  {t('settings.deleteTitle')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.sure')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.sureDesc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t('settings.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
      </div>
    </div>
  );
}
