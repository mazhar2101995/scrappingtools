import { Router, Request, Response } from 'express';
import { db, proxyConfigurations } from '@saas/database';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware, requireOrgRole } from '../middleware/auth.middleware';
import { AntiBotDefenseService } from '../services/anti-bot-defense.service';

export const proxyRouter = Router();

proxyRouter.use(authMiddleware);

function getOrgId(req: Request): string | null {
  return (req as any).user?.organizationId || (req as any).apiKey?.organizationId || null;
}

// GET /api/v1/proxies - List proxies configured for tenant
proxyRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const proxies = await db
      .select({
        id: proxyConfigurations.id,
        name: proxyConfigurations.name,
        protocol: proxyConfigurations.protocol,
        host: proxyConfigurations.host,
        port: proxyConfigurations.port,
        username: proxyConfigurations.username,
        countryCode: proxyConfigurations.countryCode,
        isActive: proxyConfigurations.isActive,
        healthStatus: proxyConfigurations.healthStatus,
        lastTestedAt: proxyConfigurations.lastTestedAt,
        latencyMs: proxyConfigurations.latencyMs,
        successCount: proxyConfigurations.successCount,
        failCount: proxyConfigurations.failCount,
        createdAt: proxyConfigurations.createdAt,
      })
      .from(proxyConfigurations)
      .where(eq(proxyConfigurations.organizationId, orgId))
      .orderBy(desc(proxyConfigurations.createdAt));

    return res.json({ success: true, count: proxies.length, proxies });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list proxies' });
  }
});

// POST /api/v1/proxies - Add a new residential/datacenter proxy
proxyRouter.post('/', requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) return res.status(401).json({ error: 'Tenant context required' });

    const { name, protocol, host, port, username, password, countryCode } = req.body;

    if (!host || !port) {
      return res.status(400).json({ error: 'Proxy host and port are required' });
    }

    const [proxy] = await db
      .insert(proxyConfigurations)
      .values({
        organizationId: orgId,
        name: name ? name.trim() : `${host}:${port}`,
        protocol: protocol || 'HTTP',
        host: host.trim(),
        port: parseInt(String(port), 10),
        username: username ? username.trim() : null,
        password: password ? String(password) : null,
        countryCode: countryCode ? countryCode.trim().toUpperCase() : null,
        isActive: true,
        healthStatus: 'HEALTHY',
      })
      .returning();

    return res.status(201).json({ success: true, proxy });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to add proxy' });
  }
});

// POST /api/v1/proxies/:id/test - Perform a live latency & connectivity ping test
proxyRouter.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const proxyId = String(req.params.id);
    const testResult = await AntiBotDefenseService.testProxy(proxyId);
    return res.json(testResult);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/proxies/:id - Remove proxy
proxyRouter.delete('/:id', requireOrgRole('admin'), async (req: Request, res: Response) => {
  try {
    const orgId = String(getOrgId(req));
    const proxyId = String(req.params.id);

    const [deleted] = await db
      .delete(proxyConfigurations)
      .where(and(eq(proxyConfigurations.id, proxyId), eq(proxyConfigurations.organizationId, orgId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Proxy not found' });
    }

    return res.json({ success: true, message: `Proxy "${deleted.name}" deleted successfully` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete proxy' });
  }
});
