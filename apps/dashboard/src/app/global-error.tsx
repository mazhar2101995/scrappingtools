'use client';

import { useEffect, useState } from 'react';
import { reportFrontendError } from '@/lib/error-reporter';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootGlobalError({ error, reset }: GlobalErrorProps) {
  const [referenceId, setReferenceId] = useState<string | null>(null);

  useEffect(() => {
    reportFrontendError({
      errorName: error.name || 'RootGlobalError',
      errorMessage: error.message,
      stackTrace: error.stack,
      severity: 'critical',
      context: {
        digest: error.digest,
      },
    }).then((refId) => {
      if (refId) setReferenceId(refId);
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-gray-50 p-6 font-sans text-gray-900">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Application Error</h1>
          <p className="mb-4 text-sm text-gray-600">
            A critical system error prevented the application shell from rendering.
          </p>

          {referenceId && (
            <div className="mb-6 rounded-md bg-gray-100 p-3 text-left">
              <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Incident Reference ID
              </span>
              <code className="text-sm font-mono font-bold text-gray-800">{referenceId}</code>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <button
              onClick={() => reset()}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Reload View
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Hard Refresh
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
