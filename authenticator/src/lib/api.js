import {
  loadCredentials,
  saveCredentials,
  getCredentials,
  setCredentials,
  addCredential,
  removeCredential,
  hashPassword
} from './auth.js';
import { regenerateHtpasswd, getSharedCredentials } from './htpasswd.js';
import {
  loadConfig,
  getWhitelist,
  getBlacklist,
  setWhitelist,
  setBlacklist,
  addToWhitelist,
  addToBlacklist,
  removeFromWhitelist,
  removeFromBlacklist
} from './config.js';
import * as logger from './logger.js';

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export async function handleApiRequest(req, res) {
  const url = req.url || '';
  const method = req.method || 'GET';

  logger.debug('api', `${method} ${url}`);

  try {
    if (url === '/internal/api/credentials' && method === 'GET') {
      const creds = getCredentials();
      sendJson(res, 200, creds);
      return;
    }

    if (url === '/internal/api/credentials' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.username || !body.password) {
        sendJson(res, 400, { error: 'Missing username or password' });
        return;
      }
      const hashedPass = hashPassword(body.password);
      addCredential(body.username, hashedPass);
      await saveCredentials();
      logger.info('api', `Added credential for user '${body.username}'`);
      sendJson(res, 201, { username: body.username, hash: hashedPass });
      return;
    }

    if (url === '/internal/api/credentials' && method === 'DELETE') {
      const body = await parseBody(req);
      if (!body.username) {
        sendJson(res, 400, { error: 'Missing username' });
        return;
      }
      removeCredential(body.username, body.hash || null);
      await saveCredentials();
      logger.info('api', `Removed credential for user '${body.username}'${body.hash ? ` hash=${body.hash}` : ''}`);
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/internal/api/credentials/bulk' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.credential || !Array.isArray(body.credential)) {
        sendJson(res, 400, { error: 'Missing or invalid credential array' });
        return;
      }
      for (const cred of body.credential) {
        if (!cred.username || !cred.authorized || !Array.isArray(cred.authorized)) {
          sendJson(res, 400, { error: 'Each credential must have username and authorized array' });
          return;
        }
      }
      setCredentials({ credential: body.credential });
      await saveCredentials();
      logger.info('api', `Bulk loaded ${body.credential.length} users`);
      sendJson(res, 200, { success: true, count: body.credential.length });
      return;
    }

    if (url === '/internal/api/reload' && method === 'POST') {
      await loadCredentials();
      logger.info('api', 'Credentials reloaded');
      sendJson(res, 200, { success: true, message: 'Credentials reloaded' });
      return;
    }

    if (url === '/internal/api/htpasswd' && method === 'POST') {
      const result = await regenerateHtpasswd();
      logger.info('api', 'htpasswd regenerated');
      sendJson(res, 200, {
        success: true,
        message: 'htpasswd regenerated',
        username: result.username
      });
      return;
    }

    if (url === '/internal/api/htpasswd' && method === 'GET') {
      const creds = getSharedCredentials();
      sendJson(res, 200, { username: creds.username });
      return;
    }

    if (url === '/internal/api/whitelist' && method === 'GET') {
      sendJson(res, 200, { whitelist: getWhitelist() });
      return;
    }

    if (url === '/internal/api/whitelist' && method === 'POST') {
      const body = await parseBody(req);
      if (body.list && Array.isArray(body.list)) {
        setWhitelist(body.list);
        logger.info('api', `Whitelist set to ${body.list.length} entries`);
        sendJson(res, 200, { success: true, whitelist: getWhitelist() });
      } else if (body.add) {
        addToWhitelist(body.add);
        sendJson(res, 200, { success: true, whitelist: getWhitelist() });
      } else if (body.remove) {
        removeFromWhitelist(body.remove);
        sendJson(res, 200, { success: true, whitelist: getWhitelist() });
      } else {
        sendJson(res, 400, { error: 'Provide list, add, or remove' });
      }
      return;
    }

    if (url === '/internal/api/blacklist' && method === 'GET') {
      sendJson(res, 200, { blacklist: getBlacklist() });
      return;
    }

    if (url === '/internal/api/blacklist' && method === 'POST') {
      const body = await parseBody(req);
      if (body.list && Array.isArray(body.list)) {
        setBlacklist(body.list);
        logger.info('api', `Blacklist set to ${body.list.length} entries`);
        sendJson(res, 200, { success: true, blacklist: getBlacklist() });
      } else if (body.add) {
        addToBlacklist(body.add);
        sendJson(res, 200, { success: true, blacklist: getBlacklist() });
      } else if (body.remove) {
        removeFromBlacklist(body.remove);
        sendJson(res, 200, { success: true, blacklist: getBlacklist() });
      } else {
        sendJson(res, 400, { error: 'Provide list, add, or remove' });
      }
      return;
    }

    if (url === '/internal/api/config' && method === 'GET') {
      sendJson(res, 200, {
        whitelist: getWhitelist(),
        blacklist: getBlacklist(),
        sharedCreds: getSharedCredentials()
      });
      return;
    }

    if (url === '/internal/api/config/reload' && method === 'POST') {
      loadConfig();
      logger.info('api', 'Config reloaded');
      sendJson(res, 200, { success: true, message: 'Config reloaded' });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    logger.error('api', `Error: ${err.message}`);
    sendJson(res, 500, { error: err.message });
  }
}
