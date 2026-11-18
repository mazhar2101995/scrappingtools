'use client';

import { useEffect, useState } from 'react';
import { reportFrontendError } from '@/lib/error-reporter';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorComponent({ error, reset }: ErrorProps) {
  const [referenceId, setReferenceId] = useState<string | null>(null);

  useEffect(() => {
    // Automatically report error to centralized telemetry
    reportFrontendError({
      errorName: error.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      context: {
        digest: error.digest,
      },
    }).then((refId) => {
      if (refId) setReferenceId(refId);
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 max-w-lg shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-600 mb-4">
          An unexpected error occurred while rendering this view. Our engineering team has been notified.
        </p>

        {referenceId && (
          <div className="mb-4 rounded bg-white px-3 py-2 border border-red-100">
            <span className="text-xs text-gray-500">Error Reference ID: </span>
            <code className="text-xs font-mono font-bold text-red-700">{referenceId}</code>
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 transition"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
