import { Request, Response, NextFunction } from 'express';
import { ErrorTelemetryService } from '../services/error-telemetry.service';

export async function errorMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const statusCode = err.status || err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  // Capture user and tenant context if request was authenticated
  const organizationId = req.user?.organizationId || (req.headers['x-organization-id'] as string) || null;
  const userId = req.user?.userId || null;
  const userEmail = req.user?.email || null;

  // Redact request body & headers
  const sanitizedBody = ErrorTelemetryService.redactSensitiveData(req.body);
  const sanitizedQuery = ErrorTelemetryService.redactSensitiveData(req.query);

  const { errorReferenceId } = await ErrorTelemetryService.captureException(err, {
    source: 'backend',
    severity: statusCode >= 500 ? 'error' : 'warning',
    httpMethod: req.method,
    httpPath: req.originalUrl || req.path,
    httpStatusCode: statusCode,
    organizationId,
    userId,
    userEmail,
    extra: {
      query: sanitizedQuery,
      body: sanitizedBody,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  // Client-safe response format
  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred',
    errorReferenceId,
    statusCode,
  });
}
