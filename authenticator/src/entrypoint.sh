#!/bin/sh

AUTH_APIKEY=${AUTH_APIKEY:-""}
AUTH_WHITELIST=${AUTH_WHITELIST:-""}
AUTH_BLACKLIST=${AUTH_BLACKLIST:-""}
AUTH_CONFIG=${AUTH_CONFIG:-""}
AUTH_HASH=${AUTH_HASH:-""}

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
	echo "whitelist: $AUTH_WHITELIST"
	ARGS="--whitelist ${AUTH_WHITELIST} ${ARGS}"

	if [ -z "${AUTH_BLACKLIST}" ]; then
		AUTH_BLACKLIST="[]"
		echo "[entrypoint] No AUTH_BLACKLIST provided, defaulting to empty (allow all) []"
	else
		echo "[entrypoint] Using provided AUTH_BLACKLIST: $AUTH_BLACKLIST"
	fi
	echo "blacklist: $AUTH_BLACKLIST"
	ARGS="--blacklist ${AUTH_BLACKLIST} ${ARGS}"

	if [ -z "$AUTH_HASH" ]; then
		AUTH_HASH="sha256"
		echo "[entrypoint] No AUTH_HASH provided, using defaults"
	else
		echo "[entrypoint] Using provided AUTH_HASH"
	fi
	echo "algorithm: $AUTH_HASH"
	ARGS="--hash ${AUTH_HASH} ${ARGS}"

	if [ -z "$AUTH_CONFIG" ]; then
		AUTH_CONFIG="/data/config.json"
		echo "[entrypoint] No AUTH_CONFIG provided, using defaults"
	else
		echo "[entrypoint] Using provided AUTH_CONFIG"
	fi
	echo "config path: $AUTH_CONFIG"
	ARGS="--config ${AUTH_CONFIG} ${ARGS}"
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
