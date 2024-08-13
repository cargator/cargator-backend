FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install


# Bundle app source
COPY . . 
EXPOSE 8080
RUN npm run build

CMD npm run start