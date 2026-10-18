FROM --platform=linux/amd64 node:20-alpine as building

WORKDIR /usr/src/app

COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY ./tsconfig-paths-bootstrap.js ./
COPY ./src ./src
COPY ./migrations ./migrations
COPY ./migrations.ts ./migrations.ts

RUN apk add --no-cache --virtual .build-deps python3 make gcc g++
RUN npm ci
RUN npm run build
RUN npm prune --production
RUN apk del .build-deps

FROM --platform=linux/amd64 node:20-alpine

WORKDIR /usr/src/app

COPY --from=building /usr/src/app/dist ./dist
COPY --from=building /usr/src/app/node_modules ./node_modules
COPY ./package*.json ./
COPY --from=building /usr/src/app/tsconfig-paths-bootstrap.js ./tsconfig-paths-bootstrap.js
COPY --from=building /usr/src/app/tsconfig.json ./tsconfig.json
COPY --from=building /usr/src/app/migrations ./migrations
COPY --from=building /usr/src/app/migrations.ts ./migrations.ts

EXPOSE 8080

#RUN npm run migrations:list
#RUN npm run migrations:up

CMD ["node", "--require=./tsconfig-paths-bootstrap.js", "./dist/index.js"]
