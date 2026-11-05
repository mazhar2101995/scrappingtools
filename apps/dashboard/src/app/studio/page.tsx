'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wrench,
  Play,
  CheckCircle2,
  AlertCircle,
  Code,
  Layers,
  Sparkles,
  ArrowRight,
  MousePointerClick,
  Award,
  Globe,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ScrapingStudioPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [testUrl, setTestUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewResult, setPreviewResult] = useState<any>(null);

  useEffect(() => {
    async function init() {
      try {
        setLoadingBrands(true);
        const list = await apiClient.getBrands();
        const cleanList = Array.isArray(list) ? list : [];
        setBrands(cleanList);
        if (cleanList.length > 0) {
          setSelectedBrandId(cleanList[0].id);
          const firstSource = Array.isArray(cleanList[0].sourceConfigs) && cleanList[0].sourceConfigs[0]?.url;
          setTestUrl(firstSource || cleanList[0].officialWebsite || '');
        }
      } catch (err: any) {
        setErrorMsg('Failed to load brand profiles: ' + err.message);
      } finally {
        setLoadingBrands(false);
      }
    }
    init();
  }, []);

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);

  const handleBrandChange = (id: string) => {
    setSelectedBrandId(id);
    const b = brands.find((x) => x.id === id);
    if (b) {
      const firstSource = Array.isArray(b.sourceConfigs) && b.sourceConfigs[0]?.url;
      setTestUrl(firstSource || b.officialWebsite || '');
    }
  };

  const handleTestExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrandId || !testUrl.trim()) return;

    try {
      setIsRunning(true);
      setErrorMsg('');
      setPreviewResult(null);

      const startTime = performance.now();
      const res = await apiClient.testBrandMapping(selectedBrandId, {
        sampleUrl: testUrl.trim(),
        mappings: selectedBrand?.fieldMappings || [],
      });
      const endTime = performance.now();

      setPreviewResult({
        ...res,
        executionTimeMs: Math.round(endTime - startTime),
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Real extraction execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Scraping Studio &amp; Selector Debugger</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Execute real-time scraping tests against live brand URLs using dynamic database mappings and selector health auditing.
          </p>
        </div>
        {selectedBrand && (
          <Link
            href={`/brands/${selectedBrand.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold hover:bg-amber-100 transition"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" />
            <span>Tune {selectedBrand.name} Profile</span>
          </Link>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Real Configuration Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#0d2a2c]" />
            <span>Live Extraction Sandbox</span>
          </h2>

          <form onSubmit={handleTestExtraction} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Brand Profile</label>
              {loadingBrands ? (
                <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-400 animate-pulse">Loading brands...</div>
              ) : (
                <select
                  value={selectedBrandId}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.fieldMappings?.length || 0} mapped selectors)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Live Target URL</label>
              <input
                type="url"
                required
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="https://brand.com/products/item-detail"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white"
              />
            </div>

            {selectedBrand && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Active Database Mappings ({selectedBrand.fieldMappings?.length || 0})</span>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {(selectedBrand.fieldMappings || []).map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-800">{m.targetField}</span>
                      <span className="font-mono text-[10px] text-slate-500 truncate max-w-[180px]">{m.sourceValue}</span>
                    </div>
                  ))}
                  {(!selectedBrand.fieldMappings || selectedBrand.fieldMappings.length === 0) && (
                    <div className="text-[11px] text-slate-400 italic p-1">No mappings configured. Head to Brand Profiles to add selectors.</div>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isRunning || !selectedBrandId || !testUrl.trim()}
              className="w-full py-2.5 px-4 bg-[#fad982] hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Fetching &amp; Evaluating Real Selectors...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-slate-950" />
                  <span>Execute Real Scraping Test</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Live Extraction Execution Results */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Code className="w-4 h-4 text-[#0d2a2c]" />
              <span>Real Extracted Payload &amp; Observability</span>
            </h2>
            {previewResult && (
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                {previewResult.executionTimeMs}ms execution
              </span>
            )}
          </div>

          {!previewResult && !isRunning && (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
              <Sparkles className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Zero Fake Simulation</p>
              <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                Click &ldquo;Execute Real Scraping Test&rdquo; to fetch the live HTML page, execute Cheerio CSS extractions, and record selector health status.
              </p>
            </div>
          )}

          {isRunning && (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
              <p className="text-xs font-bold text-slate-800">Dispatching HTTP Reader...</p>
              <p className="text-[11px] text-slate-500 mt-1">Bypassing anti-bot barriers &bull; Testing mapped selectors</p>
            </div>
          )}

          {previewResult && (
            <div className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="font-bold text-slate-900">{previewResult.brandName}</span>
                  <span className="text-[10px] text-slate-500 block">Total Mappings: {previewResult.totalConfiguredMappings}</span>
                </div>
                <div className="text-right">
                  <span className="text-emerald-700 font-bold">{previewResult.successfulFieldsCount} Successful</span>
                  <span className="text-[10px] text-slate-400 block">Evaluated: {previewResult.evaluatedFieldsCount}</span>
                </div>
              </div>

              <div className="bg-slate-900 text-amber-300 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-80 overflow-y-auto shadow-inner">
                <pre>{JSON.stringify(previewResult.results, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
