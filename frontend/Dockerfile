# 1. Build the React app
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Backend address, baked into the build. Override with --build-arg.
ARG VITE_API_URL=https://dev-gridbricks.dhql6p.easypanel.host
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# 2. Serve the built files with nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
