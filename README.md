# Regauth-node

A private Docker registry with multi-credential authentication support with node js as middleware. Users can authenticate using passwords or Personal Access Tokens (PATs).

## Architecture

```
┌─────────────┐     HTTPS      ┌─────────────┐     HTTP      ┌──────────────┐
│   Client    │ ─────────────► │    Caddy    │ ────────────► │ Authenticator│
│ (Docker/    │   :5000        │  (TLS Proxy)│               │  (Node.js)   │
│  Podman)    │                └─────────────┘               └──────┬───────┘
└─────────────┘                                                     │
                                                                    │ HTTP
                                                                    ▼
                                                              ┌──────────────┐
                                                              │   Registry   │
                                                              │ (registry:2) │
                                                              └──────────────┘
```

## Features

- **Multi-credential support**: One user can have multiple passwords/PATs
- **Personal Access Tokens (PAT)**: Format `MYCR_` followed by 32 alphanumeric characters
- **REST API**: Manage credentials via API with Bearer token authentication
- **Auto-generated htpasswd**: Automatically syncs credentials with the registry
- **IP Whitelist/Blacklist**: Control API access by IP address
- **Logging**: Console and file logging (`/data/logs/app.log`)
- **HTTPS via Caddy**: Automatic TLS with self-signed certificates

## Quick Start

### 1. Start the services

**Option A: Use pre-built image from GHCR**

```bash
podman compose up -d --build
# or
docker compose up -d --build
```

**Option B: Build locally**

```bash
# Set your GitHub repo (replace with your actual repo)
podman compose -f docker-compose-dev.yml up -d --build
# or
docker compose -f docker-compose-dev.yml up -d --build
```

### 2. Get your API token

The API token is auto-generated on first run:

```bash
cat authenticator/data/config.json | jq -r '.apikey'
# or check the logs
podman logs authenticator 2>&1 | grep "API Token"
```

### 3. Configure Podman/Docker to trust the registry

Since Caddy uses self-signed certificates, you need to configure your container runtime to trust it.

#### For Podman

Edit `/etc/containers/registries.conf`:

```toml
# Add to unqualified-search-registries (optional)
unqualified-search-registries = ["docker.io", "localhost:5000"]

# Add this section to trust self-signed certificates
[[registry]]
location = "localhost:5000"
insecure = true
```

#### For Docker

Edit `/etc/docker/daemon.json`:

```json
{
  "insecure-registries": ["localhost:5000"]
}
```

Then restart Docker:

```bash
sudo systemctl restart docker
```

### 4. Add a user credential

```bash
API_TOKEN=$(cat authenticator/data/config.json | jq -r '.apikey')

curl -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"mypassword"}' \
  http://localhost:5000/internal/api/credentials
```

### 5. Login to the registry

```bash
podman login localhost:5000
# or
docker login localhost:5000
```

### 6. Push/Pull images

```bash
# Tag an image
podman tag alpine localhost:5000/alpine

# Push
podman push localhost:5000/alpine

# Pull
podman pull localhost:5000/alpine
```

> [!IMPORTANT]  
> if you use self signed ssl for the proxy don't forget to use --tls-verify=false for every `docker` or `podman` action  

## API Reference

All API endpoints require Bearer token authentication:

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" http://localhost:5000/internal/api/...
```

### Credentials

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/internal/api/credentials` | List all users and their credential hashes |
| POST | `/internal/api/credentials` | Add a credential `{"username":"...","password":"..."}` |
| DELETE | `/internal/api/credentials` | Remove credential `{"username":"...","hash":"..."}` or all for user `{"username":"..."}` |
| POST | `/internal/api/credentials/bulk` | Bulk set credentials `{"credential":[...]}` |
| POST | `/internal/api/reload` | Reload credentials from disk |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/internal/api/config` | Get current config (whitelist, blacklist, sharedCreds) |
| POST | `/internal/api/config/reload` | Reload config from disk |

### Access Control (for API only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/internal/api/whitelist` | Get IP whitelist |
| POST | `/internal/api/whitelist` | Set whitelist `{"list":[...]}`, add `{"add":"ip"}`, or remove `{"remove":"ip"}` |
| GET | `/internal/api/blacklist` | Get IP blacklist |
| POST | `/internal/api/blacklist` | Set blacklist `{"list":[...]}`, add `{"add":"ip"}`, or remove `{"remove":"ip"}` |

### htpasswd

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/internal/api/htpasswd` | Get current htpasswd file contents |
| POST | `/internal/api/htpasswd` | Regenerate htpasswd file |

## File Structure

```
regauth-node/
├── docker-compose.yml
├── README.md
├── authenticator/
│   ├── Dockerfile
│   ├── data/
│   │   ├── auth.json          # User credentials (SHA1 hashed)
│   │   ├── config.json        # API key, whitelist, blacklist, shared creds
│   │   └── logs/
│   │       └── app.log        # Application logs
│   └── src/
│       ├── entrypoint.sh
│       ├── main.js
│       ├── package.json
│       └── lib/
│           ├── api.js         # REST API handlers
│           ├── auth.js        # Credential management
│           ├── config.js      # Configuration management
│           ├── htpasswd.js    # htpasswd generation
│           ├── logger.js      # Logging utility
│           └── proxy.js       # HTTP proxy to registry
├── caddy/
│   └── Caddyfile              # Caddy reverse proxy config
└── registry/
    ├── auth/
    │   └── htpasswd           # Auto-generated htpasswd file
    └── data/                  # Registry image storage
```

## Configuration Files

### auth.json

Stores user credentials with SHA1-hashed passwords:

```json
{
  "credential": [
    {
      "username": "myuser",
      "authorized": [
        "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3"
      ]
    }
  ]
}
```

### config.json

Stores API key and access control settings:

```json
{
  "apikey": "your-auto-generated-api-key",
  "whitelist": [],
  "blacklist": [],
  "sharedCreds": {
    "username": "registry_internal",
    "password": "auto-generated-password"
  }
}
```

## Personal Access Tokens (PAT)

PATs provide an alternative to passwords. They must follow this format:

- Prefix: `MYCR_`
- Followed by: 32 alphanumeric characters
- Example: `MYCR_AbCdEfGhIjKlMnOpQrStUvWxYz123456`

Add a PAT via the API:

```bash
curl -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"MYCR_AbCdEfGhIjKlMnOpQrStUvWxYz123456"}' \
  http://localhost:5000/internal/api/credentials
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Authenticator listen port |
| `REGISTRY_HOST` | `registry` | Registry hostname |
| `REGISTRY_PORT` | `5000` | Registry port |
| `API_TOKEN` | (auto-generated) | Override API token |

## Troubleshooting

### Certificate errors

If you see `x509: certificate signed by unknown authority`:

1. Add the registry to insecure registries (see Quick Start step 3)
2. Or use `--tls-verify=false` flag:
   ```bash
   podman pull --tls-verify=false localhost:5000/myimage
   ```

### Check logs

```bash
# Authenticator logs
podman logs authenticator

# Caddy logs
podman logs caddy

# Registry logs
podman logs registry

# Application log file
cat authenticator/data/logs/app.log
```

### Regenerate htpasswd

If authentication isn't working, regenerate the htpasswd file:

```bash
curl -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  http://localhost:5000/internal/api/htpasswd
```

### Reload credentials

If you manually edited `auth.json`:

```bash
curl -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  http://localhost:5000/internal/api/reload
```
