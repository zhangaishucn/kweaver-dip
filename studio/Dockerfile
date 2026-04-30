# ── Stage 1: builder ────────────────────────────────────────────

FROM node:25.9-bookworm AS builder

WORKDIR /build

COPY . .

# Bundled OpenClaw plugin: copy deploy/openclaw-extensions/dip into studio/extensions/dip
# before docker build (see README); CI does this automatically.
RUN test -d extensions/dip \
  || (echo "ERROR: extensions/dip is missing. From monorepo root: mkdir -p studio/extensions && cp -R deploy/openclaw-extensions/dip studio/extensions/dip" >&2; exit 1)

RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g pnpm \
    && pnpm install \
    && pnpm run build \
    && pnpm prune --prod

# ── Stage 2: runtime ────────────────────────────────────────────

FROM node:25.9-bookworm AS runtime

WORKDIR /app

COPY --from=builder /build/package.json ./package.json
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/assets ./assets
COPY --from=builder /build/templates ./templates
COPY --from=builder /build/built-in ./built-in
COPY --from=builder /build/extensions ./extensions
COPY --from=builder /build/scripts ./scripts
COPY --from=builder /build/node_modules ./node_modules

RUN ln -sf /app/node_modules/openclaw/openclaw.mjs /usr/local/bin/openclaw \
    && ln -sf /app/node_modules/@kweaver-ai/kweaver-sdk/bin/kweaver.js /usr/local/bin/kweaver \
    && chmod +x /app/scripts/docker-entrypoint.sh /app/scripts/openclaw-init.sh

EXPOSE 3000

CMD ["/app/scripts/docker-entrypoint.sh"]
