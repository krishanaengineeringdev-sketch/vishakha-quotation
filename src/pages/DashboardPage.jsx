import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import DashboardStatsSection from '../components/DashboardStatsSection';
import { Plus, FileText, ArrowRight, Package } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="min-h-screen bg-white dark:bg-[#0B1220] flex flex-col pb-24 lg:pb-12 lg:pl-64 text-[#0B1B3F] dark:text-white transition-colors"
    >
      <Sidebar />
      <Header />

      <main className="flex-1 w-full max-w-[520px] lg:max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-8">
        {/* Title & Quick Actions Row */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-[20px] sm:text-[24px] font-bold text-[#0B1B3F] dark:text-white tracking-tight">
              Dashboard Analytics
            </h2>
            <p className="text-[12px] sm:text-[13px] text-[#6B7280] dark:text-gray-400">
              Live commercial insights & offline metrics from local storage
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/quotation/new')}
            className="inline-flex items-center gap-1.5 h-10 px-4 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 text-white text-[13px] font-semibold rounded-[10px] shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>
        </div>

        {/* 4 Stat Cards + Top 5 Customers list/table (Computed reactively via useLiveQuery) */}
        <DashboardStatsSection
          showTopCustomers={true}
          onCustomerClick={(cust) => navigate(`/?search=${encodeURIComponent(cust.name)}`)}
        />

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-4 bg-[#F3F5F9] dark:bg-[#1A2332] hover:bg-slate-100 dark:hover:bg-[#202C3F] border border-slate-200/80 dark:border-gray-800 rounded-[14px] flex items-center justify-between text-left group transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-white dark:bg-[#0B1220] flex items-center justify-center text-[#2F6FED] border border-slate-200/60 dark:border-gray-700">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-[#0B1B3F] dark:text-white group-hover:text-[#2F6FED] transition-colors">
                  Browse All Quotations
                </h4>
                <p className="text-[11px] text-[#6B7280] dark:text-gray-400">
                  Search, duplicate, export PDF, print & share quotes
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#6B7280] group-hover:text-[#2F6FED] group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/materials')}
            className="p-4 bg-[#F3F5F9] dark:bg-[#1A2332] hover:bg-slate-100 dark:hover:bg-[#202C3F] border border-slate-200/80 dark:border-gray-800 rounded-[14px] flex items-center justify-between text-left group transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-white dark:bg-[#0B1220] flex items-center justify-center text-[#2F6FED] border border-slate-200/60 dark:border-gray-700">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-[#0B1B3F] dark:text-white group-hover:text-[#2F6FED] transition-colors">
                  Inventory Catalog
                </h4>
                <p className="text-[11px] text-[#6B7280] dark:text-gray-400">
                  Manage product categories, unit prices & thumbnails
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#6B7280] group-hover:text-[#2F6FED] group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        </div>
      </main>

      <BottomNav />
    </motion.div>
  );
}
