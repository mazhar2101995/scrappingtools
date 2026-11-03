export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "AI Product Intelligence SaaS Core REST API",
    version: "1.0.0",
    description: "Production REST API for multi-tenant product intelligence, global catalog search, and asynchronous BullMQ scraping job orchestration."
  },
  servers: [
    { url: "http://localhost:4000", description: "Local Development Server" }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      },
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key"
      }
    }
  },
  paths: {
    "/health": {
      get: {
        summary: "System Health Check",
        responses: {
          200: { description: "Service is operational" }
        }
      }
    },
    "/api/v1/auth/register": {
      post: {
        summary: "Register new user and tenant organization",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "fullName"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                  fullName: { type: "string" },
                  organizationName: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          201: { description: "User registered successfully" },
          409: { description: "User already exists" }
        }
      }
    },
    "/api/v1/auth/login": {
      post: {
        summary: "Login and obtain JWT tokens",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Authenticated successfully" },
          401: { description: "Invalid credentials" }
        }
      }
    },
    "/api/v1/products": {
      get: {
        summary: "Search Global Canonical Products",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Text search" },
          { name: "brandId", in: "query", schema: { type: "string" }, description: "Brand UUID filter" },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } }
        ],
        responses: {
          200: { description: "List of canonical products" },
          401: { description: "Unauthorized" }
        }
      }
    },
    "/api/v1/products/search/ean/{ean}": {
      get: {
        summary: "Search canonical product by standard EAN barcode",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        parameters: [
          { name: "ean", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          200: { description: "Found product" },
          404: { description: "Barcode not found" }
        }
      }
    },
    "/api/v1/catalog": {
      get: {
        summary: "Get Tenant Catalog (with private overrides merged)",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        responses: {
          200: { description: "Tenant catalog records" }
        }
      }
    },
    "/api/v1/jobs": {
      post: {
        summary: "Submit an asynchronous scraping ingestion job",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["targetUrl", "sourceWebsiteId"],
                properties: {
                  targetUrl: { type: "string" },
                  sourceWebsiteId: { type: "string" },
                  brandHint: { type: "string" },
                  useBrowser: { type: "boolean" }
                }
              }
            }
          }
        },
        responses: {
          202: { description: "Job accepted and queued in BullMQ" }
        }
      }
    },
    "/api/v1/jobs/monitoring/health": {
      get: {
        summary: "Real-time Queue Health and Redis Latency",
        security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
        responses: {
          200: { description: "Queue metrics" }
        }
      }
    }
  }
};

