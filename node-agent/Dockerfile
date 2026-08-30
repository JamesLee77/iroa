FROM node:22.12.0-bookworm-slim AS build
WORKDIR /opt/iroa
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/tsconfig.json packages/protocol/
COPY packages/crypto/package.json packages/crypto/tsconfig.json packages/crypto/
COPY packages/contracts/package.json packages/contracts/
COPY onchain/package.json onchain/
COPY control-api/package.json control-api/
COPY node-agent/package.json node-agent/tsconfig.json node-agent/
RUN npm ci --ignore-scripts
COPY packages/protocol/src packages/protocol/src
COPY packages/crypto/src packages/crypto/src
COPY node-agent/src node-agent/src
RUN npm run build --workspace @iroa/node-agent

FROM node:22.12.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /opt/iroa
COPY --from=build --chown=node:node /opt/iroa/package.json /opt/iroa/package-lock.json ./
COPY --from=build --chown=node:node /opt/iroa/node_modules ./node_modules
COPY --from=build --chown=node:node /opt/iroa/packages/protocol/package.json ./packages/protocol/package.json
COPY --from=build --chown=node:node /opt/iroa/packages/protocol/dist ./packages/protocol/dist
COPY --from=build --chown=node:node /opt/iroa/packages/crypto/package.json ./packages/crypto/package.json
COPY --from=build --chown=node:node /opt/iroa/packages/crypto/dist ./packages/crypto/dist
COPY --from=build --chown=node:node /opt/iroa/node-agent/package.json ./node-agent/package.json
COPY --from=build --chown=node:node /opt/iroa/node-agent/dist ./node-agent/dist
USER node
VOLUME ["/tmp"]
CMD ["node", "node-agent/dist/src/main.js"]
