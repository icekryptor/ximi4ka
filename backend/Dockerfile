FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Install ALL deps (including devDependencies for tsc build)
RUN npm ci

COPY . .

RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

EXPOSE 3001

CMD ["npm", "start"]
