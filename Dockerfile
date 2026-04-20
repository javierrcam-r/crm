# =====================================================
# CRM Camila Fernández - Dockerfile
# Solo empaqueta el build standalone de Next.js
# (el build se hace localmente con `npm run build`)
# =====================================================

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY public ./public
COPY .next/standalone ./
COPY .next/static ./.next/static

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
