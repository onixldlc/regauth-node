import fs from 'fs';
import path from 'path';

const LOG_DIR = '/data/logs';
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getTimestamp() {
  return new Date().toISOString();
}

function formatMessage(level, module, message) {
  return `[${getTimestamp()}] [${level}] [${module}] ${message}`;
}

function writeToFile(formatted) {
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, formatted + '\n', 'utf8');
  } catch (err) {
    console.error(`[logger] Failed to write to log file: ${err.message}`);
  }
}

export function info(module, message) {
  const formatted = formatMessage('INFO', module, message);
  console.log(formatted);
  writeToFile(formatted);
}

export function warn(module, message) {
  const formatted = formatMessage('WARN', module, message);
  console.warn(formatted);
  writeToFile(formatted);
}

export function error(module, message) {
  const formatted = formatMessage('ERROR', module, message);
  console.error(formatted);
  writeToFile(formatted);
}

export function debug(module, message) {
  const formatted = formatMessage('DEBUG', module, message);
  console.log(formatted);
  writeToFile(formatted);
}

export function access(module, message) {
  const formatted = formatMessage('ACCESS', module, message);
  console.log(formatted);
  writeToFile(formatted);
}
