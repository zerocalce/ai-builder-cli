"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
class Logger {
    constructor(config = {}) {
        this.config = {
            level: LogLevel.INFO,
            format: 'pretty',
            output: 'console',
            ...config
        };
        this.level = typeof this.config.level === 'string'
            ? LogLevel[this.config.level.toUpperCase()]
            : this.config.level;
    }
    debug(message, meta) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            this.log(LogLevel.DEBUG, message, meta);
        }
    }
    info(message, meta) {
        if (this.shouldLog(LogLevel.INFO)) {
            this.log(LogLevel.INFO, message, meta);
        }
    }
    warn(message, meta) {
        if (this.shouldLog(LogLevel.WARN)) {
            this.log(LogLevel.WARN, message, meta);
        }
    }
    error(message, error, meta) {
        if (this.shouldLog(LogLevel.ERROR)) {
            const errorMeta = error ? {
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                },
                ...meta
            } : meta;
            this.log(LogLevel.ERROR, message, errorMeta);
        }
    }
    shouldLog(level) {
        return level >= this.level;
    }
    log(level, message, meta) {
        const timestamp = new Date().toISOString();
        const levelName = LogLevel[level].toString().toUpperCase();
        if (this.config.format === 'json') {
            const logEntry = {
                timestamp,
                level: levelName,
                message,
                ...(meta && { meta })
            };
            console.log(JSON.stringify(logEntry));
        }
        else {
            const colors = {
                [LogLevel.DEBUG]: '\x1b[36m',
                [LogLevel.INFO]: '\x1b[32m',
                [LogLevel.WARN]: '\x1b[33m',
                [LogLevel.ERROR]: '\x1b[31m' // red
            };
            const reset = '\x1b[0m';
            const color = colors[level];
            console.log(`${color}[${timestamp}] ${levelName}:${reset} ${message}`);
            if (meta) {
                if (meta.error) {
                    console.log(`${color}  Error: ${meta.error.message}${reset}`);
                    if (this.shouldLog(LogLevel.DEBUG)) {
                        console.log(`${color}  Stack: ${meta.error.stack}${reset}`);
                    }
                }
                else {
                    try {
                        console.log(`${color}  Meta: ${JSON.stringify(meta, null, 2)}${reset}`);
                    }
                    catch (_) {
                        console.log(`${color}  Meta: [unserializable]${reset}`);
                    }
                }
            }
        }
    }
    setLevel(level) {
        this.level = typeof level === 'string'
            ? LogLevel[level.toUpperCase()]
            : level;
    }
    setFormat(format) {
        this.config.format = format;
    }
}
exports.Logger = Logger;
