FROM node:14-alpine as building

WORKDIR /usr/src/app

COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY ./tsconfig-paths-bootstrap.js ./
COPY ./src ./src

RUN npm ci
RUN npm run build
RUN npm prune --production

FROM node:14-alpine

WORKDIR /usr/src/app

COPY --from=building /usr/src/app/dist ./dist
COPY --from=building /usr/src/app/node_modules ./node_modules
COPY ./package*.json ./
COPY --from=building /usr/src/app/tsconfig-paths-bootstrap.js ./tsconfig-paths-bootstrap.js
COPY --from=building /usr/src/app/tsconfig.json ./tsconfig.json

EXPOSE 8080

CMD ["node", "--require=./tsconfig-paths-bootstrap.js", "", "./dist/apps/main/index.js"]