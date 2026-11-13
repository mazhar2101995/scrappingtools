'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  Edit,
  Sliders,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  Calculator,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function PricingRulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Simulator State
  const [simSupplierPrice, setSimSupplierPrice] = useState('45.00');
  const [simBrandId, setSimBrandId] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [markupType, setMarkupType] = useState('PERCENTAGE');
  const [markupValue, setMarkupValue] = useState('30.00');
  const [fixedShippingFee, setFixedShippingFee] = useState('5.00');
  const [minMarginAmount, setMinMarginAmount] = useState('8.00');
  const [roundingMode, setRoundingMode] = useState('PSYCHOLOGICAL_99');
  const [minSupplierPrice, setMinSupplierPrice] = useState('');
  const [maxSupplierPrice, setMaxSupplierPrice] = useState('');
  const [brandId, setBrandId] = useState('');
  const [priority, setPriority] = useState(10);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMsg('');
      const [rulesList, brandsList] = await Promise.all([
        apiClient.getPricingRules(),
        apiClient.getBrands(),
      ]);
      setRules(rulesList);
      setBrands(Array.isArray(brandsList) ? brandsList : []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load pricing rules');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreateModal() {
    setEditingRuleId(null);
    setName('Standard Profit Margin');
    setMarkupType('PERCENTAGE');
    setMarkupValue('30.00');
    setFixedShippingFee('5.00');
    setMinMarginAmount('8.00');
    setRoundingMode('PSYCHOLOGICAL_99');
    setMinSupplierPrice('');
    setMaxSupplierPrice('');
    setBrandId('');
    setPriority(10);
    setIsActive(true);
    setShowModal(true);
  }

  function handleOpenEditModal(rule: any) {
    setEditingRuleId(rule.id);
    setName(rule.name);
    setMarkupType(rule.markupType);
    setMarkupValue(rule.markupValue);
    setFixedShippingFee(rule.fixedShippingFee || '0.00');
    setMinMarginAmount(rule.minMarginAmount || '');
    setRoundingMode(rule.roundingMode || 'PSYCHOLOGICAL_99');
    setMinSupplierPrice(rule.minSupplierPrice || '');
    setMaxSupplierPrice(rule.maxSupplierPrice || '');
    setBrandId(rule.brandId || '');
    setPriority(rule.priority || 10);
    setIsActive(rule.isActive);
    setShowModal(true);
  }

  async function handleSubmitRule(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg('');
      const payload = {
        name,
        markupType,
        markupValue: parseFloat(markupValue) || 0,
        fixedShippingFee: parseFloat(fixedShippingFee) || 0,
        minMarginAmount: minMarginAmount ? parseFloat(minMarginAmount) : null,
        roundingMode,
        minSupplierPrice: minSupplierPrice ? parseFloat(minSupplierPrice) : null,
        maxSupplierPrice: maxSupplierPrice ? parseFloat(maxSupplierPrice) : null,
        brandId: brandId || null,
        priority: Number(priority) || 10,
        isActive,
      };

      if (editingRuleId) {
        await apiClient.updatePricingRule(editingRuleId, payload);
        setSuccessMsg('Pricing rule updated successfully');
      } else {
        await apiClient.createPricingRule(payload);
        setSuccessMsg('New pricing rule created successfully');
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteRule(id: string, ruleName: string) {
    if (!confirm(`Are you sure you want to delete rule "${ruleName}"?`)) return;
    try {
      await apiClient.deletePricingRule(id);
      setSuccessMsg('Pricing rule deleted');
      loadData();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  }

  async function handleRunSimulation() {
    try {
      setSimulating(true);
      const res = await apiClient.simulatePricingRule({
        supplierPrice: parseFloat(simSupplierPrice) || 0,
        brandId: simBrandId || undefined,
      });
      setSimResult(res.result);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="space-y-6 w-full font-sans text-slate-800 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Automated Pricing &amp; Markup Rules</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Define dynamic margin formulas, psychological price rounding (.99/.95), and shipping add-ons before exporting to stores.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Pricing Rule</span>
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

      {/* Interactive Margin Calculator / Simulator Widget */}
      <div className="bg-gradient-to-br from-[#0d2a2c] to-[#164144] p-5 rounded-2xl text-white shadow-md border border-[#1d4c50]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#fad982]">
              <Calculator className="w-4 h-4" />
              <span>LIVE PROFIT MARGIN SIMULATOR</span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Test how your active rules calculate final store retail prices from supplier cost.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs font-medium">
              <span className="text-slate-300 text-[11px]">Supplier Cost: $</span>
              <input
                type="number"
                step="0.01"
                value={simSupplierPrice}
                onChange={(e) => setSimSupplierPrice(e.target.value)}
                className="w-20 bg-transparent text-[#fad982] font-bold font-mono focus:outline-none"
              />
            </div>

            <select
              value={simBrandId}
              onChange={(e) => setSimBrandId(e.target.value)}
              className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-white focus:outline-none"
            >
              <option value="" className="text-slate-900">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id} className="text-slate-900">{b.name}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={simulating}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{simulating ? 'Calculating...' : 'Test Formula'}</span>
            </button>
          </div>
        </div>

        {simResult && (
          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-300 block font-medium">Calculated Retail Price</span>
              <span className="text-lg font-black text-[#fad982] font-mono">${simResult.calculatedPrice}</span>
              <span className="text-[10px] text-slate-300 block mt-0.5">Rule: {simResult.appliedRuleName || 'Default'}</span>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-300 block font-medium">Net Profit Margin</span>
              <span className="text-lg font-black text-emerald-400 font-mono">+${simResult.marginAmount}</span>
              <span className="text-[10px] text-emerald-300 block mt-0.5">({simResult.marginPercent}% margin)</span>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-300 block font-medium">Base Markup Added</span>
              <span className="text-lg font-bold text-white font-mono">+${simResult.breakdown?.baseMarkup || 0}</span>
              <span className="text-[10px] text-slate-300 block mt-0.5">Supplier: ${simResult.supplierPrice}</span>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-300 block font-medium">Fixed Shipping / Handling</span>
              <span className="text-lg font-bold text-white font-mono">+${simResult.breakdown?.shippingFee || 0}</span>
              <span className="text-[10px] text-slate-300 block mt-0.5">Rounded to .99/.95</span>
            </div>
          </div>
        )}
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0d2a2c]" />
            <h2 className="font-bold text-sm text-slate-900">Active Pricing Formulas ({rules.length})</h2>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading pricing rules...</div>
          ) : rules.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No custom pricing rules configured yet. Click &quot;New Pricing Rule&quot; to set your margins.
            </div>
          ) : (
            rules.map((r) => (
              <div key={r.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{r.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                      {r.isActive ? 'ACTIVE' : 'PAUSED'}
                    </span>
                    {r.brandName && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                        Brand: {r.brandName}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-slate-700">
                      Markup: {r.markupType === 'PERCENTAGE' ? `+${r.markupValue}%` : r.markupType === 'FIXED' ? `+$${r.markupValue}` : `${r.markupValue}x`}
                    </span>
                    <span>•</span>
                    <span>Shipping: +${r.fixedShippingFee || '0.00'}</span>
                    <span>•</span>
                    <span>Rounding: {r.roundingMode}</span>
                    {r.minMarginAmount && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold">Min Profit: ${r.minMarginAmount}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(r)}
                    className="p-1.5 text-slate-500 hover:text-[#0d2a2c] hover:bg-slate-100 rounded-lg transition"
                    title="Edit rule"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRule(r.id, r.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create / Edit Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  {editingRuleId ? 'Edit Pricing Rule' : 'Create Dynamic Pricing Rule'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard 30% Margin + Shipping"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Markup Calculation Type</label>
                  <select
                    value={markupType}
                    onChange={(e) => setMarkupType(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  >
                    <option value="PERCENTAGE">Percentage (+30%)</option>
                    <option value="FIXED">Fixed Amount (+$15.00)</option>
                    <option value="MULTIPLIER">Multiplier (1.4x)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Markup Value</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={markupValue}
                    onChange={(e) => setMarkupValue(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fixed Shipping / Handling Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fixedShippingFee}
                    onChange={(e) => setFixedShippingFee(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Minimum Margin Floor ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Optional (e.g. 8.00)"
                    value={minMarginAmount}
                    onChange={(e) => setMinMarginAmount(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Psychological Price Rounding</label>
                <select
                  value={roundingMode}
                  onChange={(e) => setRoundingMode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                >
                  <option value="PSYCHOLOGICAL_99">End in .99 (e.g. $49.99)</option>
                  <option value="PSYCHOLOGICAL_95">End in .95 (e.g. $49.95)</option>
                  <option value="NEAREST_WHOLE">Nearest Whole Dollar (e.g. $50.00)</option>
                  <option value="NONE">Exact Cent (No Rounding)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Brand Scope (Optional)</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                >
                  <option value="">Apply to Entire Organization Catalog</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-[#0d2a2c] accent-[#0d2a2c]"
                  />
                  <span>Rule is Active</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Pricing Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

