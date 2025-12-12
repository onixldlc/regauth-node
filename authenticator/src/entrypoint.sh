#!/bin/sh

AUTH_APIKEY=${AUTH_APIKEY:-""}
AUTH_WHITELIST=${AUTH_WHITELIST:-""}
AUTH_BLACKLIST=${AUTH_BLACKLIST:-""}
AUTH_CONFIG=${AUTH_CONFIG:-""}

ARGS=""

if [ ! -f "/data/config.json" ]; then
	echo "[entrypoint] No config.json found!"
	if [ -z "$AUTH_APIKEY" ]; then
		echo "[entrypoint] No AUTH_APIKEY provided, generating random key"
		AUTH_APIKEY=$(tr -cd 'a-zA-Z0-9' < /dev/urandom | head -c 32 > /tmp/secret.txt)
		echo "[entrypoint] Generated AUTH_APIKEY: $AUTH_APIKEY"
	else
		echo "[entrypoint] Using provided AUTH_APIKEY"
	fi
	ARGS="--apikey ${AUTH_APIKEY} ${ARGS}"

	if [ -z "${AUTH_WHITELIST}" ]; then
		AUTH_WHITELIST="[]"
		echo "[entrypoint] No AUTH_WHITELIST provided, defaulting to empty (allow all) []"
	else
		echo "[entrypoint] Using provided AUTH_WHITELIST: $AUTH_WHITELIST"
	fi
	ARGS="--whitelist ${AUTH_WHITELIST} ${ARGS}"

	if [ -z "${AUTH_BLACKLIST}" ]; then
		AUTH_BLACKLIST="[]"
		echo "[entrypoint] No AUTH_BLACKLIST provided, defaulting to empty (allow all) []"
	else
		echo "[entrypoint] Using provided AUTH_BLACKLIST: $AUTH_BLACKLIST"
	fi
	ARGS="--blacklist ${AUTH_BLACKLIST} ${ARGS}"

	if [ -n "$AUTH_CONFIG" ]; then
		echo "[entrypoint] Using provided AUTH_CONFIG"
		echo "$AUTH_CONFIG" > /data/config.json
	else
		echo "[entrypoint] No AUTH_CONFIG provided, using defaults"
	fi
	ARGS="--config /data/config.json ${ARGS}"
else
	echo "[entrypoint] Using existing config.json in /data"
fi


if [ -z "$REGISTRY_HOST" ]; then
	export REGISTRY_HOST="registry"
fi


if [ -z "$REGISTRY_PORT" ]; then
	export REGISTRY_PORT="5000"
fi


echo "[entrypoint] REGISTRY_HOST: $REGISTRY_HOST"
echo "[entrypoint] REGISTRY_PORT: $REGISTRY_PORT"


exec node main.js ${ARGS}
