import { Logger } from '../types';
import { TokenManager, TokenRecord } from '../utils/token-manager';

/**
 * CloudCredentialManager integrates TokenManager to manage cloud tokens.
 * It accepts a refresh function that obtains a new token from the cloud provider.
 */
export class CloudCredentialManager {
  private tm: TokenManager;

  constructor(private logger?: Logger, refreshFn?: () => Promise<TokenRecord | null>) {
    this.tm = new TokenManager(logger, refreshFn ? refreshFn : undefined);
  }

  setToken(value: string, expiresInSeconds: number, issuedAt?: Date) {
    this.tm.setToken(value, expiresInSeconds, issuedAt);
  }

  getToken(): string | undefined {
    return this.tm.getToken();
  }

  on(event: 'warning' | 'refreshed' | 'expired', cb: (...args: any[]) => void) {
    this.tm.on(event, cb as any);
  }

  async refreshNow() {
    return this.tm.refreshNow();
  }

  stop() {
    this.tm.stop();
  }
}
