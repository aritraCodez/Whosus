FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
ARG VITE_BACKEND_ORIGIN
ENV VITE_BACKEND_ORIGIN=${VITE_BACKEND_ORIGIN}
RUN npm run build
FROM nginx:1.27-alpine
ENV PORT=8080 \
    NGINX_ENVSUBST_FILTER="^PORT$"
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
