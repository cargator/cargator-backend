FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install


# Bundle app source
COPY . . 
RUN npm run build
EXPOSE 8080

CMD npm run start