import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Package,
  Settings,
  Sun,
  Moon,
  LogOut,
  Sparkles,
  Plus,
  Building,
  RefreshCw
} from 'lucide-react';
import { COMPANY_CONFIG } from '../config/companyConfig';
import { useSyncStatus } from '../hooks/useSyncStatus';

export default function Sidebar() {
  const navigate = useNavigate();
  const { user, signOut, isDemoMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isOnline, isSyncing, pendingCount } = useSyncStatus();

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard
    },
    {
      to: '/',
      label: 'Quotations',
      icon: FileText
    },
    {
      to: '/quotation/new',
      label: 'New Quote',
      icon: PlusCircle
    },
    {
      to: '/materials',
      label: 'Inventory Catalog',
      icon: Package
    },
    {
      to: '/settings',
      label: 'Company Settings',
      icon: Settings
    }
  ];

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-white dark:bg-[#0B1220] border-r border-[#E2E5EA] dark:border-gray-800 flex-col justify-between z-40 print:hidden transition-colors select-none">
      {/* Top Branding & Quick Create */}
      <div className="p-5">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100 dark:border-gray-800">
          <div className="w-10 h-10 rounded-[10px] bg-[#F3F5F9] dark:bg-[#1A2332] p-1 border border-slate-200/80 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
            <img
              src={COMPANY_CONFIG.logoUrl}
              alt={`${COMPANY_CONFIG.name} Logo`}
              width="36"
              height="36"
              loading="lazy"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-bold text-[#0B1B3F] dark:text-white leading-tight truncate">
              {COMPANY_CONFIG.shortName}
            </h1>
            <p className="text-[11px] text-[#6B7280] dark:text-gray-400 font-medium truncate">
              Quotation Suite
            </p>
          </div>
        </div>

        {/* Quick New Quote Button */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => navigate('/quotation/new')}
            className="w-full h-10 px-4 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 text-white text-[13px] font-semibold rounded-[10px] flex items-center justify-center gap-2 shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Quotation</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="mt-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-[14px] font-medium transition-colors duration-200 active:scale-[0.98] ${
                    isActive
                      ? 'bg-[#2F6FED] text-white font-semibold shadow-xs'
                      : 'text-[#6B7280] dark:text-gray-400 hover:bg-[#F3F5F9] dark:hover:bg-[#1A2332] hover:text-[#0B1B3F] dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 transition-colors duration-200 ${isActive ? 'text-white' : 'text-[#6B7280] dark:text-gray-400'}`} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile, Theme Toggle & Status */}
      <div className="p-4 border-t border-slate-100 dark:border-gray-800 space-y-2">
        {/* Connectivity Status */}
        <div
          title={
            isSyncing
              ? `Syncing ${pendingCount} offline ${pendingCount === 1 ? 'item' : 'items'} to cloud...`
              : isOnline
              ? 'Online — synced with cloud'
              : `Offline — ${pendingCount > 0 ? `${pendingCount} changes waiting to sync` : 'saving to local storage'}`
          }
          className={`flex items-center justify-between px-3 py-2 rounded-[8px] text-[12px] font-medium transition-colors ${
            isSyncing
              ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300/80 dark:border-blue-800/80'
              : isOnline
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
              : 'bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 text-[#2F6FED] animate-spin shrink-0" />
            ) : (
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
              />
            )}
            <span>
              {isSyncing
                ? `Syncing ${pendingCount > 0 ? `${pendingCount} items...` : 'changes...'}`
                : isOnline
                ? 'Online Mode'
                : 'Offline Mode'}
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
            {isSyncing ? 'Syncing' : isOnline ? 'Synced' : 'Local'}
          </span>
        </div>

        {/* Demo Mode Badge */}
        {isDemoMode && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 text-[11px] font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">Instant Demo Access</span>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-[13px] text-[#0B1B3F] dark:text-white hover:bg-[#F3F5F9] dark:hover:bg-[#1A2332] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-[#2F6FED]" />
            )}
            <span className="font-medium">
              {theme === 'dark' ? 'Dark Theme' : 'Light Theme'}
            </span>
          </div>
          <span className="text-[11px] text-[#6B7280] dark:text-gray-400 font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-800">
            {theme === 'dark' ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* User / Logout */}
        {user && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-gray-800">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-[12px] font-semibold text-[#0B1B3F] dark:text-white truncate">
                {user.email || 'Commercial User'}
              </p>
              <p className="text-[10px] text-[#6B7280] dark:text-gray-400 truncate">
                Vishakha Industries
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              title="Sign Out"
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6B7280] dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
