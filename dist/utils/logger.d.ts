export declare enum LogLevel {
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
export declare class Logger {
    private config;
    private level;
    constructor(config?: Partial<LoggerConfig>);
    debug(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, error?: Error, meta?: any): void;
    private shouldLog;
    private log;
    setLevel(level: LogLevel | string): void;
    setFormat(format: 'pretty' | 'json'): void;
}
