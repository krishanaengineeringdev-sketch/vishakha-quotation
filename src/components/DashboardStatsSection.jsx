import React from 'react';
import { useDashboardAnalytics, formatRupee } from '../hooks/useDashboardAnalytics';
import { FileText, TrendingUp, Calendar, IndianRupee, Users } from 'lucide-react';

export default function DashboardStatsSection({ showTopCustomers = true, onCustomerClick }) {
  const {
    totalQuotations,
    totalQuotedValue,
    thisMonthCount,
    thisMonthValue,
    topCustomers,
    currentMonthName,
    isLoading
  } = useDashboardAnalytics();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 4 Stat Cards Grid: 2 columns on mobile, 4 columns on large screens */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* 1. Total Quotations */}
        <div className="bg-[#F3F5F9] dark:bg-[#1A2332] border border-slate-200/80 dark:border-gray-800 rounded-[14px] p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-[12px] font-semibold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider">
              Total Quotations
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] bg-blue-100/70 dark:bg-blue-950/70 text-[#2F6FED] flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <div className="space-y-1.5 my-1">
                <div className="h-7 w-16 skeleton rounded-[6px]" />
                <div className="h-3 w-20 skeleton rounded-[4px]" />
              </div>
            ) : (
              <>
                <div className="text-[20px] sm:text-[26px] font-extrabold text-[#0B1B3F] dark:text-white tracking-tight">
                  {totalQuotations}
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-gray-400 mt-0.5">
                  All-time count
                </p>
              </>
            )}
          </div>
        </div>

        {/* 2. Total Quoted Value */}
        <div className="bg-[#F3F5F9] dark:bg-[#1A2332] border border-slate-200/80 dark:border-gray-800 rounded-[14px] p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-[12px] font-semibold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider">
              Total Quoted Value
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] bg-blue-100/70 dark:bg-blue-950/70 text-[#2F6FED] flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <div className="space-y-1.5 my-1">
                <div className="h-7 w-24 skeleton rounded-[6px]" />
                <div className="h-3 w-24 skeleton rounded-[4px]" />
              </div>
            ) : (
              <>
                <div
                  className="text-[16px] sm:text-[22px] lg:text-[24px] font-extrabold text-[#2F6FED] tracking-tight truncate"
                  title={formatRupee(totalQuotedValue)}
                >
                  {formatRupee(totalQuotedValue)}
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-gray-400 mt-0.5">
                  Sum of grand total
                </p>
              </>
            )}
          </div>
        </div>

        {/* 3. This Month Count */}
        <div className="bg-[#F3F5F9] dark:bg-[#1A2332] border border-slate-200/80 dark:border-gray-800 rounded-[14px] p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-[12px] font-semibold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider truncate" title={`This Month (${currentMonthName})`}>
              This Month Count
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] bg-indigo-100/70 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <div className="space-y-1.5 my-1">
                <div className="h-7 w-16 skeleton rounded-[6px]" />
                <div className="h-3 w-20 skeleton rounded-[4px]" />
              </div>
            ) : (
              <>
                <div className="text-[20px] sm:text-[26px] font-extrabold text-[#0B1B3F] dark:text-white tracking-tight">
                  {thisMonthCount}
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-gray-400 mt-0.5 truncate">
                  {currentMonthName}
                </p>
              </>
            )}
          </div>
        </div>

        {/* 4. This Month Value */}
        <div className="bg-[#F3F5F9] dark:bg-[#1A2332] border border-slate-200/80 dark:border-gray-800 rounded-[14px] p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] sm:text-[12px] font-semibold text-[#6B7280] dark:text-gray-400 uppercase tracking-wider">
              This Month Value
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] bg-amber-100/70 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <div className="space-y-1.5 my-1">
                <div className="h-7 w-24 skeleton rounded-[6px]" />
                <div className="h-3 w-24 skeleton rounded-[4px]" />
              </div>
            ) : (
              <>
                <div
                  className="text-[16px] sm:text-[22px] lg:text-[24px] font-extrabold text-[#2F6FED] tracking-tight truncate"
                  title={formatRupee(thisMonthValue)}
                >
                  {formatRupee(thisMonthValue)}
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-gray-400 mt-0.5 truncate">
                  Current month value
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top 5 Customers List / Table (Simple, lightweight, offline) */}
      {showTopCustomers && (
        <div className="bg-[#F3F5F9] dark:bg-[#1A2332] border border-slate-200/80 dark:border-gray-800 rounded-[14px] sm:rounded-[16px] p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-200/80 dark:border-gray-700/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-[8px] bg-[#2F6FED]/10 text-[#2F6FED] flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] sm:text-[16px] font-bold text-[#0B1B3F] dark:text-white leading-snug">
                  Top 5 Customers
                </h3>
                <p className="text-[11px] text-[#6B7280] dark:text-gray-400">
                  Ranked by total quoted value (descending)
                </p>
              </div>
            </div>
            <span className="top-accounts-badge text-[11px] sm:text-[12px] font-semibold bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 text-[#4B5563] dark:text-gray-300 shadow-2xs">
              {isLoading ? '...' : `${topCustomers.length} ${topCustomers.length === 1 ? 'Top Account' : 'Top Accounts'}`}
            </span>
          </div>

          {isLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider font-semibold text-[#6B7280] dark:text-gray-400 border-b border-slate-200/60 dark:border-gray-700/60">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Customer Name</th>
                    <th className="py-2 px-3 text-center">Quotations</th>
                    <th className="py-2 px-3 text-right">Total Quoted Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-gray-700/40">
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-3 w-8">
                        <div className="w-4 h-4 skeleton rounded-[4px]" />
                      </td>
                      <td className="py-3 px-3 space-y-1">
                        <div className="w-32 sm:w-44 h-4 skeleton rounded-[5px]" />
                        <div className="w-20 h-3 skeleton rounded-[4px]" />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="w-8 h-4 skeleton rounded-[4px] mx-auto" />
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="w-24 h-4 skeleton rounded-[5px] ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : topCustomers.length === 0 ? (
            <div className="py-8 text-center text-[#6B7280] dark:text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-[13px]">No quotations found in local storage yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider font-semibold text-[#6B7280] dark:text-gray-400 border-b border-slate-200/60 dark:border-gray-700/60">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Customer Name</th>
                    <th className="py-2 px-3 text-center">Quotations</th>
                    <th className="py-2 px-3 text-right">Total Quoted Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-gray-700/40">
                  {topCustomers.map((cust, idx) => (
                    <tr
                      key={cust.id || idx}
                      onClick={() => onCustomerClick && onCustomerClick(cust)}
                      className="group hover:bg-white/60 dark:hover:bg-[#0B1220]/60 transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-[#6B7280] dark:text-gray-400 w-8">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#0B1B3F] dark:text-white group-hover:text-[#2F6FED] transition-colors">
                          {cust.name}
                        </div>
                        {cust.place && (
                          <div className="text-[11px] text-[#6B7280] dark:text-gray-400">
                            {cust.place}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-[#6B7280] dark:text-gray-300 font-medium">
                        {cust.quoteCount}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-[#2F6FED]">
                        {formatRupee(cust.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
