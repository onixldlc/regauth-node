#!/bin/sh

# Set default REGISTRY_HOST if not provided
if [ -z "$REGISTRY_HOST" ]; then
  export REGISTRY_HOST="registry"
fi

# Set default REGISTRY_PORT if not provided
if [ -z "$REGISTRY_PORT" ]; then
  export REGISTRY_PORT="5000"
fi

echo "[entrypoint] REGISTRY_HOST: $REGISTRY_HOST"
echo "[entrypoint] REGISTRY_PORT: $REGISTRY_PORT"

exec node main.js
