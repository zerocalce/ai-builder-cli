import { EventEmitter } from 'events';
import { Logger } from '../types';

export interface TokenRecord {
  value: string;
  issuedAt: Date;
  expiresIn: number; // seconds
}

export type RefreshCallback = () => Promise<TokenRecord | null> | TokenRecord | null;

/**
 * TokenManager: holds a token and schedules a warning at 75% of its lifetime
 * and schedules refresh/expiry. Emits events: 'warning', 'refreshed', 'expired'.
 */
export class TokenManager extends EventEmitter {
  private token?: TokenRecord;
  private logger?: Logger;
  private refreshCallback?: RefreshCallback;
  private warnTimer?: NodeJS.Timeout | null = null;
  private expiryTimer?: NodeJS.Timeout | null = null;

  constructor(logger?: Logger, refreshCallback?: RefreshCallback) {
    super();
    this.logger = logger;
    this.refreshCallback = refreshCallback;
  }

  setRefreshCallback(cb: RefreshCallback) {
    this.refreshCallback = cb;
  }

  setToken(value: string, expiresInSeconds: number, issuedAt?: Date) {
    this.token = {
      value,
      issuedAt: issuedAt || new Date(),
      expiresIn: expiresInSeconds
    };

    this.logger?.debug(`Token set; expires in ${expiresInSeconds}s (issued ${this.token.issuedAt.toISOString()})`);
    this.scheduleTimers();
  }

  getToken(): string | undefined {
    return this.token?.value;
  }

  percentUsed(): number {
    if (!this.token) return 0;
    const now = Date.now();
    const issued = this.token.issuedAt.getTime();
    const total = this.token.expiresIn * 1000;
    const used = Math.max(0, Math.min(total, now - issued));
    return (used / total) * 100;
  }

  private clearTimers() {
    if (this.warnTimer) {
      clearTimeout(this.warnTimer);
      this.warnTimer = null;
    }
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private scheduleTimers() {
    this.clearTimers();
    if (!this.token) return;

    const issued = this.token.issuedAt.getTime();
    const totalMs = this.token.expiresIn * 1000;
    const now = Date.now();

    const warnAt = issued + Math.floor(totalMs * 0.75);
    const expiryAt = issued + totalMs;

    const warnDelay = Math.max(0, warnAt - now);
    const expiryDelay = Math.max(0, expiryAt - now);

    // Schedule warning
    this.warnTimer = setTimeout(async () => {
      try {
        const pct = this.percentUsed();
        const msg = `Token usage reached ${pct.toFixed(1)}% (75% threshold)`;
        this.logger?.warn(msg);
        this.emit('warning', { percent: pct, message: msg });

        // Optionally trigger a refresh if a callback is provided
        if (this.refreshCallback) {
          const refreshed = await this.invokeRefresh();
          if (refreshed) {
            this.logger?.info('Token refreshed by TokenManager at 75% threshold');
            this.emit('refreshed', refreshed);
          }
        }
      } catch (err) {
        this.logger?.error('Error during token warning/refresh', err as Error);
      }
    }, warnDelay);

    // Schedule expiry
    this.expiryTimer = setTimeout(() => {
      this.logger?.warn('Token expired');
      this.emit('expired');
      // Clear stored token
      this.token = undefined;
      this.clearTimers();
    }, expiryDelay);
  }

  private async invokeRefresh(): Promise<TokenRecord | null> {
    try {
      if (!this.refreshCallback) return null;
      const res = await Promise.resolve(this.refreshCallback());
      if (!res) return null;

      // Update token and reschedule
      this.token = res;
      this.logger?.debug(`TokenManager stored refreshed token; new expiry in ${res.expiresIn}s`);
      this.scheduleTimers();
      return res;
    } catch (err) {
      this.logger?.error('Token refresh failed', err as Error);
      return null;
    }
  }

  async refreshNow(): Promise<TokenRecord | null> {
    return this.invokeRefresh();
  }

  stop() {
    this.clearTimers();
  }
}

// Simple usage example (commented):
// const tm = new TokenManager(logger, async () => {
//   // call your auth provider to get a new token
//   const token = await myAuth.refreshToken();
//   return { value: token.value, issuedAt: new Date(), expiresIn: token.expiresInSeconds };
// });
// tm.setToken('initial', 3600);
