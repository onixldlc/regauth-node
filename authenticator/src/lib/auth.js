import fs from 'fs';
import crypto from 'crypto';
import * as logger from './logger.js';

const AUTH_FILE = '/data/auth.json';
const PAT_REGEX = /^MYCR_[A-Za-z0-9]{32}$/;

let credentials = { credential: [] };

export function hashPassword(password) {
  return crypto.createHash('sha1').update(password).digest('hex');
}

export function isValidPat(password) {
  return PAT_REGEX.test(password);
}

export async function loadCredentials() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const data = fs.readFileSync(AUTH_FILE, 'utf8');
      credentials = JSON.parse(data);
      logger.info('auth', `Loaded ${credentials.credential.length} users`);
    } else {
      credentials = { credential: [] };
      await saveCredentials();
      logger.info('auth', 'Created empty auth.json');
    }
  } catch (err) {
    logger.error('auth', `Failed to load credentials: ${err.message}`);
    credentials = { credential: [] };
  }
}

export async function saveCredentials() {
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(credentials, null, 2), 'utf8');
    logger.debug('auth', 'Credentials saved');
  } catch (err) {
    logger.error('auth', `Failed to save credentials: ${err.message}`);
    throw err;
  }
}

export function getCredentials() {
  return credentials;
}

export function setCredentials(newCredentials) {
  credentials = newCredentials;
}

export function validateBasicAuth(username, password) {
  const hashedInput = hashPassword(password);
  const user = credentials.credential.find(c => c.username === username);
  if (!user) {
    return false;
  }
  return user.authorized.includes(hashedInput);
}

export function parseBasicAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }
  try {
    const base64 = authHeader.slice(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return null;
    }
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);
    return { username, password };
  } catch {
    return null;
  }
}

export function addCredential(username, hashedPass) {
  let user = credentials.credential.find(c => c.username === username);
  if (!user) {
    user = { username, authorized: [] };
    credentials.credential.push(user);
  }
  if (!user.authorized.includes(hashedPass)) {
    user.authorized.push(hashedPass);
  }
  return hashedPass;
}

export function removeCredential(username, hash = null) {
  if (hash) {
    const user = credentials.credential.find(c => c.username === username);
    if (user) {
      user.authorized = user.authorized.filter(h => h !== hash);
      if (user.authorized.length === 0) {
        credentials.credential = credentials.credential.filter(c => c.username !== username);
      }
    }
  } else {
    credentials.credential = credentials.credential.filter(c => c.username !== username);
  }
}
