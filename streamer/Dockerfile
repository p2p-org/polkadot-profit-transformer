FROM node:14-alpine as building

WORKDIR /usr/src/app

COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY ./src ./src

RUN npm ci
RUN npm run build
RUN npm prune --production

FROM node:14-alpine

WORKDIR /usr/src/app

COPY --from=building /usr/src/app/dist ./dist
COPY --from=building /usr/src/app/node_modules ./node_modules
COPY ./package*.json ./

EXPOSE 8080

CMD ["node", "./dist/main.js", "--sync", "--sub-fin-head"]