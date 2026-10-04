import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { LogOut, Sparkles, Sun, Moon, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { COMPANY_CONFIG } from '../config/companyConfig';

export default function Header({ title, showBack = false, onBack }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, isDemoMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isOnline, isSyncing, pendingCount } = useSyncStatus();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur-md border-b border-[#F3F5F9] dark:border-gray-800 shadow-xs px-4 sm:px-6 lg:px-8 py-3 print:hidden transition-colors">
      <div className="max-w-[480px] lg:max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-[10px] text-[#0B1B3F] dark:text-white hover:bg-[#F3F5F9] dark:hover:bg-[#1A2332] active:scale-95 transition-all min-touch"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-2.5">
              <img
                src={COMPANY_CONFIG.logoUrl}
                alt={`${COMPANY_CONFIG.name} Logo`}
                className="w-8 h-8 rounded-lg object-contain shadow-xs bg-white p-0.5"
              />
              <div>
                <h1 className="text-[17px] font-bold text-[#0B1B3F] dark:text-white leading-tight tracking-tight">
                  {COMPANY_CONFIG.shortName}
                </h1>
                <p className="text-[11px] text-[#6B7280] dark:text-gray-400 font-medium leading-none">
                  Industries Quotation
                </p>
              </div>
            </div>
          )}

          {title && showBack && (
            <h2 className="text-[18px] font-bold text-[#0B1B3F] dark:text-white truncate">
              {title}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Online/Offline/Sync Connectivity Status */}
          <div
            title={
              isSyncing
                ? `Syncing ${pendingCount} offline ${pendingCount === 1 ? 'item' : 'items'} to cloud...`
                : isOnline
                ? 'Online — synced with cloud'
                : `Offline — ${pendingCount > 0 ? `${pendingCount} changes waiting to sync` : 'saving to local storage'}`
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              isSyncing
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800/80'
                : isOnline
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80'
            }`}
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 text-[#2F6FED] animate-spin shrink-0" />
            ) : (
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
              />
            )}
            <span className="hidden sm:inline">
              {isSyncing
                ? `Syncing ${pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? 'item' : 'items'}...` : 'changes...'}`
                : isOnline
                ? 'Online'
                : 'Offline'}
            </span>
            {isSyncing && (
              <span className="sm:hidden">
                {pendingCount > 0 ? `Syncing ${pendingCount}...` : 'Syncing...'}
              </span>
            )}
          </div>

          {/* Theme toggle (Sun / Moon) button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-9 h-9 flex items-center justify-center rounded-[10px] text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white hover:bg-[#F3F5F9] dark:hover:bg-[#1A2332] hover:scale-[1.02] active:scale-95 transition-all duration-150 min-touch cursor-pointer"
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-[#0B1B3F]" />
            )}
          </button>

          {user && (
            <button
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              title="Sign Out"
              className="w-9 h-9 flex items-center justify-center rounded-[10px] text-[#6B7280] dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:scale-[1.02] active:scale-95 transition-all duration-150 min-touch cursor-pointer"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
