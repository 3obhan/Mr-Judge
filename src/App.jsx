import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useEffect } from 'react';
import { LanguageProvider, useLang } from '@/lib/i18n';
import { authedApi, setCachedCredits } from '@/lib/account';
import { PAY_RETURN_KEY, PAY_CANCELLED_KEY } from '@/lib/paymentReturn';
import { toast } from '@/components/ui/use-toast';
import PageNotFound from './lib/PageNotFound';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const PageMotion = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.25 }}
  >
    {children}
  </motion.div>
);

const SuspenseFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={
            <LayoutWrapper currentPageName={mainPageKey}>
              <PageMotion><MainPage /></PageMotion>
            </LayoutWrapper>
          } />
          {Object.entries(Pages).map(([path, Page]) => (
            <Route
              key={path}
              path={`/${path}`}
              element={
                <LayoutWrapper currentPageName={path}>
                  <PageMotion><Page /></PageMotion>
                </LayoutWrapper>
              }
            />
          ))}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};

// The page address starts with the language (/de/Credits): the router works inside that prefix
const LangRouter = () => {
  const { lang } = useLang();
  return (
    <Router key={lang} basename={`/${lang}`}>
      <AnimatedRoutes />
    </Router>
  );
};


function PaymentReturnProcessor() {
  const { t } = useLang();

  useEffect(() => {
    let payment = null;
    try {
      payment = JSON.parse(sessionStorage.getItem(PAY_RETURN_KEY) || 'null');
    } catch { /* ignore malformed session data */ }

    if (payment?.provider === 'zibal' && payment.id) {
      let active = true;
      (async () => {
        try {
          const result = await authedApi('zibal', { action: 'verify', trackId: payment.id });
          if (!active) return;
          setCachedCredits(result.credits);
          sessionStorage.removeItem(PAY_RETURN_KEY);
          sessionStorage.removeItem(PAY_CANCELLED_KEY);
          toast({ title: t('credits.purchaseDone') });
        } catch (error) {
          if (!active) return;
          // Keep the marker after transient errors so a reload can safely retry verification.
          if (['NOT_PAID', 'UNKNOWN_PAYMENT'].includes(error?.code) || (error?.status >= 400 && error?.status < 500)) {
            sessionStorage.removeItem(PAY_RETURN_KEY);
          }
          toast({ title: t('credits.purchaseFailed'), variant: 'destructive' });
        }
      })();
      return () => { active = false; };
    }

    if (sessionStorage.getItem(PAY_CANCELLED_KEY) === '1') {
      sessionStorage.removeItem(PAY_CANCELLED_KEY);
      toast({ title: t('credits.paymentCancelled'), variant: 'destructive' });
    }
  }, [t]);

  return null;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        <QueryClientProvider client={queryClientInstance}>
          <PaymentReturnProcessor />
          <LangRouter />
          <Toaster />
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}

export default App
