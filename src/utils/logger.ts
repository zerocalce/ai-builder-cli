export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LoggerConfig {
  level: LogLevel | string;
  format: 'pretty' | 'json';
  output?: 'console' | 'file';
  filePath?: string;
}

export class Logger {
  private config: LoggerConfig;
  private level: LogLevel;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      format: 'pretty',
      output: 'console',
      ...config
    };

    this.level = typeof this.config.level === 'string' 
      ? LogLevel[this.config.level.toUpperCase() as keyof typeof LogLevel] 
      : this.config.level;
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, meta);
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, meta);
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, meta);
    }
  }

  error(message: string, error?: Error, meta?: any): void {
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

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private log(level: LogLevel, message: string, meta?: any): void {
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
    } else {
      const colors = {
        [LogLevel.DEBUG]: '\x1b[36m', // cyan
        [LogLevel.INFO]: '\x1b[32m',  // green
        [LogLevel.WARN]: '\x1b[33m',  // yellow
        [LogLevel.ERROR]: '\x1b[31m'  // red
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
        } else {
          try {
            console.log(`${color}  Meta: ${JSON.stringify(meta, null, 2)}${reset}`);
          } catch (_) {
            console.log(`${color}  Meta: [unserializable]${reset}`);
          }
        }
      }
    }
  }

  setLevel(level: LogLevel | string): void {
    this.level = typeof level === 'string' 
      ? LogLevel[level.toUpperCase() as keyof typeof LogLevel] 
      : level;
  }

  setFormat(format: 'pretty' | 'json'): void {
    this.config.format = format;
  }
}
