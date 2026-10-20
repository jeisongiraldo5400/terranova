# ===========================================================================
# Frontend de TERRANOVA
# ---------------------------------------------------------------------------
#   docker build -f apps/web/Dockerfile -t terranova-web .
#   (el contexto es la RAIZ del monorepo)
# ===========================================================================

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json        apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/web/node_modules        ./apps/web/node_modules
COPY . .

# Next recopila telemetria por defecto.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @terranova/shared build \
 && pnpm --filter @terranova/web build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=UTC

RUN addgroup -S terranova && adduser -S terranova -G terranova

# `output: standalone` deja un servidor autocontenido: no hace falta
# node_modules completo en la imagen final.
COPY --from=build --chown=terranova:terranova /app/apps/web/.next/standalone ./
COPY --from=build --chown=terranova:terranova /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=terranova:terranova /app/apps/web/public ./apps/web/public

USER terranova
EXPOSE 3100
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
