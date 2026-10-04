import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, PlusCircle, Settings, Package } from 'lucide-react';

export default function BottomNav() {
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
      to: '/materials',
      label: 'Materials',
      icon: Package
    },
    {
      to: '/quotation/new',
      label: 'New Quote',
      icon: PlusCircle
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings
    }
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur-md border-t border-[#F3F5F9] dark:border-gray-800 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] px-3 py-1.5 print:hidden transition-colors">
      <div className="max-w-[480px] mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[72px] h-[52px] rounded-[10px] transition-colors duration-200 active:scale-95 min-touch ${
                  isActive
                    ? 'text-[#2F6FED] font-semibold'
                    : 'text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-full transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                    <Icon className={`w-5 h-5 transition-colors duration-200 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  </div>
                  <span className="text-[12px] tracking-tight transition-colors duration-200">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
