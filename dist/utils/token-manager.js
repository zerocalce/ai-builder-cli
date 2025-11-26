"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenManager = void 0;
const events_1 = require("events");
/**
 * TokenManager: holds a token and schedules a warning at 75% of its lifetime
 * and schedules refresh/expiry. Emits events: 'warning', 'refreshed', 'expired'.
 */
class TokenManager extends events_1.EventEmitter {
    constructor(logger, refreshCallback) {
        super();
        this.warnTimer = null;
        this.expiryTimer = null;
        this.logger = logger;
        this.refreshCallback = refreshCallback;
    }
    setRefreshCallback(cb) {
        this.refreshCallback = cb;
    }
    setToken(value, expiresInSeconds, issuedAt) {
        var _a;
        this.token = {
            value,
            issuedAt: issuedAt || new Date(),
            expiresIn: expiresInSeconds
        };
        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug(`Token set; expires in ${expiresInSeconds}s (issued ${this.token.issuedAt.toISOString()})`);
        this.scheduleTimers();
    }
    getToken() {
        var _a;
        return (_a = this.token) === null || _a === void 0 ? void 0 : _a.value;
    }
    percentUsed() {
        if (!this.token)
            return 0;
        const now = Date.now();
        const issued = this.token.issuedAt.getTime();
        const total = this.token.expiresIn * 1000;
        const used = Math.max(0, Math.min(total, now - issued));
        return (used / total) * 100;
    }
    clearTimers() {
        if (this.warnTimer) {
            clearTimeout(this.warnTimer);
            this.warnTimer = null;
        }
        if (this.expiryTimer) {
            clearTimeout(this.expiryTimer);
            this.expiryTimer = null;
        }
    }
    scheduleTimers() {
        this.clearTimers();
        if (!this.token)
            return;
        const issued = this.token.issuedAt.getTime();
        const totalMs = this.token.expiresIn * 1000;
        const now = Date.now();
        const warnAt = issued + Math.floor(totalMs * 0.75);
        const expiryAt = issued + totalMs;
        const warnDelay = Math.max(0, warnAt - now);
        const expiryDelay = Math.max(0, expiryAt - now);
        // Schedule warning
        this.warnTimer = setTimeout(async () => {
            var _a, _b, _c;
            try {
                const pct = this.percentUsed();
                const msg = `Token usage reached ${pct.toFixed(1)}% (75% threshold)`;
                (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn(msg);
                this.emit('warning', { percent: pct, message: msg });
                // Optionally trigger a refresh if a callback is provided
                if (this.refreshCallback) {
                    const refreshed = await this.invokeRefresh();
                    if (refreshed) {
                        (_b = this.logger) === null || _b === void 0 ? void 0 : _b.info('Token refreshed by TokenManager at 75% threshold');
                        this.emit('refreshed', refreshed);
                    }
                }
            }
            catch (err) {
                (_c = this.logger) === null || _c === void 0 ? void 0 : _c.error('Error during token warning/refresh', err);
            }
        }, warnDelay);
        // Schedule expiry
        this.expiryTimer = setTimeout(() => {
            var _a;
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.warn('Token expired');
            this.emit('expired');
            // Clear stored token
            this.token = undefined;
            this.clearTimers();
        }, expiryDelay);
    }
    async invokeRefresh() {
        var _a, _b;
        try {
            if (!this.refreshCallback)
                return null;
            const res = await Promise.resolve(this.refreshCallback());
            if (!res)
                return null;
            // Update token and reschedule
            this.token = res;
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.debug(`TokenManager stored refreshed token; new expiry in ${res.expiresIn}s`);
            this.scheduleTimers();
            return res;
        }
        catch (err) {
            (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error('Token refresh failed', err);
            return null;
        }
    }
    async refreshNow() {
        return this.invokeRefresh();
    }
    stop() {
        this.clearTimers();
    }
}
exports.TokenManager = TokenManager;
// Simple usage example (commented):
// const tm = new TokenManager(logger, async () => {
//   // call your auth provider to get a new token
//   const token = await myAuth.refreshToken();
//   return { value: token.value, issuedAt: new Date(), expiresIn: token.expiresInSeconds };
// });
// tm.setToken('initial', 3600);
