import { describe, it, expect } from 'vitest';
import { ServiceHealth } from '@saas/shared-types';

describe('Backend API Smoke Test', () => {
  it('should validate ServiceHealth structure', () => {
    const health: ServiceHealth = {
      service: 'saas-api-backend',
      status: 'healthy',
      version: '0.1.0',
      timestamp: new Date().toISOString()
    };
    expect(health.service).toBe('saas-api-backend');
    expect(health.status).toBe('healthy');
  });
});

