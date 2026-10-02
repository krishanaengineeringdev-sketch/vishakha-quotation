import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { COMPANY_CONFIG } from '../config/companyConfig';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if dismissed before in this session
    if (sessionStorage.getItem('pwa_prompt_dismissed')) {
      return;
    }

    // Check if standalone already
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      return;
    }

    // iOS detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      setShowBanner(true);
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed top-16 left-3 right-3 max-w-[460px] mx-auto z-50 bg-[#F3F5F9] dark:bg-[#1A2332] border border-blue-100 dark:border-gray-800 rounded-[12px] p-3.5 shadow-md print:hidden animate-fade-in transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-[#2F6FED] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-[14px] font-bold text-[#0B1B3F] dark:text-white">
              Install {COMPANY_CONFIG.shortName} App
            </h4>
            <p className="text-[12px] text-[#6B7280] dark:text-gray-400 leading-tight">
              {isIOS
                ? 'Tap Share icon and "Add to Home Screen" for quick access'
                : 'Install for quick 1-tap quotes and offline speed'}
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white p-1 rounded-md min-touch flex items-center justify-center"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!isIOS && deferredPrompt && (
        <div className="mt-2.5 flex justify-end gap-2">
          <button
            onClick={handleDismiss}
            className="text-[13px] text-[#6B7280] dark:text-gray-400 px-3 py-1.5 rounded-[10px] hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="text-[13px] bg-[#2F6FED] hover:bg-blue-600 text-white font-medium px-4 py-1.5 rounded-[10px] shadow-xs active:scale-95 transition-all"
          >
            Install
          </button>
        </div>
      )}
    </div>
  );
}
