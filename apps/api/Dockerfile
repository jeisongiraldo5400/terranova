# ===========================================================================
# API de TERRANOVA
# ---------------------------------------------------------------------------
# Construccion en varias etapas: la imagen final no lleva el codigo fuente,
# ni las dependencias de desarrollo, ni pnpm.
#
#   docker build -f apps/api/Dockerfile -t terranova-api .
#   (el contexto es la RAIZ del monorepo, no apps/api)
# ===========================================================================

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencias. Se copian solo los manifiestos para que esta capa se
# reutilice mientras no cambien las dependencias.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json   packages/config/
COPY packages/shared/package.json   packages/shared/
COPY packages/db/package.json       packages/db/
COPY apps/api/package.json          apps/api/
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Compilacion
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules     ./packages/db/node_modules
COPY --from=deps /app/apps/api/node_modules        ./apps/api/node_modules
COPY . .
RUN pnpm --filter @terranova/shared build \
 && pnpm --filter @terranova/db build \
 && pnpm --filter @terranova/api build

# Deja solo las dependencias de produccion.
RUN pnpm --filter @terranova/api --prod deploy /salida \
 && cp -r packages/db/generated /salida/generated

# ---------------------------------------------------------------------------
# Imagen final
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Las fechas de negocio son dias UTC de punta a punta; fijar la zona aqui
# evita que el contenedor herede la del anfitrion y corra los vencimientos.
ENV TZ=UTC

# No corre como root.
RUN addgroup -S terranova && adduser -S terranova -G terranova

COPY --from=build --chown=terranova:terranova /salida ./
COPY --from=build --chown=terranova:terranova /app/packages/db/prisma ./prisma

USER terranova
EXPOSE 3101

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.API_PORT||3101)+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
