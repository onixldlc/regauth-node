import fs from 'fs';
import crypto from 'crypto';
import * as logger from './logger.js';

let CONFIG_FILE = '/data/config.json';

const DEFAULT_CONFIG = {
  apikey: null,
  whitelist: [],
  blacklist: [],
  hashAlgorithm: null,
  sharedCreds: null
};

let config = { ...DEFAULT_CONFIG };

function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

export function loadConfig(configPath) {
  if (configPath) {
    CONFIG_FILE = configPath;
  }
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const loaded = JSON.parse(data);
      config = { ...DEFAULT_CONFIG, ...loaded };
      logger.info('config', `Loaded config from ${CONFIG_FILE}: whitelist=${config.whitelist.length}, blacklist=${config.blacklist.length}`);
    } else {
      config = { ...DEFAULT_CONFIG };
      config.apikey = generateRandomString(32);
      logger.info('config', `Generated new API key: ${config.apikey}`);
      saveConfig();
      logger.info('config', 'Created default config.json');
    }
  } catch (err) {
    logger.error('config', `Failed to load config: ${err.message}`);
    config = { ...DEFAULT_CONFIG };
  }
  return config;
}

export function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    logger.debug('config', 'Config saved');
  } catch (err) {
    logger.error('config', `Failed to save config: ${err.message}`);
    throw err;
  }
}

export function getConfig() {
  return config;
}

export function getApiKey() {
  return config.apikey;
}

export function setApiKey(key) {
  config.apikey = key;
  saveConfig();
}

export function getWhitelist() {
  return [...(config.whitelist || [])];
}

export function getBlacklist() {
  return [...(config.blacklist || [])];
}

export function setWhitelist(list) {
  config.whitelist = Array.isArray(list) ? list : [];
  saveConfig();
  logger.info('config', `Whitelist set to ${config.whitelist.length} entries`);
}

export function setBlacklist(list) {
  config.blacklist = Array.isArray(list) ? list : [];
  saveConfig();
  logger.info('config', `Blacklist set to ${config.blacklist.length} entries`);
}

export function addToWhitelist(entry) {
  if (!config.whitelist.includes(entry)) {
    config.whitelist.push(entry);
    saveConfig();
    logger.info('config', `Added '${entry}' to whitelist`);
  }
}

export function addToBlacklist(entry) {
  if (!config.blacklist.includes(entry)) {
    config.blacklist.push(entry);
    saveConfig();
    logger.info('config', `Added '${entry}' to blacklist`);
  }
}

export function removeFromWhitelist(entry) {
  const idx = config.whitelist.indexOf(entry);
  if (idx !== -1) {
    config.whitelist.splice(idx, 1);
    saveConfig();
    logger.info('config', `Removed '${entry}' from whitelist`);
  }
}

export function removeFromBlacklist(entry) {
  const idx = config.blacklist.indexOf(entry);
  if (idx !== -1) {
    config.blacklist.splice(idx, 1);
    saveConfig();
    logger.info('config', `Removed '${entry}' from blacklist`);
  }
}

export function setHashAlgorithm(algorithm) {
  allowedAlgorithms = ['sha512', 'sha256', 'md5'];
  if (!allowedAlgorithms.includes(algorithm)) {
    logger.warn('config', `Invalid hash algorithm '${algorithm}' provided, falling back to 'sha256'`);
    algorithm = 'sha256';
  }
  config.hashAlgorithm = algorithm;
  saveConfig();
  logger.info('config', `Set hash algorithm to '${algorithm}'`);
}

export function getHashAlgorithm() {
  return config.hashAlgorithm;
}

export function getSharedCreds() {
  return config.sharedCreds;
}

export function setSharedCreds(creds) {
  config.sharedCreds = creds;
  saveConfig();
}

function normalizeIp(ip) {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }
  return ip;
}

function matchesEntry(value, entry) {
  if (!value || !entry) return false;
  const normalizedValue = normalizeIp(value);
  const normalizedEntry = normalizeIp(entry);
  return normalizedValue === normalizedEntry ||
         value === entry ||
         normalizedValue.includes(normalizedEntry) ||
         value.includes(entry);
}

export function checkAccess(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const rawClientIp = req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
  const clientIp = normalizeIp(rawClientIp);

  const effectiveIp = forwarded ? forwarded.split(',')[0].trim() :
                      realIp ? realIp :
                      clientIp;

  logger.debug('config', `Access check: effectiveIp='${effectiveIp}' rawIp='${clientIp}' x-forwarded-for='${forwarded || 'none'}' x-real-ip='${realIp || 'none'}'`);

  const whitelist = config.whitelist || [];
  const blacklist = config.blacklist || [];

  if (blacklist.length > 0) {
    for (const entry of blacklist) {
      if (matchesEntry(effectiveIp, entry) || matchesEntry(clientIp, entry)) {
        logger.access('config', `DENIED (blacklist) ip='${effectiveIp}' matched='${entry}'`);
        return { allowed: false, reason: 'blacklisted', ip: effectiveIp };
      }
    }
  }

  if (whitelist.length === 0) {
    logger.debug('config', 'Whitelist empty, allowing all');
    logger.access('config', `ALLOWED (no whitelist) ip='${effectiveIp}'`);
    return { allowed: true, reason: 'no_whitelist', ip: effectiveIp };
  }

  for (const entry of whitelist) {
    if (matchesEntry(effectiveIp, entry) || matchesEntry(clientIp, entry)) {
      logger.access('config', `ALLOWED (whitelist) ip='${effectiveIp}' matched='${entry}'`);
      return { allowed: true, reason: 'whitelisted', ip: effectiveIp };
    }
  }

  logger.access('config', `DENIED (not whitelisted) ip='${effectiveIp}'`);
  return { allowed: false, reason: 'not_whitelisted', ip: effectiveIp };
}
