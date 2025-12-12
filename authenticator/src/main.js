import http from 'http';
import { loadCredentials } from './lib/auth.js';
import { initHtpasswd } from './lib/htpasswd.js';
import { handleApiRequest } from './lib/api.js';
import { handleProxyRequest } from './lib/proxy.js';
import { loadConfig, checkAccess, getApiKey } from './lib/config.js';
import * as logger from './lib/logger.js';

const PORT = process.env.PORT || 5000;

let apiToken = null;

async function init() {
  const config = loadConfig();
  apiToken = process.env.API_TOKEN || config.apikey;
  if (apiToken) {
    logger.info('init', `API Token: ***`);
  }
  await loadCredentials();
  await initHtpasswd();
  logger.info('init', 'Config loaded');
  logger.info('init', 'Credentials loaded');
  logger.info('init', 'htpasswd initialized');
}

function verifyApiToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7);
  return token === apiToken;
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  if (url.startsWith('/internal/api')) {
    const accessResult = checkAccess(req);
    if (!accessResult.allowed) {
      logger.warn('server', `API access denied for ${accessResult.ip}: ${accessResult.reason}`);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden', reason: accessResult.reason }));
      return;
    }
    if (!verifyApiToken(req)) {
      logger.warn('server', `Unauthorized API access attempt to ${url} from ${accessResult.ip}`);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    await handleApiRequest(req, res);
  } else {
    await handleProxyRequest(req, res);
  }
});

init().then(() => {
  server.listen(PORT, () => {
    logger.info('server', `Authenticator listening on port ${PORT}`);
  });
}).catch((err) => {
  logger.error('server', `Failed to initialize: ${err.message}`);
  process.exit(1);
});
