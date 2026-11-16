FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/design-tokens/package.json packages/design-tokens/package.json
RUN npm ci --workspace @qsale/web --workspace @qsale/contracts --workspace @qsale/api-client --include-workspace-root --ignore-scripts --no-audit --no-fund
COPY packages ./packages
COPY apps/web ./apps/web
COPY tests/environment.ts ./tests/environment.ts
COPY apps/mobile/tests/local-api.ts ./apps/mobile/tests/local-api.ts
RUN npm run build:web
RUN npm prune --omit=dev --workspace @qsale/web --workspace @qsale/contracts --workspace @qsale/api-client --include-workspace-root --ignore-scripts --no-audit --no-fund

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/server/app.ts ./apps/web/server/app.ts
COPY --from=build /app/apps/web/server/index.ts ./apps/web/server/index.ts
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages ./packages
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server/index.ts"]
