'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Mail,
  Calendar,
  CheckCircle2,
  X,
  MoreVertical,
  Building2
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function TeamPermissionsPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  useEffect(() => {
    async function loadTeam() {
      try {
        setLoading(true);
        const list = await apiClient.getMyTeam();
        setMembers(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadTeam();
  }, []);

  return (
    <div className="space-y-6 w-full font-sans text-slate-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Team &amp; Workspace Permissions</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage organization collaborators, invite team members, and assign role-based access controls (RBAC).
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-lg shadow-sm transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Team Member</span>
        </button>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Invite Team Collaborator</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setShowInviteModal(false); }} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Colleague Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Access Role *</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                >
                  <option value="member">Member (Catalog View &amp; Search)</option>
                  <option value="editor">Editor (Scraping &amp; AI Enrichment)</option>
                  <option value="admin">Admin (Full Workspace Management)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-[#0d2a2c] text-white rounded-lg hover:bg-[#143d40]"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Active Workspace Members ({members.length})</h3>
          <span className="text-xs font-bold text-slate-400">Strict Tenant Isolation</span>
        </div>

        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th className="py-3.5 px-5">Member Name</th>
              <th className="py-3.5 px-4">Email Address</th>
              <th className="py-3.5 px-4">Workspace Role</th>
              <th className="py-3.5 px-5 text-right">Joined Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400">Loading workspace team members...</td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-400">No team members found.</td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#0d2a2c] text-[#fad982] font-bold text-xs flex items-center justify-center">
                        {m.fullName?.substring(0, 2).toUpperCase() || 'US'}
                      </div>
                      <span className="font-bold text-slate-900">{m.fullName}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-600">{m.email}</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {m.role}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-right text-slate-400 font-sans">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

