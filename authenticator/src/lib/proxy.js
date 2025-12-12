import http from 'http';
import { parseBasicAuth, validateBasicAuth } from './auth.js';
import { getSharedAuthHeader } from './htpasswd.js';
import * as logger from './logger.js';

const REGISTRY_HOST = process.env.REGISTRY_HOST || 'registry';
const REGISTRY_PORT = process.env.REGISTRY_PORT || 5000;

export async function handleProxyRequest(clientReq, clientRes) {
  const clientIp = clientReq.socket?.remoteAddress || 'unknown';
  const authHeader = clientReq.headers['authorization'];
  const parsed = parseBasicAuth(authHeader);

  if (!parsed) {
    logger.info('proxy', `No auth header from ${clientIp} for ${clientReq.method} ${clientReq.url}`);
    clientRes.writeHead(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Basic realm="Registry Realm"'
    });
    clientRes.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  if (!validateBasicAuth(parsed.username, parsed.password)) {
    logger.warn('proxy', `Auth failed for user '${parsed.username}' from ${clientIp}`);
    clientRes.writeHead(401, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Basic realm="Registry Realm"'
    });
    clientRes.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  logger.info('proxy', `Auth OK for user '${parsed.username}' from ${clientIp} - ${clientReq.method} ${clientReq.url}`);

  const headers = { ...clientReq.headers };
  headers['authorization'] = getSharedAuthHeader();
  delete headers['host'];

  const options = {
    hostname: REGISTRY_HOST,
    port: REGISTRY_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    logger.debug('proxy', `Registry responded ${proxyRes.statusCode} for ${clientReq.method} ${clientReq.url}`);
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on('error', (err) => {
    logger.error('proxy', `Proxy error: ${err.message}`);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: 'Bad Gateway' }));
    }
  });

  clientReq.pipe(proxyReq, { end: true });
}
