import { EventEmitter } from 'events';
import { Logger } from '../types';
export interface TokenRecord {
    value: string;
    issuedAt: Date;
    expiresIn: number;
}
export type RefreshCallback = () => Promise<TokenRecord | null> | TokenRecord | null;
/**
 * TokenManager: holds a token and schedules a warning at 75% of its lifetime
 * and schedules refresh/expiry. Emits events: 'warning', 'refreshed', 'expired'.
 */
export declare class TokenManager extends EventEmitter {
    private token?;
    private logger?;
    private refreshCallback?;
    private warnTimer?;
    private expiryTimer?;
    constructor(logger?: Logger, refreshCallback?: RefreshCallback);
    setRefreshCallback(cb: RefreshCallback): void;
    setToken(value: string, expiresInSeconds: number, issuedAt?: Date): void;
    getToken(): string | undefined;
    percentUsed(): number;
    private clearTimers;
    private scheduleTimers;
    private invokeRefresh;
    refreshNow(): Promise<TokenRecord | null>;
    stop(): void;
}
