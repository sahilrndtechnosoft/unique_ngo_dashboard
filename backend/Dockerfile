FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY nest-cli.json prisma.config.ts tsconfig*.json ./
COPY prisma ./prisma
COPY src ./src

ENV DATABASE_URL=postgresql://user:password@localhost:5432/unique_ngo_dash
RUN npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

RUN mkdir -p uploads

EXPOSE 3017
CMD ["node", "dist/src/main.js"]
