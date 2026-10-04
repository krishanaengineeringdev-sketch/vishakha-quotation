import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getCompanyProfile, saveCompanyProfile } from '../services/dataService';
import { uploadAsset, isSupabaseConfigured } from '../supabaseClient';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { COMPANY_CONFIG } from '../config/companyConfig';
import {
  Upload,
  Building,
  User,
  MapPin,
  Phone,
  Mail,
  FileSignature,
  Check,
  AlertCircle
} from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields
  const [name, setName] = useState(COMPANY_CONFIG.name);
  const [ownerName, setOwnerName] = useState(COMPANY_CONFIG.ownerName);
  const [address, setAddress] = useState(COMPANY_CONFIG.address);
  const [phone, setPhone] = useState(COMPANY_CONFIG.phone);
  const [email, setEmail] = useState(COMPANY_CONFIG.email);
  const [logoUrl, setLogoUrl] = useState(COMPANY_CONFIG.logoUrl);
  const [signatureUrl, setSignatureUrl] = useState('');
  const [defaultGreeting, setDefaultGreeting] = useState(COMPANY_CONFIG.defaultGreeting);
  const [defaultClosing, setDefaultClosing] = useState(COMPANY_CONFIG.defaultClosing);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const p = await getCompanyProfile();
        if (p) {
          if (p.name) setName(p.name);
          if (p.owner_name) setOwnerName(p.owner_name);
          if (p.address) setAddress(p.address);
          if (p.phone) setPhone(p.phone);
          if (p.email) setEmail(p.email);
          if (p.logo_url) setLogoUrl(p.logo_url);
          if (p.signature_url) setSignatureUrl(p.signature_url);
          if (p.default_greeting) setDefaultGreeting(p.default_greeting);
          if (p.default_closing) setDefaultClosing(p.default_closing);
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setErrorMsg('');
    try {
      const url = await uploadAsset(file, 'logo');
      if (url) {
        setLogoUrl(url);
      }
    } catch (err) {
      console.error('Logo upload error:', err);
      setErrorMsg('Failed to process logo image.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSignature(true);
    setErrorMsg('');
    try {
      const url = await uploadAsset(file, 'signature');
      if (url) {
        setSignatureUrl(url);
      }
    } catch (err) {
      console.error('Signature upload error:', err);
      setErrorMsg('Failed to process signature image.');
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await saveCompanyProfile({
        name: name.trim() || 'Vishakha Industries',
        owner_name: ownerName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        logo_url: logoUrl,
        signature_url: signatureUrl,
        default_greeting: defaultGreeting.trim(),
        default_closing: defaultClosing.trim()
      });

      setSuccessMsg('Company profile saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error('Save settings error:', err);
      setErrorMsg(err.message || 'Failed to save company profile.');
    } finally {
      setSaving(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0B1220] flex flex-col pb-24 lg:pb-12 lg:pl-64 transition-colors">
        <Sidebar />
        <Header />

        <main className="flex-1 max-w-[480px] lg:max-w-5xl xl:max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-8 space-y-4">
          <div className="space-y-1.5 mb-5">
            <div className="h-6 w-48 skeleton rounded-[6px]" />
            <div className="h-3.5 w-64 skeleton rounded-[4px]" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card 1: Branding */}
            <div className="bg-[#F3F5F9] dark:bg-[#1A2332] rounded-[16px] p-5 space-y-4 border border-slate-200/80 dark:border-gray-800">
              <div className="h-5 w-36 skeleton rounded-[6px]" />
              <div className="flex gap-4 items-center">
                <div className="w-20 h-20 skeleton rounded-[12px]" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 skeleton rounded-[4px]" />
                  <div className="h-8 w-24 skeleton rounded-[8px]" />
                </div>
              </div>
            </div>

            {/* Card 2: Company Details */}
            <div className="bg-[#F3F5F9] dark:bg-[#1A2332] rounded-[16px] p-5 space-y-3 border border-slate-200/80 dark:border-gray-800">
              <div className="h-5 w-40 skeleton rounded-[6px]" />
              <div className="h-10 skeleton rounded-[10px]" />
              <div className="h-10 skeleton rounded-[10px]" />
              <div className="h-10 skeleton rounded-[10px]" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="min-h-screen bg-white dark:bg-[#0B1220] flex flex-col pb-24 lg:pb-12 lg:pl-64 transition-colors"
    >
      <Sidebar />
      <Header />

      <main className="flex-1 max-w-[480px] lg:max-w-5xl xl:max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-8">
        <div className="mb-5">
          <h2 className="text-[20px] sm:text-[24px] font-bold text-[#0B1B3F] dark:text-white tracking-tight">
            Company Settings
          </h2>
          <p className="text-[12px] sm:text-[13px] text-[#6B7280] dark:text-gray-400">
            Configure profile, branding assets & default quotation notes
          </p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-[10px] flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-[13px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-[10px] flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-[13px]">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Logo & Signature Uploads + About Company */}
            <div className="lg:col-span-5 space-y-4">
              {/* Logo & Signature Upload Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3.5">
                {/* Logo Upload Card */}
                <div className="bg-[#F3F5F9] dark:bg-[#1A2332] rounded-[14px] p-4 border border-slate-100 dark:border-gray-800 flex flex-col items-center text-center justify-between shadow-xs">
                  <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-gray-700/60">
                    <span className="text-[13px] font-bold text-[#0B1B3F] dark:text-white">
                      Company Logo
                    </span>
                    <span className="text-[11px] text-[#6B7280] dark:text-gray-400">PNG / JPG</span>
                  </div>
                  <div className="w-[88px] h-[88px] rounded-[12px] bg-white dark:bg-[#0B1220] p-2 border border-slate-200 dark:border-gray-700 flex items-center justify-center overflow-hidden my-2 shadow-xs">
                    <img
                      src={logoUrl || COMPANY_CONFIG.logoUrl}
                      alt="Logo preview"
                      width="88"
                      height="88"
                      loading="lazy"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>

                  <label className="cursor-pointer inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2F6FED] hover:text-white bg-white dark:bg-[#0B1220] hover:bg-[#2F6FED] dark:hover:bg-[#2F6FED] border border-blue-200 dark:border-blue-900/60 px-3.5 py-1.5 rounded-[8px] transition-all min-touch shadow-xs mt-2">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingLogo ? 'Processing...' : 'Upload Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Signature Upload Card */}
                <div className="bg-[#F3F5F9] dark:bg-[#1A2332] rounded-[14px] p-4 border border-slate-100 dark:border-gray-800 flex flex-col items-center text-center justify-between shadow-xs">
                  <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-gray-700/60">
                    <span className="text-[13px] font-bold text-[#0B1B3F] dark:text-white">
                      Signature Stamp
                    </span>
                    <span className="text-[11px] text-[#6B7280] dark:text-gray-400">80×40 px</span>
                  </div>
                  <div className="w-[120px] h-[50px] rounded-[10px] bg-white dark:bg-[#0B1220] p-1.5 border border-slate-200 dark:border-gray-700 flex items-center justify-center overflow-hidden my-2 shadow-xs">
                    {signatureUrl ? (
                      <img
                        src={signatureUrl}
                        alt="Signature preview"
                        width="120"
                        height="50"
                        loading="lazy"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-[11px] text-[#6B7280] dark:text-gray-400 font-medium">No signature</span>
                    )}
                  </div>

                  <label className="cursor-pointer inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2F6FED] hover:text-white bg-white dark:bg-[#0B1220] hover:bg-[#2F6FED] dark:hover:bg-[#2F6FED] border border-blue-200 dark:border-blue-900/60 px-3.5 py-1.5 rounded-[8px] transition-all min-touch shadow-xs mt-2">
                    <FileSignature className="w-3.5 h-3.5" />
                    <span>{uploadingSignature ? 'Processing...' : 'Upload Signature'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* About Company Card */}
              <div className="bg-white dark:bg-[#1A2332] rounded-[14px] p-4 border border-slate-200/80 dark:border-gray-800 shadow-xs space-y-2.5">
                <div className="flex items-center gap-3 pb-2.5 border-b border-slate-100 dark:border-gray-800">
                  <div className="w-12 h-12 rounded-[10px] bg-[#F3F5F9] dark:bg-[#0B1220] p-1.5 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 dark:border-gray-700">
                    <img
                      src={COMPANY_CONFIG.logoUrl}
                      alt={COMPANY_CONFIG.name}
                      width="48"
                      height="48"
                      loading="lazy"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-bold text-[#0B1B3F] dark:text-white">
                      {COMPANY_CONFIG.name}
                    </h4>
                    <p className="text-[12px] text-[#2F6FED] font-medium">
                      Proprietor: {COMPANY_CONFIG.ownerName}
                    </p>
                  </div>
                </div>

                <div className="text-[12px] text-[#6B7280] dark:text-gray-400 space-y-1.5 pt-1">
                  <p className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#2F6FED] shrink-0 mt-0.5" />
                    <span>{COMPANY_CONFIG.address}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#2F6FED] shrink-0" />
                    <a href={`tel:${COMPANY_CONFIG.phone}`} className="text-[#0B1B3F] dark:text-white hover:underline font-medium">
                      {COMPANY_CONFIG.phone}
                    </a>
                  </p>
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#2F6FED] shrink-0" />
                    <a href={`mailto:${COMPANY_CONFIG.email}`} className="text-[#0B1B3F] dark:text-white hover:underline font-medium">
                      {COMPANY_CONFIG.email}
                    </a>
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Form Fields & Save Action */}
            <div className="lg:col-span-7 space-y-4">
              {/* Company Profile Details */}
              <div className="bg-[#F3F5F9] dark:bg-[#1A2332] rounded-[14px] p-4 sm:p-5 space-y-3.5 border border-slate-100 dark:border-gray-800 shadow-xs">
                <h3 className="text-[15px] font-bold text-[#0B1B3F] dark:text-white pb-2 border-b border-slate-200/60 dark:border-gray-700/60">
                  Business Information
                </h3>

                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                    Company Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                      <Building className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={COMPANY_CONFIG.name}
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[15px] font-bold text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] min-touch"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                    Owner / Proprietor Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder={COMPANY_CONFIG.ownerName}
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[15px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] min-touch"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                    Address
                  </label>
                  <div className="relative">
                    <div className="absolute top-2.5 left-3 pointer-events-none text-[#6B7280] dark:text-gray-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <textarea
                      rows={2}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder={COMPANY_CONFIG.address}
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[14px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                      Phone
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={COMPANY_CONFIG.phone}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[14px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] min-touch"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-gray-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={COMPANY_CONFIG.email}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[14px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] min-touch"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quotation Defaults */}
              <div className="bg-[#F3F5F9] dark:bg-[#1A2332] rounded-[14px] p-4 sm:p-5 space-y-3.5 border border-slate-100 dark:border-gray-800 shadow-xs">
                <h3 className="text-[15px] font-bold text-[#0B1B3F] dark:text-white pb-2 border-b border-slate-200/60 dark:border-gray-700/60">
                  Quotation Defaults
                </h3>

                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                    Default Greeting
                  </label>
                  <textarea
                    rows={2}
                    value={defaultGreeting}
                    onChange={(e) => setDefaultGreeting(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]"
                  />
                  <span className="text-[11px] text-[#6B7280] dark:text-gray-400 block mt-0.5">
                    Automatically used on every new quotation (editable per quote)
                  </span>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#0B1B3F] dark:text-white mb-1">
                    Default Closing Line
                  </label>
                  <textarea
                    rows={2}
                    value={defaultClosing}
                    onChange={(e) => setDefaultClosing(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#0B1220] border border-slate-200 dark:border-gray-700 rounded-[10px] text-[13px] text-[#0B1B3F] dark:text-white placeholder-[#6B7280] dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2F6FED]"
                  />
                  <span className="text-[11px] text-[#6B7280] dark:text-gray-400 block mt-0.5">
                    Printed before signature on quotations
                  </span>
                </div>
              </div>

              {/* Save Profile Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full h-12 bg-[#2F6FED] hover:bg-blue-600 hover:scale-[1.02] active:scale-95 text-white font-semibold rounded-[10px] shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Company Profile</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>

      <BottomNav />
    </motion.div>
  );
}
