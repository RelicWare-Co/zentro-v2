# Production app image — build from repo root for any Docker-capable platform.
# Build locally:
#   docker build -f deploy/app/Dockerfile -t zentro-app:latest .
# Platform: dockerfile path=deploy/app/Dockerfile, build context=repo root.

FROM oven/bun:1.3.14 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
COPY desktop/package.json ./desktop/package.json
RUN bun install --frozen-lockfile --ignore-scripts

FROM base AS build
COPY --from=install /app/node_modules node_modules
COPY . .
ENV NODE_ENV=production
RUN bun run build

FROM base AS migrate
COPY package.json bun.lock ./
COPY --from=install /app/node_modules node_modules
COPY database database
COPY scripts scripts
CMD ["bun", "run", "db:migrate"]

FROM base AS release
ENV NODE_ENV=production
COPY package.json bun.lock ./
COPY --from=install /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/database database
COPY --from=build /app/scripts scripts
RUN chmod +x scripts/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
