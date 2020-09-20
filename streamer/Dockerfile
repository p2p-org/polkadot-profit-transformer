FROM node:12-alpine

WORKDIR /ust/src/app

COPY ./src/package*.json ./

RUN npm install

COPY ./src .

COPY ./.env.dev .

EXPOSE 8080

ENTRYPOINT node main.js --sync --sub-fin-head