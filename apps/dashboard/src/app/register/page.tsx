'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, Building2, User, ArrowRight, AlertCircle, Globe, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const POPULAR_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [primaryLanguage, setPrimaryLanguage] = useState('en');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en']);
  const [customLanguageInput, setCustomLanguageInput] = useState('');
  const [allLanguages, setAllLanguages] = useState(POPULAR_LANGUAGES);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLanguage = (code: string) => {
    if (code === primaryLanguage) {
      // Primary language cannot be unselected
      return;
    }
    if (selectedLanguages.includes(code)) {
      setSelectedLanguages(selectedLanguages.filter((l) => l !== code));
    } else {
      setSelectedLanguages([...selectedLanguages, code]);
    }
  };

  const handleAddCustomLanguage = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = customLanguageInput.trim().toLowerCase();
    if (!clean) return;

    if (!selectedLanguages.includes(clean)) {
      setSelectedLanguages([...selectedLanguages, clean]);
    }
    if (!allLanguages.some((l) => l.code === clean)) {
      setAllLanguages([
        ...allLanguages,
        {
          code: clean,
          name: clean.toUpperCase(),
          native: clean.toUpperCase(),
        },
      ]);
    }
    setCustomLanguageInput('');
  };

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await apiClient.register({
        fullName,
        organizationName,
        email,
        password,
        primaryLanguage,
        storeLanguages: selectedLanguages,
      });
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <div className="inline-flex w-12 h-12 rounded-xl bg-[#0d2a2c] items-center justify-center font-bold text-xl text-[#fad982] shadow-lg shadow-teal-950/20 mb-4 border border-[#143d40]">
          AI
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Register Account</h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Create your client workspace for product intelligence &amp; multi-language catalog enrichment.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-md border border-slate-200 rounded-2xl sm:px-10 space-y-6">
          {error && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Organization / Company Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Acme Global Retail"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                />
              </div>
            </div>

            {/* Store Languages Confirmation Section */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-emerald-700" />
                <label className="block text-xs font-black uppercase tracking-wider text-slate-900">
                  Store Languages Configuration
                </label>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">
                Confirm which languages your store uses. Scraping and AI enrichment will generate catalog content for all selected languages.
              </p>

              {/* Primary Language */}
              <div className="mb-3">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Primary Store Language
                </label>
                <select
                  value={primaryLanguage}
                  onChange={(e) => {
                    const newPrimary = e.target.value;
                    setPrimaryLanguage(newPrimary);
                    if (!selectedLanguages.includes(newPrimary)) {
                      setSelectedLanguages([newPrimary, ...selectedLanguages]);
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                >
                  {allLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name} ({lang.native}) [{lang.code.toUpperCase()}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Multi-select Supported Languages */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  Supported Store Languages ({selectedLanguages.length} selected)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allLanguages.map((lang) => {
                    const isSelected = selectedLanguages.includes(lang.code);
                    const isPrimary = lang.code === primaryLanguage;
                    return (
                      <button
                        type="button"
                        key={lang.code}
                        onClick={() => toggleLanguage(lang.code)}
                        className={`flex items-center justify-between p-2 rounded-lg border text-left text-[11px] font-semibold transition ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="truncate pr-1">
                          <span className="block truncate">{lang.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {lang.native} {isPrimary ? '• Primary' : ''}
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Language */}
                <div className="mt-2.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customLanguageInput}
                    onChange={(e) => setCustomLanguageInput(e.target.value)}
                    onKeyDown={handleAddCustomLanguage}
                    placeholder="Add other language (e.g. sv, pl, tr, el)"
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomLanguage}
                    className="px-3 py-1.5 bg-[#0d2a2c] text-[#fad982] rounded-lg text-xs font-bold hover:bg-[#143d40] transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold text-slate-950 bg-[#fad982] hover:bg-[#f6cd64] transition shadow-sm disabled:opacity-50"
            >
              <span>{loading ? 'Registering...' : 'Register Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium">Already have an account? </span>
            <Link href="/login" className="text-xs text-[#0d2a2c] font-bold hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
