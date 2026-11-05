FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY apps/dashboard/ apps/dashboard/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @saas/shared-types build
RUN pnpm --filter @saas/dashboard build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/apps/dashboard/.next /app/apps/dashboard/.next
COPY --from=builder /app/apps/dashboard/public /app/apps/dashboard/public
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/dashboard/package.json /app/apps/dashboard/package.json

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node_modules/.bin/next", "start", "apps/dashboard", "-p", "3000"]

