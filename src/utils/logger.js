const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.logDir = options.logDir || 'logs';
    this.file = options.file || 'bot.log';
    fs.mkdirSync(this.logDir, { recursive: true });
    this.filePath = path.join(this.logDir, this.file);
    this.levelMap = { debug: 10, info: 20, warn: 30, error: 40 };
  }

  write(level, message, meta = {}) {
    if (this.levelMap[level] < this.levelMap[this.level]) return;
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...meta
    };
    const line = JSON.stringify(entry);
    console.log(line);
    fs.appendFileSync(this.filePath, `${line}\n`);
  }

  debug(message, meta) { this.write('debug', message, meta); }
  info(message, meta) { this.write('info', message, meta); }
  warn(message, meta) { this.write('warn', message, meta); }
  error(message, meta) { this.write('error', message, meta); }
}

module.exports = { Logger };
