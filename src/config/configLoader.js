const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  return argv.reduce((acc, token) => {
    if (!token.startsWith('--')) return acc;
    const [k, v] = token.replace('--', '').split('=');
    acc[k] = v ?? true;
    return acc;
  }, {});
}

function mergeConfig(base, profile) {
  return {
    ...base,
    ...profile,
    risk: { ...(base.risk || {}), ...(profile.risk || {}) },
    strategy: { ...(base.strategy || {}), ...(profile.strategy || {}) }
  };
}

/**
 * Загружает JSON-конфиг и объединяет его с выбранным профилем.
 */
function loadConfig({ configPath = 'config.json', profile = 'balanced' } = {}) {
  const abs = path.resolve(configPath);
  if (!fs.existsSync(abs)) throw new Error(`Config not found: ${abs}`);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const profileCfg = raw.profiles?.[profile];
  if (!profileCfg) throw new Error(`Profile ${profile} not found`);

  return {
    ...mergeConfig(raw, profileCfg),
    selectedProfile: profile
  };
}

function validateConfig(config) {
  const errs = [];
  if (!Array.isArray(config.symbols) || config.symbols.length === 0) errs.push('symbols must be non-empty');
  if (!config.mode) errs.push('mode is required');
  if (!config.risk) errs.push('risk block is required');
  if (config.mode === 'liveMode' && !config.liveMode?.enabled) errs.push('liveMode.enabled must be true for liveMode');
  if (errs.length) throw new Error(`Config validation failed: ${errs.join(', ')}`);
}

module.exports = { loadConfig, validateConfig, parseArgs };
