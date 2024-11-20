## Build command: docker build -t bebii-dash .

# Stage 1: Build the application.
FROM node:lts-alpine3.19 AS builder
WORKDIR /app
COPY . .
COPY .env .env
RUN npm install
RUN npx cubegen build
RUN rm -r node_modules
RUN npm ci --omit=dev

# Stage 2: Run the application.
FROM node:lts-alpine3.19
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/views ./views
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN mkdir public

# Run command on container starting
CMD ["npm", "run", "start:prod"]