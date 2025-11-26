import { Logger } from '../types';
import { TokenRecord } from '../utils/token-manager';
/**
 * CloudCredentialManager integrates TokenManager to manage cloud tokens.
 * It accepts a refresh function that obtains a new token from the cloud provider.
 */
export declare class CloudCredentialManager {
    private logger?;
    private tm;
    constructor(logger?: Logger | undefined, refreshFn?: () => Promise<TokenRecord | null>);
    setToken(value: string, expiresInSeconds: number, issuedAt?: Date): void;
    getToken(): string | undefined;
    on(event: 'warning' | 'refreshed' | 'expired', cb: (...args: any[]) => void): void;
    refreshNow(): Promise<TokenRecord | null>;
    stop(): void;
}
