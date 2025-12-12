import http from 'http';
import { loadCredentials } from './lib/auth.js';
import { initHtpasswd } from './lib/htpasswd.js';
import { handleApiRequest } from './lib/api.js';
import { handleProxyRequest } from './lib/proxy.js';
import { loadConfig, checkAccess, getApiKey, setApiKey, setWhitelist, setBlacklist } from './lib/config.js';
import * as logger from './lib/logger.js';

const PORT = process.env.PORT || 5000;

let apiToken = null;

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apikey' && args[i + 1]) {
      parsed.apikey = args[++i];
    } else if (args[i] === '--whitelist' && args[i + 1]) {
      try {
        parsed.whitelist = JSON.parse(args[++i]);
      } catch { parsed.whitelist = []; }
    } else if (args[i] === '--blacklist' && args[i + 1]) {
      try {
        parsed.blacklist = JSON.parse(args[++i]);
      } catch { parsed.blacklist = []; }
    } else if (args[i] === '--config' && args[i + 1]) {
      parsed.configPath = args[++i];
    }
  }
  return parsed;
}

async function init() {
  const args = parseArgs();
  
  // Load config from file first
  loadConfig(args.configPath);
  
  // Override with CLI args if provided
  if (args.apikey) {
    setApiKey(args.apikey);
    logger.info('init', 'API key set from CLI argument');
  }
  if (args.whitelist && Array.isArray(args.whitelist)) {
    setWhitelist(args.whitelist);
    logger.info('init', `Whitelist set from CLI: ${args.whitelist.length} entries`);
  }
  if (args.blacklist && Array.isArray(args.blacklist)) {
    setBlacklist(args.blacklist);
    logger.info('init', `Blacklist set from CLI: ${args.blacklist.length} entries`);
  }
  
  apiToken = getApiKey();
  if (apiToken) {
    logger.info('init', `API Token: ${apiToken.substring(0, 4)}***`);
  }
  
  await loadCredentials();
  await initHtpasswd();
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
