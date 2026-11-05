export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AI Product Intelligence SaaS Core & Integration REST API',
    version: '1.2.0',
    description: 'Enterprise REST API for multi-tenant product intelligence, global catalog search, asynchronous discovery, data quality assessment, and external e-commerce integrations.',
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local Development Server',
    },
    {
      url: 'https://staging-api.example.com',
      description: 'Staging Environment Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Organization-scoped integration API Key format: pk_<prefix>_<secret>',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'System Health Check',
        responses: {
          '200': { description: 'Service is operational' },
        },
      },
    },
    '/api/v1/integrations/products/lookup': {
      get: {
        summary: 'External Integration: Canonical Product Intelligence Lookup',
        description: 'Look up real-time verified canonical product intelligence by ID, GTIN, EAN, UPC, MPN, SKU, or Model Number. Respects tenant customizations and enforces scope "products:read".',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'identifier',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'The product identifier to look up (Barcode, MPN, Model, or Product UUID)',
          },
          {
            name: 'type',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['GTIN', 'EAN', 'UPC', 'MPN', 'SKU', 'MODEL', 'ID'] },
            description: 'Optional identifier type filter',
          },
        ],
        responses: {
          '200': { description: 'Verified product intelligence returned' },
          '401': { description: 'Unauthorized / Invalid API Key' },
          '403': { description: 'Forbidden / Missing "products:read" scope' },
          '404': { description: 'Product not found' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },
    '/api/v1/integrations/products/discover': {
      post: {
        summary: 'External Integration: Submit Asynchronous Product Discovery Request',
        description: 'Discover product data across authorized sources. If not found in catalog, enqueues an asynchronous extraction job. Requires scope "products:discover".',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  identifier: { type: 'string', description: 'Barcode or Model Number' },
                  url: { type: 'string', description: 'Direct Product URL' },
                  brandHint: { type: 'string', description: 'Optional Brand Name' },
                  webhookUrl: { type: 'string', description: 'Webhook callback on completion' },
                },
              },
            },
          },
        },
        responses: {
          '202': { description: 'Discovery request accepted for background processing' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden / Missing "products:discover" scope' },
        },
      },
    },
    '/api/v1/integrations/jobs/{jobId}': {
      get: {
        summary: 'External Integration: Check Discovery Job Status',
        description: 'Check the status of an asynchronous discovery job without exposing internal BullMQ queue mechanics.',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Job status retrieved' },
          '404': { description: 'Job not found or unauthorized' },
        },
      },
    },
    '/api/v1/integrations/webhooks/subscriptions': {
      post: {
        summary: 'External Integration: Register Webhook Subscription',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['targetUrl'],
                properties: {
                  targetUrl: { type: 'string' },
                  events: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Webhook subscription registered with HMAC secret' },
        },
      },
      get: {
        summary: 'External Integration: List Tenant Webhook Subscriptions',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': { description: 'List of active webhook subscriptions' },
        },
      },
    },
    '/api/v1/keys': {
      post: {
        summary: 'Generate New Scoped Integration API Key',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  scopes: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'API Key generated' },
        },
      },
      get: {
        summary: 'List Tenant API Keys',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'List of organization API keys' },
        },
      },
    },
  },
};
