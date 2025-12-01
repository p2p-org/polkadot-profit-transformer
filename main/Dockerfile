FROM --platform=linux/amd64 node:18 as building

WORKDIR /usr/src/app

COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY ./tsconfig-paths-bootstrap.js ./
COPY ./src ./src
COPY ./migrations ./migrations
COPY ./migrations.ts ./migrations.ts

# Install build dependencies (Debian)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && npm ci \
 && npm run build \
 && npm prune --production \
 && apt-get purge -y python3 make g++ \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

FROM --platform=linux/amd64 node:18

WORKDIR /usr/src/app

COPY --from=building /usr/src/app/dist ./dist
COPY --from=building /usr/src/app/node_modules ./node_modules
COPY ./package*.json ./
COPY --from=building /usr/src/app/tsconfig-paths-bootstrap.js ./tsconfig-paths-bootstrap.js
COPY --from=building /usr/src/app/tsconfig.json ./tsconfig.json
COPY --from=building /usr/src/app/migrations ./migrations
COPY --from=building /usr/src/app/migrations.ts ./migrations.ts

EXPOSE 8080

CMD ["node", "--require=./tsconfig-paths-bootstrap.js", "./dist/index.js"]
