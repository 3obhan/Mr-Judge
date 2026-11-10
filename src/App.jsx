import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense } from 'react';
import { LanguageProvider, useLang } from '@/lib/i18n';
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

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LanguageProvider>
        <QueryClientProvider client={queryClientInstance}>
          <LangRouter />
          <Toaster />
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}

export default App
