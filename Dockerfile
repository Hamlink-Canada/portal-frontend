# Build the static Portal application once, then serve it with unprivileged Nginx.
# Vite emits architecture-independent files, so build them on the native worker instead of under QEMU.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine AS runtime

ARG VCS_REF=development
LABEL org.opencontainers.image.source="https://github.com/Hamlink-Canada/Portal-Frontend" \
      org.opencontainers.image.revision="$VCS_REF"

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
