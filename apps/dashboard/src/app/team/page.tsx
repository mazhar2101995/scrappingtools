'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function TeamPermissionsPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Updating role state
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    loadTeamData();
  }, []);

  async function loadTeamData() {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await apiClient.getMyTeam();
      setMembers(data.members || []);
      setInvitations(data.invitations || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    try {
      setSubmittingInvite(true);
      setErrorMsg('');
      const res = await apiClient.inviteTeamMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setSuccessMsg(`Invitation successfully created for ${inviteEmail}`);
      if (res.inviteUrl) {
        setGeneratedInviteUrl(res.inviteUrl);
      } else {
        setShowInviteModal(false);
        setInviteEmail('');
      }
      loadTeamData();
    } catch (err: any) {
      alert(`Invite error: ${err.message}`);
    } finally {
      setSubmittingInvite(false);
    }
  }

  async function handleUpdateRole(membershipId: string, newRole: string) {
    try {
      setUpdatingId(membershipId);
      await apiClient.updateMemberRole(membershipId, newRole);
      setSuccessMsg('Member role updated successfully');
      loadTeamData();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRemoveMember(membershipId: string, name: string) {
    if (!confirm(`Are you sure you want to remove ${name} from this organization?`)) {
      return;
    }

    try {
      setRemovingId(membershipId);
      await apiClient.removeTeamMember(membershipId);
      setSuccessMsg('Team member removed');
      loadTeamData();
    } catch (err: any) {
      alert(`Remove error: ${err.message}`);
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (!confirm('Revoke this pending invitation?')) return;
    try {
      await apiClient.revokeTeamInvitation(invitationId);
      setSuccessMsg('Invitation revoked');
      loadTeamData();
    } catch (err: any) {
      alert(`Revoke error: ${err.message}`);
    }
  }

  return (
    <div className="space-y-6 w-full font-sans text-slate-800 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#dbdade] pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Team &amp; Role-Based Access</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage your organization collaborators, invite team members, and configure role permissions (Admin, Editor, Viewer).
          </p>
        </div>

        <button
          onClick={() => {
            setShowInviteModal(true);
            setGeneratedInviteUrl(null);
            setInviteEmail('');
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Team Member</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Role Definitions Explainer Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-[#dbdade] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Admin / Owner</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Full permissions: Configure store connections, AI models, manage team seats &amp; billing limits.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#dbdade] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Editor</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Catalog authority: Scrape URLs, enrich descriptions with AI, edit pricing &amp; push products to stores.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-[#dbdade] shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Viewer / Auditor</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Read-only access: View catalog items, monitor live supplier prices, and inspect sync health reports.
          </p>
        </div>
      </div>

      {/* Active Team Members List */}
      <div className="bg-white rounded-xl border border-[#dbdade] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0d2a2c]" />
            <h2 className="font-bold text-sm text-slate-900">Active Workspace Members ({members.length})</h2>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading team members...</div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No team members found.</div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#0d2a2c] text-[#fad982] flex items-center justify-center font-bold text-xs">
                    {(m.fullName || m.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900">{m.fullName || 'User'}</div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{m.email}</span>
                      <span>•</span>
                      <span>Joined {new Date(m.joinedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={m.role}
                      disabled={updatingId === m.id || m.role === 'owner'}
                      onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold capitalize transition ${
                        m.role === 'owner'
                          ? 'bg-amber-50 border-amber-200 text-amber-900 cursor-not-allowed'
                          : m.role === 'admin'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : m.role === 'editor'
                          ? 'bg-blue-50 border-blue-200 text-blue-900'
                          : 'bg-slate-100 border-[#dbdade] text-slate-700'
                      }`}
                    >
                      <option value="owner" disabled>Owner</option>
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>

                  {m.role !== 'owner' && (
                    <button
                      type="button"
                      disabled={removingId === m.id}
                      onClick={() => handleRemoveMember(m.id, m.fullName || m.email)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Remove member from workspace"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pending Invitations Section */}
      <div className="bg-white rounded-xl border border-[#dbdade] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h2 className="font-bold text-sm text-slate-900">Pending Invitations ({invitations.length})</h2>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {invitations.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No pending invitations. Click &quot;Invite Team Member&quot; above to invite colleagues.
            </div>
          ) : (
            invitations.map((inv) => (
              <div key={inv.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                    <span>{inv.email}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                      {inv.role}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold capitalize bg-slate-100 text-slate-600">
                      {inv.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Expires on {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/invite/accept?token=${inv.token}`;
                      navigator.clipboard.writeText(url);
                      alert('Invitation link copied to clipboard!');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#dbdade] text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRevokeInvitation(inv.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Revoke invitation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invite Team Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#dbdade]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0d2a2c]" />
                <h3 className="font-bold text-sm text-slate-900">Invite New Team Member</h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {generatedInviteUrl ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Invitation Link Generated!</span>
                  </div>
                  <p className="text-emerald-800 text-[11px]">
                    Share this unique onboarding link with your teammate to let them accept the invitation and set up their password:
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      readOnly
                      value={generatedInviteUrl}
                      className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-[11px] font-mono text-slate-800 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInviteUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="px-3 py-2 bg-[#0d2a2c] text-[#fad982] rounded-lg text-xs font-bold shrink-0 hover:bg-[#143d40] transition"
                    >
                      {copiedLink ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setGeneratedInviteUrl(null);
                    }}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Teammate Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="colleague@yourcompany.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#dbdade] rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role &amp; Permission Scope
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#dbdade] rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  >
                    <option value="editor">Editor — Can scrape, review, and push products</option>
                    <option value="admin">Admin — Full workspace control &amp; store setup</option>
                    <option value="viewer">Viewer — Read-only catalog auditing</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 rounded-xl border border-[#dbdade] text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInvite}
                    className="px-5 py-2.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {submittingInvite ? (
                      <span>Generating Link...</span>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Send / Generate Invite</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
