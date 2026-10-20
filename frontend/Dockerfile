FROM node:22.21.1-alpine

WORKDIR /app

COPY package.json .

RUN npm i

RUN npm i -g serve

COPY . .

RUN npm run build

EXPOSE 3000

CMD [ "serve", "-s", "dist" ]