FROM node:20-alpine AS builder
WORKDIR /app
COPY apps/api/package*.json apps/api/
RUN cd apps/api && npm ci
COPY . .
RUN cd apps/api && npm run build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
# Mirror the source layout so __dirname-relative paths resolve correctly.
WORKDIR /app/apps/api
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/knowledge-base /app/knowledge-base
COPY --from=builder /app/frontend /app/frontend
EXPOSE 3000
CMD ["node", "dist/main"]
