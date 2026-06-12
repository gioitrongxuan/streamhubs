# Multi-stage: build TypeScript ở stage riêng, image cuối chỉ chứa
# production dependencies + dist + database (để chạy migration từ container).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
# Giới hạn heap tsc để không phình quá RAM trên máy nhỏ (1GB)
RUN NODE_OPTIONS=--max-old-space-size=512 npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY database ./database
COPY scripts ./scripts
COPY public ./public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/index.js"]
