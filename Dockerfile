# syntax=docker/dockerfile:1
# Imagen para Railway: un solo servicio que sirve la API (Fastify) y la web (React).

FROM node:24-alpine AS build
WORKDIR /app
# Primero solo los package.json: la capa de dependencias se cachea entre despliegues.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/cli/package.json apps/cli/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core/package.json packages/core/
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/cli/package.json apps/cli/
COPY --from=build /app/apps/cli/dist apps/cli/dist
COPY --from=build /app/apps/web/dist apps/web/dist
# Los volúmenes de Railway se montan como root; se corre como root para poder escribir en /data.
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "apps/api/dist/server.js"]
