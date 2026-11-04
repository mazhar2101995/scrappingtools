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
  ArrowRight
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
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Scraping Studio &amp; Rule Builder</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Test CSS selectors, evaluate anti-bot bypassing strategies, and preview normalized canonical product payloads.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Form in Clean Brand Style */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Test Extraction Parameters</h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Manufacturer / Domain</label>
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">CSS Selector: Product Title</label>
            <input
              type="text"
              value={cssTitle}
              onChange={(e) => setCssTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">CSS Selector: Model / Part Number</label>
            <input
              type="text"
              value={cssModel}
              onChange={(e) => setCssModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
            />
          </div>

          <button
            onClick={handleTestExtraction}
            disabled={isRunning}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-lg transition shadow-sm disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>{isRunning ? 'Running Cascade Test...' : 'Run Extraction Test'}</span>
          </button>
        </div>

        {/* Right Preview Box in Clean Brand Style */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Extracted Payload Preview</h3>

          {previewResult ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-bold flex items-center justify-between">
                <span>Extraction Complete ({previewResult.executionTimeMs}ms)</span>
                <span>Strategy: Playwright Cascade</span>
              </div>
              <pre className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-800 overflow-x-auto leading-relaxed">
                {JSON.stringify(previewResult.extractedData, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="py-24 text-center text-xs text-slate-400">
              Configure selectors on the left and click "Run Extraction Test" to preview the live JSON output.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
