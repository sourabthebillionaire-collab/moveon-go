FROM node:18-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
ENV NODE_ENV=development
EXPOSE 3001
CMD [ "npm", "run", "dev" ]
