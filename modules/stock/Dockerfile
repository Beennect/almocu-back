FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install && npm install -g @nestjs/cli

COPY . .

EXPOSE 3100

CMD ["nest", "start", "--watch"]
