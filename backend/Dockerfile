FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build stage
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx baml-cli generate

# Production image
FROM base AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/baml_src ./baml_src
COPY --from=build /app/baml_client ./baml_client
COPY --from=build /app/package.json ./

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/database.sqlite

VOLUME /app/data

EXPOSE 5101

CMD ["bun", "run", "src/index.ts"]
