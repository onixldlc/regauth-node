FROM node:20-alpine

RUN apk add --no-cache apache2-utils

WORKDIR /app

COPY src/ /app/

RUN mkdir -p /data /registry-auth && chmod +x /app/entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/app/entrypoint.sh"]
