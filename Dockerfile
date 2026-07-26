# syntax=docker/dockerfile:1

FROM node:22.12.0-alpine AS dependencies

WORKDIR /app

RUN npm install --global pnpm@10.32.1

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY . .
RUN pnpm build

FROM node:22.12.0-alpine AS runner

ENV NODE_ENV="production"
ENV PORT="3000"
ENV HOSTNAME="0.0.0.0"

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs fallsim

COPY --from=builder --chown=fallsim:nodejs /app/dist/standalone ./

USER fallsim

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
