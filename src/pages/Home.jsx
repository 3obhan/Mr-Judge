import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Brain, FileText } from 'lucide-react';
import { createPageUrl } from "@/utils";
import Logo from "@/components/arbiter/Logo";
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Home Page
 * Elegant welcome screen with branding and call-to-action
 */
export default function Home() {
  const { language } = useLanguage();
  const isRTL = language === 'fa';

  const labels = {
    en: {
      tagline: 'Resolve disputes with intelligent, unbiased AI analysis',
      cta: 'Begin Resolution',
      footer: 'Fair • Neutral • Analytical',
      features: [
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
      ]
    },
    fa: {
      tagline: 'اختلاف‌ها رو با تحلیل هوشمند و بی‌طرف هوش مصنوعی حل کن',
      cta: 'شروع داوری',
      footer: 'منصفانه • بی‌طرف • تحلیلی',
      features: [
        {
          icon: Brain,
          title: 'تحلیل مبتنی بر هوش مصنوعی',
          description: 'ارزیابی پیشرفته‌ی انسجام منطقی و تناسب'
        },
        {
          icon: Shield,
          title: 'بی‌طرف و منصفانه',
          description: 'بدون قضاوت اخلاقی - فقط ارزیابی تحلیلی'
        },
        {
          icon: FileText,
          title: 'حکم دقیق',
          description: 'توضیح شفاف با نتایج قابل دانلود'
        }
      ]
    }
  };

  const t = labels[language];
  const features = t.features;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
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
          {t.tagline}
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
              {t.cta}
              <ArrowRight className={`w-5 h-5 group-hover:translate-x-1 transition-transform ${isRTL ? 'mr-2 rotate-180' : 'ml-2'}`} />
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
          {t.footer}
        </p>
      </motion.footer>
    </div>
  );
}