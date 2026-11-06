'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Mail,
  Building2,
  Shield,
  KeyRound,
  CheckCircle2,
  Save,
  ArrowLeft,
  Calendar,
  Lock
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ProfilePage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [role, setRole] = useState('Organization Member');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saas_current_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (u.fullName) setFullName(u.fullName);
          if (u.email) setEmail(u.email);
        } catch (_) {}
      }
      const storedOrg = localStorage.getItem('saas_current_org_name');
      if (storedOrg) setOrganizationName(storedOrg);

      apiClient.getClientWorkspace().then((ws) => {
        if (ws?.organization?.name) {
          setOrganizationName(ws.organization.name);
        }
      }).catch(() => {});
    }
  }, []);

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    setTimeout(() => {
      setLoading(false);
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('saas_current_user');
        const userObj = stored ? JSON.parse(stored) : {};
        userObj.fullName = fullName;
        localStorage.setItem('saas_current_user', JSON.stringify(userObj));
      }
      setSuccessMessage('Profile details updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    }, 400);
  }

  function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    if (!currentPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage('Password changed successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    }, 600);
  }

  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'MC';

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-sans text-slate-800">
      {/* Header Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </Link>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">User Profile & Account</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage your personal credentials, contact info, and workspace authentication credentials.
          </p>
        </div>

        {successMessage && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* Profile Card Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-[#0d2a2c] text-[#fad982] font-black text-xl flex items-center justify-center shadow-md">
          {initials}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">{fullName}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#fad982] text-slate-950 uppercase tracking-wider">
              {role}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {email}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              {organizationName}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Information Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-[#0d2a2c]" />
            <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Work Email Address
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-medium text-slate-500 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Email address cannot be changed directly. Contact support for organization ownership transfer.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Workspace / Organization
              </label>
              <input
                type="text"
                value={organizationName}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-medium text-slate-500 cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl font-bold text-xs bg-[#0d2a2c] text-white hover:bg-[#143d40] transition shadow flex items-center justify-center gap-2"
            >
              <Save className="w-3.5 h-3.5 text-[#fad982]" />
              <span>{loading ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-[#0d2a2c]" />
            <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
                required
              />
            </div>

            <div className="pt-1 flex items-center justify-between text-xs">
              <Link href="/forgot-password" className="text-slate-500 hover:text-[#0d2a2c] hover:underline font-semibold">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#fad982] text-slate-950 hover:bg-amber-300 transition shadow flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-950" />
              <span>Update Password</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

