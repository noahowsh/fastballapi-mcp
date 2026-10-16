FROM node:22-alpine
WORKDIR /app
COPY package.json index.js ./
RUN npm install --omit=dev --no-audit --no-fund
ENTRYPOINT ["node", "index.js"]
