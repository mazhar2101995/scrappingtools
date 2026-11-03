'use client';

import React, { useState } from 'react';
import {
  Wrench,
  Play,
  CheckCircle2,
  AlertCircle,
  Code,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export default function ScrapingStudioPage() {
  const [brand, setBrand] = useState('traxxas');
  const [testUrl, setTestUrl] = useState('https://traxxas.com/products/models/electric/slash-4x4-vxl');
  const [cssTitle, setCssTitle] = useState('h1.product-title, .product-single__title');
  const [cssModel, setCssModel] = useState('.part-number, .sku, [data-part-number]');
  const [isRunning, setIsRunning] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);

  const handleTestExtraction = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setPreviewResult({
        status: 'success',
        executionTimeMs: 142,
        strategyUsed: 'BrandProfileExtractor (Traxxas Cascade)',
        extractedData: {
          canonicalTitle: 'Slash 4X4 VXL 1/10 Scale Short Course Truck',
          brand: 'Traxxas',
          modelNumber: '68086-4',
          price: 429.95,
          currency: 'USD',
          eanGtin: '0020334680864',
          extractedAttributes: {
            Drivetrain: 'Shaft-Driven 4WD',
            Motor: 'Velineon 3500 Brushless',
            Scale: '1/10',
          },
          detectedCompatibleModelsCount: 4,
        },
      });
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Scraping Profile Studio</h1>
          <p className="text-sm text-slate-400 mt-1">
            Interactively test, validate, and simulate Python scraping cascade rules and CSS selectors against live targets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Profile Configuration Form */}
        <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-sky-400" />
            <span>Profile Rules &amp; Selectors</span>
          </h3>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Target Brand Profile</label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-750 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="traxxas">Traxxas (traxxas.com)</option>
              <option value="xray">Xray (teamxray.com)</option>
              <option value="bittydesign">Bittydesign (bittydesign.net)</option>
              <option value="generic">Generic Cascade (JSON-LD + OpenGraph Fallback)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Target Product URL</label>
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-750 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Title CSS Selector</label>
            <input
              type="text"
              value={cssTitle}
              onChange={(e) => setCssTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-750 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Part / Model Number Selector</label>
            <input
              type="text"
              value={cssModel}
              onChange={(e) => setCssModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-750 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={handleTestExtraction}
              disabled={isRunning}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Simulating Extraction Pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Execute Extraction Test</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Live Preview Console */}
        <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <Code className="w-4 h-4 text-emerald-400" />
              <span>Extraction Result Inspection</span>
            </h3>
            {previewResult && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {previewResult.executionTimeMs}ms
              </span>
            )}
          </div>

          <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-lg p-4 font-mono text-xs overflow-y-auto">
            {previewResult ? (
              <pre className="text-slate-300 whitespace-pre-wrap">
                {JSON.stringify(previewResult, null, 2)}
              </pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center py-12">
                <Sparkles className="w-8 h-8 mb-2 opacity-50" />
                <p>Click &quot;Execute Extraction Test&quot; to inspect parsed JSON payload</p>
                <span className="text-[11px] text-slate-600 mt-1">Cascades through JSON-LD, OpenGraph, and Brand CSS rules</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

