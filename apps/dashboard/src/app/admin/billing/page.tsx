'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Building2,
  Users,
  CheckCircle2,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Download,
  Plus,
  Sliders,
  Settings2,
  ToggleLeft,
  ToggleRight,
  KeyRound,
  History,
  Lock,
  AlertTriangle,
  FileText,
  Search,
  Check,
  X,
  ExternalLink
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AdminRevenueBillingPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'plans' | 'builder' | 'subscriptions' | 'gateways' | 'audit'>('overview');
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any | null>(null);
  const [servicesList, setServicesList] = useState<any[]>([]);
  const [plansList, setPlansList] = useState<any[]>([]);
  const [subscriptionsList, setSubscriptionsList] = useState<any[]>([]);
  const [gatewaysList, setGatewaysList] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal / Form States
  const [newServiceModalOpen, setNewServiceModalOpen] = useState(false);
  const [newPlanModalOpen, setNewPlanModalOpen] = useState(false);
  const [assignPlanModalOpen, setAssignPlanModalOpen] = useState(false);
  const [selectedOrgForAssign, setSelectedOrgForAssign] = useState<any | null>(null);
  const [assignPlanForm, setAssignPlanForm] = useState({ planId: '', reason: '' });

  // New Service Form State
  const [serviceForm, setServiceForm] = useState({
    code: '',
    name: '',
    description: '',
    category: 'scraping',
    unit: 'URLs',
    metricType: 'count',
    supportsUnlimited: true,
    defaultResetPeriod: 'monthly',
    isGloballyActive: true,
  });

  // Dynamic Plan Builder Form State
  const [planForm, setPlanForm] = useState<any>({
    id: '',
    code: '',
    name: '',
    description: '',
    planType: 'paid',
    priceMonthly: 79,
    priceAnnual: 750,
    currency: 'USD',
    billingCycle: 'monthly',
    isActive: true,
    isPublic: true,
    features: ['Custom feature bullet 1', 'Dedicated support'],
    entitlements: {},
  });

  async function loadAllData() {
    try {
      setLoading(true);
      const [revRes, svcRes, plansRes, subsRes, gwRes, logsRes] = await Promise.all([
        apiClient.getAdminRevenue().catch(() => null),
        apiClient.getAdminServices().catch(() => ({ services: [] })),
        apiClient.getAdminPlans().catch(() => ({ plans: [] })),
        apiClient.getAdminSubscriptions().catch(() => ({ subscriptions: [] })),
        apiClient.getAdminPaymentGateways().catch(() => ({ gateways: [] })),
        apiClient.getAdminBillingAuditLogs().catch(() => ({ logs: [] })),
      ]);

      setRevenueData(revRes);
      setServicesList(svcRes?.services || []);
      setPlansList(plansRes?.plans || []);
      setSubscriptionsList(subsRes?.subscriptions || []);
      setGatewaysList(gwRes?.gateways || []);
      setAuditLogsList(logsRes?.logs || []);

      // Initialize plan builder entitlements
      const initialEnts: Record<string, any> = {};
      (svcRes?.services || []).forEach((s: any) => {
        initialEnts[s.code] = {
          serviceCode: s.code,
          isEnabled: true,
          isUnlimited: false,
          usageLimit: 100,
          resetPeriod: s.defaultResetPeriod || 'monthly',
        };
      });
      setPlanForm((prev: any) => ({ ...prev, entitlements: initialEnts }));
    } catch (e: any) {
      console.error(e);
      setNotification({ type: 'error', message: e.message || 'Failed to load billing configuration' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  async function handleToggleGlobalService(serviceId: string, currentStatus: boolean) {
    try {
      await apiClient.updateAdminService(serviceId, { isGloballyActive: !currentStatus });
      setNotification({ type: 'success', message: `Service ${serviceId} global status updated.` });
      const svcRes = await apiClient.getAdminServices();
      setServicesList(svcRes?.services || []);
    } catch (e: any) {
      setNotification({ type: 'error', message: `Failed to update service: ${e.message}` });
    }
  }

  async function handleCreateService(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiClient.createAdminService(serviceForm);
      setNotification({ type: 'success', message: `Service "${serviceForm.name}" registered successfully.` });
      setNewServiceModalOpen(false);
      const svcRes = await apiClient.getAdminServices();
      setServicesList(svcRes?.services || []);
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to create service' });
    }
  }

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    try {
      const entitlementsArray = Object.values(planForm.entitlements);
      await apiClient.createAdminPlan({
        ...planForm,
        entitlements: entitlementsArray,
      });
      setNotification({ type: 'success', message: `Subscription Plan "${planForm.name}" created successfully.` });
      setNewPlanModalOpen(false);
      const plansRes = await apiClient.getAdminPlans();
      setPlansList(plansRes?.plans || []);
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to create plan' });
    }
  }

  async function handleAssignPlanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrgForAssign) return;
    try {
      await apiClient.assignAdminPlan(selectedOrgForAssign.organizationId, {
        planId: assignPlanForm.planId,
        reason: assignPlanForm.reason,
      });
      setNotification({ type: 'success', message: `Plan ${assignPlanForm.planId.toUpperCase()} assigned to ${selectedOrgForAssign.organizationName}.` });
      setAssignPlanModalOpen(false);
      const subsRes = await apiClient.getAdminSubscriptions();
      setSubscriptionsList(subsRes?.subscriptions || []);
      const logsRes = await apiClient.getAdminBillingAuditLogs();
      setAuditLogsList(logsRes?.logs || []);
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to assign plan' });
    }
  }

  async function handleToggleGatewayMode(gatewayId: string, currentMode: string) {
    const nextMode = currentMode === 'test' ? 'live' : 'test';
    try {
      await apiClient.updateAdminPaymentGateway(gatewayId, { mode: nextMode });
      setNotification({ type: 'success', message: `Payment Gateway ${gatewayId} switched to ${nextMode.toUpperCase()} mode.` });
      const gwRes = await apiClient.getAdminPaymentGateways();
      setGatewaysList(gwRes?.gateways || []);
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to update gateway' });
    }
  }

  async function handleTestGateway(gatewayId: string) {
    try {
      const res = await apiClient.testAdminPaymentGateway(gatewayId);
      setNotification({ type: 'success', message: `Gateway Connectivity Test: ${res.details}` });
      const gwRes = await apiClient.getAdminPaymentGateways();
      setGatewaysList(gwRes?.gateways || []);
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Failed to test gateway' });
    }
  }

  const mrr = revenueData?.mrr || 0;
  const arr = revenueData?.arr || 0;
  const arpu = revenueData?.arpu || 0;
  const totalTenants = revenueData?.totalTenants || 0;

  return (
    <div className="space-y-6 w-full font-sans pb-16">
      {/* Header */}
      <div className="p-7 rounded-xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              CENTRAL SUBSCRIPTION & REVENUE ARCHITECTURE
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges Active</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Subscription Plans, Services & Payment Gateways
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Centralized database-authoritative control over platform service catalogue, dynamic subscription tiers, quotas, reset periods, and payment gateways.
          </p>
        </div>

        <button
          onClick={loadAllData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-[#7a5e12] transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh All</span>
        </button>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#dbdade] pb-2 overflow-x-auto text-xs font-bold">
        {[
          { id: 'overview', label: 'Financial Overview', icon: DollarSign },
          { id: 'services', label: `Service Catalogue (${servicesList.length})`, icon: Sliders },
          { id: 'plans', label: `Subscription Plans (${plansList.length})`, icon: Layers },
          { id: 'subscriptions', label: `Customer Subscriptions (${subscriptionsList.length})`, icon: Users },
          { id: 'gateways', label: 'Payment Gateways', icon: CreditCard },
          { id: 'audit', label: 'Billing Audit Logs', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
                isActive
                  ? 'bg-[#0d2a2c] text-[#fad982] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: FINANCIAL OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white border border-[#ebdcb9] shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
                <span className="text-[10px] uppercase font-bold tracking-wider">Monthly Recurring (MRR)</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono">
                ${mrr.toLocaleString()}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Normalized active subscriptions</span>
                <span className="text-emerald-600 font-bold font-mono">Real-time</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#ebdcb9] shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
                <span className="text-[10px] uppercase font-bold tracking-wider">Annual Run Rate (ARR)</span>
                <div className="w-8 h-8 rounded-xl bg-[#faf4e1] border border-[#ecdba8] flex items-center justify-center text-[#9c7f23]">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-[#876b17] font-mono">
                ${arr.toLocaleString()}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Annualized run-rate projection</span>
                <span className="text-slate-600 font-mono">12x MRR</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#ebdcb9] shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
                <span className="text-[10px] uppercase font-bold tracking-wider">Active Tenants</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono">
                {totalTenants}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Total Organizations</span>
                <span className="text-blue-600 font-bold font-mono">Multi-Tenant</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#ebdcb9] shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
                <span className="text-[10px] uppercase font-bold tracking-wider">Total Paid Revenue</span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono">
                ${(revenueData?.totalPaidRevenueUsd || 0).toLocaleString()}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Processed via Invoices</span>
                <span className="text-purple-600 font-bold font-mono">Paid</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CENTRAL SERVICE CATALOGUE */}
      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Platform Service Catalogue</h2>
              <p className="text-xs text-slate-500">
                Central registry of all discoverable services and metered features across the SaaS platform.
              </p>
            </div>
            <button
              onClick={() => setNewServiceModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0d2a2c] text-[#fad982] hover:bg-[#153f42] transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Service</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#dbdade] shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-[#dbdade] text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Service Name & Code</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Metric & Unit</th>
                  <th className="py-3 px-4">Default Reset</th>
                  <th className="py-3 px-4">Plans Enrolled</th>
                  <th className="py-3 px-4 text-center">Global Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {servicesList.map((svc) => (
                  <tr key={svc.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{svc.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{svc.code}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {svc.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-700">{svc.unit}</span>
                      <span className="text-[11px] text-slate-400 ml-1">({svc.metricType})</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium capitalize">
                      {svc.defaultResetPeriod}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {svc.plansCount} Plans
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleGlobalService(svc.id, svc.isGloballyActive)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition ${
                          svc.isGloballyActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                      >
                        {svc.isGloballyActive ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Active Globally</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Disabled Globally</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleToggleGlobalService(svc.id, svc.isGloballyActive)}
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 underline"
                      >
                        {svc.isGloballyActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTION PLANS & PLAN BUILDER */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Subscription Plans & Entitlement Builder</h2>
              <p className="text-xs text-slate-500">
                Dynamic plans with independent service limits, unlimited options, and configurable billing cycles.
              </p>
            </div>
            <button
              onClick={() => setNewPlanModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0d2a2c] text-[#fad982] hover:bg-[#153f42] transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Dynamic Plan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plansList.map((plan) => (
              <div key={plan.id} className="p-6 rounded-xl bg-white border border-[#dbdade] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                      {plan.planType}
                    </span>
                    <span className={`text-[10px] font-bold ${plan.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{plan.description}</p>

                  <div className="my-4 pt-3 border-t border-slate-100">
                    <div className="text-2xl font-black text-slate-900 font-mono">
                      ${plan.priceMonthly}
                      <span className="text-xs text-slate-400 font-sans font-normal"> / month</span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      ${plan.priceAnnual} / year
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Entitled Services ({plan.entitlements?.length || 0})
                    </div>
                    {(plan.entitlements || []).slice(0, 5).map((ent: any) => (
                      <div key={ent.serviceCode} className="flex items-center justify-between text-slate-600">
                        <span className="truncate pr-2">{ent.serviceCode}</span>
                        <span className="font-bold font-mono">
                          {ent.isEnabled ? (ent.isUnlimited ? 'Unlimited' : ent.usageLimit.toLocaleString()) : 'Disabled'}
                        </span>
                      </div>
                    ))}
                    {(plan.entitlements?.length || 0) > 5 && (
                      <div className="text-[11px] text-amber-700 font-medium">
                        + {(plan.entitlements?.length || 0) - 5} more service limits
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 font-mono">{plan.id}</span>
                  <button
                    onClick={() => {
                      alert(`Plan limits for "${plan.name}" can be modified directly via the Admin API or Plan Builder.`);
                    }}
                    className="font-bold text-[#0d2a2c] hover:underline"
                  >
                    Configure Limits
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CUSTOMER SUBSCRIPTIONS */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Tenant Subscriptions & Plan Assignments</h2>
              <p className="text-xs text-slate-500">
                View customer plan tiers, subscription status, and manually assign custom plans with audit reasoning.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#dbdade] shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-[#dbdade] text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Current Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Billing Cycle</th>
                  <th className="py-3 px-4">Current Period End</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {subscriptionsList.map((sub) => (
                  <tr key={sub.organizationId} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{sub.organizationName}</div>
                      <div className="text-[11px] font-mono text-slate-400">{sub.organizationId}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#fad982]/30 text-[#7a5e12] border border-[#ebd085]">
                        {sub.planName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        sub.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium capitalize">
                      {sub.billingCycle}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedOrgForAssign(sub);
                          setAssignPlanForm({ planId: sub.planId, reason: 'Administrative plan adjustment' });
                          setAssignPlanModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                      >
                        Assign Plan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PAYMENT GATEWAYS */}
      {activeTab === 'gateways' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Payment Gateway Management</h2>
              <p className="text-xs text-slate-500">
                Configure payment gateways, toggle between Test and Live modes, and configure supported payment methods.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {gatewaysList.map((gw) => (
              <div key={gw.id} className="p-6 rounded-xl bg-white border border-[#dbdade] shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-bold">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900">{gw.name}</h3>
                      <div className="text-[11px] text-slate-400 font-mono">Gateway ID: {gw.id}</div>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    gw.mode === 'test' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {gw.mode.toUpperCase()} MODE
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Gateway Operational Status</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Supported Payment Methods</span>
                    <span className="font-bold text-slate-800">
                      {Array.isArray(gw.supportedPaymentMethods) ? gw.supportedPaymentMethods.join(', ') : 'card'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Supported Currencies</span>
                    <span className="font-bold text-slate-800">
                      {Array.isArray(gw.supportedCurrencies) ? gw.supportedCurrencies.join(', ') : 'USD'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Security Storage</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      Encrypted Server-Side
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleToggleGatewayMode(gw.id, gw.mode)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 hover:bg-slate-50 text-slate-700 transition text-center"
                  >
                    Switch to {gw.mode === 'test' ? 'Live' : 'Test'} Mode
                  </button>
                  <button
                    onClick={() => handleTestGateway(gw.id)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-[#0d2a2c] text-[#fad982] hover:bg-[#153f42] transition text-center"
                  >
                    Test Connectivity
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: BILLING AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">Billing & Subscription Audit Logs</h2>
              <p className="text-xs text-slate-500">
                Immutable record of administrative plan changes, manual assignments, and quota alterations.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#dbdade] shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-[#dbdade] text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Transition</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {auditLogsList.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {log.organizationId?.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {log.previousPlanId || 'none'} &rarr; <span className="font-bold text-emerald-700">{log.newPlanId}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.reason || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {log.actorEmail || 'System Superadmin'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW SERVICE */}
      {newServiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Register New Platform Service</h3>
              <button onClick={() => setNewServiceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateService} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Code (Unique ID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. brand_profiles, supplier_sync"
                  value={serviceForm.code}
                  onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brand Profiles & Monitoring"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Operational scope of this capability"
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={serviceForm.category}
                    onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    <option value="scraping">Scraping</option>
                    <option value="catalog">Catalog</option>
                    <option value="media">Media & Images</option>
                    <option value="ai">AI Processing</option>
                    <option value="stores">Connected Stores</option>
                    <option value="automation">Automation</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quota Unit</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. URLs, Brands, Images"
                    value={serviceForm.unit}
                    onChange={(e) => setServiceForm({ ...serviceForm, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Metric Type</label>
                  <select
                    value={serviceForm.metricType}
                    onChange={(e) => setServiceForm({ ...serviceForm, metricType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    <option value="count">Count Based</option>
                    <option value="tokens">Tokens Based</option>
                    <option value="storage_mb">Storage Based (MB)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Default Reset Period</label>
                  <select
                    value={serviceForm.defaultResetPeriod}
                    onChange={(e) => setServiceForm({ ...serviceForm, defaultResetPeriod: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="never">Never (Lifetime)</option>
                    <option value="yearly">Yearly</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewServiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold bg-[#0d2a2c] text-[#fad982] hover:bg-[#153f42]"
                >
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN PLAN TO CUSTOMER */}
      {assignPlanModalOpen && selectedOrgForAssign && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Assign Subscription Plan</h3>
              <button onClick={() => setAssignPlanModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignPlanSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Tenant Organization</label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800">
                  {selectedOrgForAssign.organizationName}
                  <div className="text-[10px] font-mono font-normal text-slate-400">{selectedOrgForAssign.organizationId}</div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Subscription Plan</label>
                <select
                  required
                  value={assignPlanForm.planId}
                  onChange={(e) => setAssignPlanForm({ ...assignPlanForm, planId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800"
                >
                  {plansList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.priceMonthly}/mo)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Administrative Reason (Audit Logged)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Contract expansion, manual VIP upgrade"
                  value={assignPlanForm.reason}
                  onChange={(e) => setAssignPlanForm({ ...assignPlanForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold bg-[#0d2a2c] text-[#fad982] hover:bg-[#153f42]"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DYNAMIC PLAN BUILDER */}
      {newPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">Dynamic Plan Builder</h3>
                <p className="text-[11px] text-slate-500">Configure independent service limits, unlimited entitlements, and pricing</p>
              </div>
              <button onClick={() => setNewPlanModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Plan ID (Slug)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. growth_tier, agency_plus"
                    value={planForm.id}
                    onChange={(e) => setPlanForm({ ...planForm, id: e.target.value, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Plan Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Growth Accelerator"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Target audience and capability description"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Monthly Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={planForm.priceMonthly}
                    onChange={(e) => setPlanForm({ ...planForm, priceMonthly: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Annual Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={planForm.priceAnnual}
                    onChange={(e) => setPlanForm({ ...planForm, priceAnnual: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Plan Type</label>
                  <select
                    value={planForm.planType}
                    onChange={(e) => setPlanForm({ ...planForm, planType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200"
                  >
                    <option value="paid">Paid</option>
                    <option value="free">Free</option>
                  </select>
                </div>
              </div>

              {/* Individual Service Entitlements Builder */}
              <div className="pt-2">
                <label className="font-bold text-slate-900 block mb-2 text-sm">
                  Independent Service Entitlements & Limits
                </label>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {servicesList.map((svc) => {
                    const ent = planForm.entitlements[svc.code] || {
                      serviceCode: svc.code,
                      isEnabled: true,
                      isUnlimited: false,
                      usageLimit: 50,
                      resetPeriod: svc.defaultResetPeriod || 'monthly',
                    };

                    return (
                      <div key={svc.code} className="p-3 flex items-center justify-between gap-3 bg-white">
                        <div className="w-1/3">
                          <div className="font-bold text-slate-800">{svc.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{svc.unit}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ent.isEnabled}
                              onChange={(e) => {
                                const updated = { ...ent, isEnabled: e.target.checked };
                                setPlanForm({
                                  ...planForm,
                                  entitlements: { ...planForm.entitlements, [svc.code]: updated },
                                });
                              }}
                              className="rounded text-amber-500 focus:ring-0"
                            />
                            <span className="text-[11px] font-semibold text-slate-700">Enabled</span>
                          </label>

                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ent.isUnlimited}
                              onChange={(e) => {
                                const updated = { ...ent, isUnlimited: e.target.checked };
                                setPlanForm({
                                  ...planForm,
                                  entitlements: { ...planForm.entitlements, [svc.code]: updated },
                                });
                              }}
                              className="rounded text-amber-500 focus:ring-0"
                            />
                            <span className="text-[11px] font-semibold text-slate-700">Unlimited</span>
                          </label>
                        </div>

                        <div className="w-24">
                          {!ent.isUnlimited && (
                            <input
                              type="number"
                              disabled={!ent.isEnabled}
                              value={ent.usageLimit}
                              onChange={(e) => {
                                const updated = { ...ent, usageLimit: parseInt(e.target.value) || 0 };
                                setPlanForm({
                                  ...planForm,
                                  entitlements: { ...planForm.entitlements, [svc.code]: updated },
                                });
                              }}
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 text-center font-mono font-bold"
                            />
                          )}
                        </div>

                        <div className="w-24">
                          <select
                            disabled={!ent.isEnabled}
                            value={ent.resetPeriod}
                            onChange={(e) => {
                              const updated = { ...ent, resetPeriod: e.target.value };
                              setPlanForm({
                                ...planForm,
                                entitlements: { ...planForm.entitlements, [svc.code]: updated },
                              });
                            }}
                            className="w-full px-2 py-1 rounded-lg border border-slate-200 text-[11px]"
                          >
                            <option value="monthly">Monthly</option>
                            <option value="never">Never</option>
                            <option value="yearly">Yearly</option>
                            <option value="daily">Daily</option>
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewPlanModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl font-bold bg-[#0d2a2c] text-[#fad982] hover:bg-[#153f42]"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
