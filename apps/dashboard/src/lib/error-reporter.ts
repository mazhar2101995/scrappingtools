const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface FrontendErrorReport {
  errorName?: string;
  errorMessage: string;
  stackTrace?: string;
  componentStack?: string;
  url?: string;
  severity?: 'critical' | 'error' | 'warning' | 'info';
  context?: Record<string, unknown>;
}

/**
 * Redact sensitive fields from an object or string before sending
 */
function sanitizeData(data: unknown): unknown {
  if (typeof data === 'string') {
    return data.replace(/(password|secret|token|api[_-]?key|auth)=[^&]+/gi, '$1=[REDACTED]');
  }
  if (data && typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(sanitizeData);
    }
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (/password|secret|token|apiKey|api_key|authorization|cookie/i.test(k)) {
        clean[k] = '[REDACTED]';
      } else {
        clean[k] = sanitizeData(v);
      }
    }
    return clean;
  }
  return data;
}

/**
 * Send an error report to the centralized backend error telemetry service
 */
export async function reportFrontendError(report: FrontendErrorReport): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    let token = '';
    let orgId = '';
    let userId = '';

    try {
      token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      orgId = localStorage.getItem('activeOrganizationId') || '';
      // Attempt to parse JWT to extract userId
      if (token) {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const payload = JSON.parse(atob(payloadBase64));
          userId = payload.userId || payload.sub || '';
          if (!orgId) orgId = payload.orgId || payload.organizationId || '';
        }
      }
    } catch {
      // Ignore token decode errors
    }

    const payload = {
      source: 'frontend',
      severity: report.severity || 'error',
      errorName: report.errorName || 'ClientError',
      errorMessage: report.errorMessage || 'Unknown client error',
      stackTrace: report.stackTrace || report.componentStack,
      httpPath: report.url || (typeof window !== 'undefined' ? window.location.pathname : undefined),
      organizationId: orgId || undefined,
      userId: userId || undefined,
      context: sanitizeData({
        ...report.context,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        href: typeof window !== 'undefined' ? window.location.href : undefined,
        timestamp: new Date().toISOString(),
      }),
    };

    const res = await fetch(`${API_BASE_URL}/telemetry/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      return data.errorReferenceId || null;
    }
  } catch (err) {
    // Avoid recursive error logging loops if telemetry endpoint is unreachable
    console.warn('[ErrorReporter] Failed to send error telemetry:', err);
  }

  return null;
}

/**
 * Initialize global unhandled error and rejection listeners
 */
export function initGlobalErrorListeners(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportFrontendError({
      errorName: event.error?.name || 'UncaughtError',
      errorMessage: event.message || event.error?.message || 'Uncaught error event',
      stackTrace: event.error?.stack,
      severity: 'error',
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const isError = reason instanceof Error;
    reportFrontendError({
      errorName: isError ? reason.name : 'UnhandledRejection',
      errorMessage: isError ? reason.message : String(reason),
      stackTrace: isError ? reason.stack : undefined,
      severity: 'error',
      context: {
        reasonType: typeof reason,
      },
    });
  });
}
