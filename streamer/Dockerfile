FROM node:14-alpine as building

WORKDIR /usr/src/app

COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY ./src ./src

RUN npm ci
RUN npm run build
RUN npm prune --production

FROM node:14-alpine

COPY --from=builder /dist /dist
COPY --from=builder /node_modules /node_modules

EXPOSE 8080

ENTRYPOINT npm run start:prod