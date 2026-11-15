import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listDisputes, deleteDispute } from '@/lib/localStore';
import { createPageUrl } from "@/utils";
import { useLang, toPersianDigits } from '@/lib/i18n';
import Logo from "@/components/arbiter/Logo";
import { ArrowLeft, Scale, ChevronRight, Calendar, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function History() {
  const { t, n, formatDate, lang } = useLang();
  const [disputes, setDisputes] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadDisputes = async () => {
      try {
        const list = listDisputes().slice(0, 50);
        setDisputes(list);
      } catch (error) {
        console.error('Failed to load disputes:', error);
        setDisputes([]);
      } finally {
        setLoading(false);
      }
    };
    loadDisputes();
  }, []);

  const removeDispute = (e, id) => {
    e.stopPropagation();
    if (!window.confirm(t('history.deleteConfirm'))) return;
    deleteDispute(id);
    setDisputes((list) => (list || []).filter((d) => d.id !== id));
  };

  const openDispute = (id) => {
    navigate(createPageUrl('Results') + `?id=${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-muted border-t-amber-500 rounded-full animate-spin" />
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
          <div className="w-16" />
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-1">{t('history.title')}</h1>
        <p className="text-muted-foreground mb-6">{t('history.subtitle')}</p>

        {(!disputes || disputes.length === 0) ? (
          <Card className="p-12 text-center">
            <Scale className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">{t('history.emptyTitle')}</h3>
            <p className="text-muted-foreground mb-6">{t('history.emptyDesc')}</p>
            <Link to={createPageUrl('NewDispute')}>
              <Button className="bg-primary hover:bg-primary/90">
                {t('history.new')}
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {disputes.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className="p-4 cursor-pointer hover:border-amber-500/50 transition-colors"
                  onClick={() => openDispute(d.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{formatDate(d.created_date)}</span>
                        {d.language && d.language !== lang && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{String(d.language).toUpperCase()}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground truncate">
                        {d.verdict ? (d.language === 'fa' ? toPersianDigits(d.verdict) : d.verdict) : t('history.pending')}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {t('history.a')} <span className="font-semibold text-foreground">{d.personA_score != null ? n(Math.round(d.personA_score)) : '—'}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('history.b')} <span className="font-semibold text-foreground">{d.personB_score != null ? n(Math.round(d.personB_score)) : '—'}</span>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={t('history.delete')}
                      title={t('history.delete')}
                      onClick={(e) => removeDispute(e, d.id)}
                      className="shrink-0 p-2 rounded-md text-muted-foreground hover:text-red-600 hover:bg-muted transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 rtl:rotate-180" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
