import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Button } from './Button';
import { useTranslation } from '../../i18n';

export function PWAInstallPrompt() {
  const { isInstallable, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (sessionStorage.getItem('nook_pwa_dismissed')) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('nook_pwa_dismissed', 'true');
  };

  if (!isInstallable || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] sm:w-[380px]"
      >
        <div className="bg-surface border border-border rounded-xl shadow-2xl p-4 flex items-center gap-4">
          <div className="bg-accent/10 p-2.5 rounded-xl text-accent shrink-0">
            <Download size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text truncate">
              {t('pwa.title')}
            </h3>
            <p className="text-xs text-text2 line-clamp-2">
              {t('pwa.desc')}
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button size="sm" onClick={promptInstall} className="whitespace-nowrap px-3 text-xs h-8">
              {t('pwa.install')}
            </Button>
            <button onClick={handleDismiss} className="text-xs text-text3 hover:text-text transition-colors">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
