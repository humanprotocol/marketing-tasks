FROM node:24.13-slim

WORKDIR /usr/src/app

COPY package.json ./
RUN yarn install

COPY . ./
RUN yarn build

CMD [ "yarn", "start:prod" ]
