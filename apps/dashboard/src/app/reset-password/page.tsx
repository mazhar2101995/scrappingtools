'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token');
    const em = searchParams.get('email');
    if (t) setToken(t);
    if (em) setEmail(em);
  }, [searchParams]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError('Password reset token is missing. Please check your reset link or request a new one.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await apiClient.resetPassword(token, email, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
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
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Set New Password</h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Create a secure new password for your account.
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

          {success ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Password Updated Successfully!</span>
              </div>
              <p className="leading-relaxed">
                Your password has been reset securely. You can now log in using your new credentials.
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-bold text-slate-950 bg-[#fad982] hover:bg-[#f6cd64] transition"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste reset token if not in URL"
                  className="w-full px-3 py-2 bg-slate-50 border border-[#dbdade] rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-[#dbdade] rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-[#dbdade] rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold text-slate-950 bg-[#fad982] hover:bg-[#f6cd64] transition shadow-sm disabled:opacity-50"
              >
                <span>{loading ? 'Updating Password...' : 'Save New Password'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-2">
                <Link href="/login" className="text-xs text-slate-500 font-bold hover:text-[#0d2a2c]">
                  Cancel and return to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center text-xs text-slate-500">Loading form...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
