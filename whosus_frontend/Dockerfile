FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build
FROM nginx:1.27-alpine
RUN apk add --no-cache ca-certificates
# Render supplies PORT; BACKEND_ORIGIN is the separately deployed API service.
# The official entrypoint substitutes only these two settings at container startup.
ENV PORT=8080 \
    BACKEND_ORIGIN=http://127.0.0.1:8000 \
    NGINX_ENVSUBST_FILTER="^(PORT|BACKEND_ORIGIN)$"
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
