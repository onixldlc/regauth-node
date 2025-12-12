import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import * as logger from './logger.js';
import { getSharedCreds, setSharedCreds } from './config.js';

const HTPASSWD_FILE = '/registry-auth/htpasswd';
const REGISTRY_USER = 'registry_internal';

let sharedPassword = null;

function generateRandomPassword(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

export async function initHtpasswd() {
  try {
    const saved = getSharedCreds();
    if (saved && saved.password) {
      sharedPassword = saved.password;
      logger.info('htpasswd', 'Loaded existing shared credentials from config');
    } else {
      await regenerateHtpasswd();
    }
  } catch (err) {
    logger.error('htpasswd', `Failed to init: ${err.message}`);
    await regenerateHtpasswd();
  }
}

export async function regenerateHtpasswd() {
  sharedPassword = generateRandomPassword();
  try {
    const htpasswdEntry = execSync(
      `htpasswd -Bbn ${REGISTRY_USER} '${sharedPassword}'`,
      { encoding: 'utf8' }
    ).trim();
    fs.writeFileSync(HTPASSWD_FILE, htpasswdEntry + '\n', 'utf8');
    setSharedCreds({
      username: REGISTRY_USER,
      password: sharedPassword
    });
    logger.info('htpasswd', 'Regenerated htpasswd file');
    return { username: REGISTRY_USER, password: sharedPassword };
  } catch (err) {
    logger.error('htpasswd', `Failed to regenerate: ${err.message}`);
    throw err;
  }
}

export function getSharedCredentials() {
  return {
    username: REGISTRY_USER,
    password: sharedPassword
  };
}

export function getSharedAuthHeader() {
  const creds = `${REGISTRY_USER}:${sharedPassword}`;
  return 'Basic ' + Buffer.from(creds).toString('base64');
}
