import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Mail, Lock, AlertCircle, ArrowRight, Sun, Moon } from 'lucide-react';
import { COMPANY_CONFIG } from '../config/companyConfig';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password should be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      console.error('Auth error:', err);
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="min-h-screen bg-white dark:bg-[#0B1220] flex flex-col justify-center px-4 py-8 max-w-[420px] mx-auto relative transition-colors"
    >
      {/* Top-Right Theme Toggle */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-[#F3F5F9] dark:bg-[#1A2332] text-[#6B7280] dark:text-gray-400 hover:text-[#0B1B3F] dark:hover:text-white hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer"
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-[#0B1B3F]" />
          )}
        </button>
      </div>

      <div className="w-full">
        {/* Logo 80x80px centered */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-[80px] h-[80px] rounded-[16px] bg-[#F3F5F9] dark:bg-[#1A2332] p-2 flex items-center justify-center shadow-xs border border-slate-100 dark:border-gray-800 overflow-hidden">
            <img
              src={COMPANY_CONFIG.logoUrl}
              alt={COMPANY_CONFIG.name}
              width="80"
              height="80"
              className="w-full h-full object-contain"
            />
          </div>
          {/* Company name below */}
          <h1 className="mt-4 text-[22px] font-bold text-[#0B1B3F] dark:text-white tracking-tight text-center">
            {COMPANY_CONFIG.name}
          </h1>
          <p className="mt-1 text-[13px] text-[#6B7280] dark:text-gray-400 text-center">
            {COMPANY_CONFIG.tagline}
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-[10px] flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-[13px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@vishakhaindustries.com"
                className="w-full pl-10 pr-3 py-2.5 bg-[#F3F5F9] dark:bg-[#1A2332] border border-slate-200/80 dark:border-gray-700 rounded-[10px] text-[15px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] focus:bg-white dark:focus:bg-[#1A2332] transition-all min-touch"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 bg-[#F3F5F9] dark:bg-[#1A2332] border border-slate-200/80 dark:border-gray-700 rounded-[10px] text-[15px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] focus:bg-white dark:focus:bg-[#1A2332] transition-all min-touch"
              />
            </div>
          </div>

          {/* Full-width primary button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 h-12 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 text-white font-semibold rounded-[10px] shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all duration-150 min-touch cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </motion.div>
  );
}
