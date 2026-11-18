import { Router, Request, Response } from 'express';
import { ErrorTelemetryService } from '../services/error-telemetry.service';
import { authMiddleware, superAdminOnlyMiddleware } from '../middleware/auth.middleware';

export const telemetryRouter = Router();

/**
 * POST /api/v1/telemetry/errors
 * Ingest frontend and client-side error telemetry (Next.js Error Boundaries, window.onerror)
 */
telemetryRouter.post('/errors', async (req: Request, res: Response) => {
  try {
    const {
      errorName,
      errorMessage,
      stackTrace,
      pageUrl,
      httpPath,
      browserInfo,
      organizationId,
      userId,
      userEmail,
      severity,
      extra,
      context,
    } = req.body;

    if (!errorMessage) {
      return res.status(400).json({ error: 'errorMessage is required' });
    }

    const { errorReferenceId } = await ErrorTelemetryService.captureException(
      {
        name: errorName || 'FrontendException',
        message: errorMessage,
        stack: stackTrace,
      },
      {
        source: 'frontend',
        severity: severity || 'error',
        httpPath: httpPath || pageUrl || '/',
        httpStatusCode: 200,
        organizationId: organizationId || null,
        userId: userId || null,
        userEmail: userEmail || null,
        browserInfo: browserInfo || req.get('user-agent') || null,
        extra: extra || context || {},
      }
    );

    return res.status(201).json({
      success: true,
      errorReferenceId,
      message: 'Telemetry recorded successfully',
    });
  } catch (err: any) {
    console.error('[Telemetry Ingestion Error]', err);
    return res.status(500).json({ error: 'Failed to record telemetry', details: err.message });
  }
});

/**
 * GET /api/v1/telemetry/errors
 * Centralized admin error logs query with filtering, search, and pagination (Super Admin)
 */
telemetryRouter.get(
  '/errors',
  authMiddleware,
  superAdminOnlyMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { source, severity, organizationId, search, limit, offset } = req.query;

      const result = await ErrorTelemetryService.queryLogs({
        source: source ? String(source) : undefined,
        severity: severity ? String(severity) : undefined,
        organizationId: organizationId ? String(organizationId) : undefined,
        search: search ? String(search) : undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
        offset: offset ? parseInt(String(offset), 10) : undefined,
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch error telemetry', details: err.message });
    }
  }
);

/**
 * POST /api/v1/telemetry/simulate-backend-error
 * Internal testing route to verify global error middleware, errorReferenceId generation, and DB persistence
 */
telemetryRouter.post('/simulate-backend-error', (req: Request, res: Response, next) => {
  const err = new Error('Simulated unhandled server exception for telemetry verification');
  (err as any).statusCode = 500;
  next(err);
});
