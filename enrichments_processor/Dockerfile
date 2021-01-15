FROM node:12-alpine

WORKDIR /usr/src/app

COPY ./package*.json ./

RUN npm install

COPY ./src .

EXPOSE 8079

ENTRYPOINT node index.js