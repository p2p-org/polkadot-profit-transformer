FROM node:14-alpine

WORKDIR /usr/src/app

COPY ./package*.json ./

RUN npm install

COPY ./src .
RUN rm ./.env

EXPOSE 8080

ENTRYPOINT npx ts-node main.js --sync --sub-fin-head