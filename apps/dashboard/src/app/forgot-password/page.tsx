'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.forgotPassword(email);
      setSubmitted(true);
      if (res?.resetUrl) {
        setResetUrl(res.resetUrl);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-800">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-12 h-12 rounded-xl bg-[#0d2a2c] items-center justify-center font-bold text-xl text-[#fad982] shadow-lg shadow-teal-950/20 mb-4 border border-[#143d40]">
          AI
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Reset Your Password</h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Enter your registered work email and we will generate a password reset link.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md border border-[#dbdade] rounded-xl sm:px-10 space-y-6">
          {error && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {submitted ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Password Reset Initiated</span>
              </div>
              <p className="leading-relaxed">
                If an account exists for <strong>{email}</strong>, a password reset token has been registered.
              </p>
              {resetUrl && (
                <div className="p-3 bg-white border border-emerald-200 rounded-lg text-slate-700">
                  <p className="font-semibold text-slate-900 mb-1">Testing Environment Shortcut:</p>
                  <Link
                    href={resetUrl}
                    className="inline-flex items-center gap-1.5 font-bold text-[#0d2a2c] hover:underline break-all"
                  >
                    <span>Click here to set new password</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
              <div className="pt-2">
                <Link href="/login" className="text-xs font-bold text-[#0d2a2c] hover:underline flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-[#dbdade] rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold text-slate-950 bg-[#fad982] hover:bg-[#f6cd64] transition shadow-sm disabled:opacity-50"
              >
                <span>{loading ? 'Sending Request...' : 'Send Reset Link'}</span>
              </button>

              <div className="text-center pt-2">
                <Link href="/login" className="text-xs text-slate-500 font-bold hover:text-[#0d2a2c] flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
