"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const token_manager_1 = require("../src/utils/token-manager");
describe('TokenManager timing and refresh behavior', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });
    it('emits warning at ~75% and calls refresh callback', async () => {
        const logs = [];
        const logger = {
            debug: jest.fn((m) => logs.push(`debug:${m}`)),
            info: jest.fn((m) => logs.push(`info:${m}`)),
            warn: jest.fn((m) => logs.push(`warn:${m}`)),
            error: jest.fn((m) => logs.push(`error:${m}`))
        };
        const refreshedToken = {
            value: 'refreshed-token',
            // ensure issuedAt uses the (fake) Date.now so timers align
            issuedAt: new Date(Date.now()),
            expiresIn: 100 // seconds
        };
        const refreshCb = jest.fn(async () => {
            // emulate small async delay
            await Promise.resolve();
            // return a token whose issuedAt is based on current (fake) Date.now()
            return { ...refreshedToken, issuedAt: new Date(Date.now()) };
        });
        const tm = new token_manager_1.TokenManager(logger, refreshCb);
        // Set initial token with short expiry (100s)
        const now = new Date();
        tm.setToken('initial-token', 100, now);
        const refreshedHandler = jest.fn();
        const warningHandler = jest.fn();
        tm.on('refreshed', refreshedHandler);
        tm.on('warning', warningHandler);
        // Advance time to just before 75%: 74s
        jest.advanceTimersByTime(74000);
        // no warning yet
        expect(warningHandler).not.toHaveBeenCalled();
        // Move to 75% threshold (1s later)
        jest.advanceTimersByTime(1000);
        // Run any pending timers and microtasks so the async refresh completes
        jest.runOnlyPendingTimers();
        // flush microtasks
        await Promise.resolve();
        await Promise.resolve();
        // schedule and run a zero-delay timer to ensure any queued tasks execute
        const flush = new Promise((res) => setTimeout(res, 0));
        jest.advanceTimersByTime(0);
        await flush;
        expect(warningHandler).toHaveBeenCalled();
        expect(refreshCb).toHaveBeenCalled();
        expect(refreshedHandler).toHaveBeenCalled();
        expect(tm.getToken()).toBe('refreshed-token');
        tm.stop();
    });
    it('expires token and emits expired when no refresh available', async () => {
        const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        const tm = new token_manager_1.TokenManager(logger);
        const expiredHandler = jest.fn();
        tm.on('expired', expiredHandler);
        tm.setToken('short', 2); // 2 seconds
        // advance beyond expiry
        jest.advanceTimersByTime(3000);
        expect(expiredHandler).toHaveBeenCalled();
        expect(tm.getToken()).toBeUndefined();
        tm.stop();
    });
    it('handles refresh callback throwing an error', async () => {
        const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        const badRefresh = jest.fn(async () => {
            throw new Error('refresh failed');
        });
        const tm = new token_manager_1.TokenManager(logger, badRefresh);
        const warningHandler = jest.fn();
        tm.on('warning', warningHandler);
        tm.setToken('will-fail', 10);
        // advance to 75% (7.5s -> use 7500ms)
        jest.advanceTimersByTime(7500);
        // flush
        await Promise.resolve();
        expect(warningHandler).toHaveBeenCalled();
        expect(badRefresh).toHaveBeenCalled();
        // logger.error should have been invoked by TokenManager when refresh failed
        expect(logger.error).toHaveBeenCalled();
        tm.stop();
    });
    it('refreshNow invokes the refresh callback immediately', async () => {
        const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        const refreshedToken = { value: 'now-token', issuedAt: new Date(), expiresIn: 60 };
        const refreshCb = jest.fn(async () => refreshedToken);
        const tm = new token_manager_1.TokenManager(logger, refreshCb);
        const res = await tm.refreshNow();
        expect(refreshCb).toHaveBeenCalled();
        expect(res).toEqual(refreshedToken);
        expect(tm.getToken()).toBe('now-token');
        tm.stop();
    });
});
