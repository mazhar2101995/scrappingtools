'use client';

import React from 'react';
import {
  ShieldCheck,
  Server,
  Database,
  Cpu,
  CheckCircle2,
  Clock,
  HardDrive,
  RefreshCw,
} from 'lucide-react';

const SERVICES = [
  {
    name: 'NestJS REST API Gateway',
    port: 4000,
    status: 'online',
    version: 'v1.0.0',
    type: 'Node.js / Express',
    latency: '14ms',
    uptime: '99.99%',
  },
  {
    name: 'Python Scraping Cascade Engine',
    port: 8000,
    status: 'online',
    version: 'v0.1.0',
    type: 'FastAPI / Pydantic / BS4',
    latency: '38ms',
    uptime: '99.95%',
  },
  {
    name: 'PostgreSQL Multi-Tenant DB',
    port: 5432,
    status: 'online',
    version: '16.8 Alpine',
    type: 'Drizzle ORM / 26 Tables',
    latency: '2ms',
    uptime: '100%',
  },
  {
    name: 'Redis Queue & Distributed Cache',
    port: 6379,
    status: 'online',
    version: '7.4 Alpine',
    type: 'BullMQ Ingestion Queues',
    latency: '1ms',
    uptime: '100%',
  },
];

export default function HealthPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Infrastructure &amp; Cluster Health</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time ping telemetry across REST API, Python cascade workers, PostgreSQL, and BullMQ Redis queues.
          </p>
        </div>
        <div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-750 text-slate-300 hover:text-white transition text-xs">
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            <span>Poll Health Check</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SERVICES.map((srv) => (
          <div
            key={srv.name}
            className="bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{srv.name}</h3>
                    <div className="text-[11px] text-slate-400 font-mono">Port {srv.port} • {srv.type}</div>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {srv.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Roundtrip Latency</div>
                  <div className="font-mono text-emerald-400 font-bold text-sm mt-0.5">{srv.latency}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Service Uptime</div>
                  <div className="font-mono text-sky-400 font-bold text-sm mt-0.5">{srv.uptime}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400 font-mono">
              <span>Build: {srv.version}</span>
              <span className="text-slate-500">Live heartbeat active</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

