FROM node:12-alpine

WORKDIR /usr/src/app

COPY ./package*.json ./

RUN npm install

COPY ./src .

EXPOSE 8080

ENTRYPOINT node main.js --sync --start ${START} --sub-fin-head