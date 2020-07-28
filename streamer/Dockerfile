FROM node:12-alpine

ADD . .

RUN yarn install && yarn upgrade

ENTRYPOINT node main.js