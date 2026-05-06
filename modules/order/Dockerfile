FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install && npm install -g @nestjs/cli

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
