# Build the static Portal application once, then serve it with unprivileged Nginx.
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine AS runtime

USER root
RUN apk add --no-cache jq
COPY --from=build --chown=101:101 /app/dist/ /usr/share/nginx/html/
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/portal-entrypoint.sh /usr/local/bin/portal-entrypoint.sh
RUN chmod 0755 /usr/local/bin/portal-entrypoint.sh

USER 101:101
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/portal-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
