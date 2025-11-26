"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudCredentialManager = void 0;
const token_manager_1 = require("../utils/token-manager");
/**
 * CloudCredentialManager integrates TokenManager to manage cloud tokens.
 * It accepts a refresh function that obtains a new token from the cloud provider.
 */
class CloudCredentialManager {
    constructor(logger, refreshFn) {
        this.logger = logger;
        this.tm = new token_manager_1.TokenManager(logger, refreshFn ? refreshFn : undefined);
    }
    setToken(value, expiresInSeconds, issuedAt) {
        this.tm.setToken(value, expiresInSeconds, issuedAt);
    }
    getToken() {
        return this.tm.getToken();
    }
    on(event, cb) {
        this.tm.on(event, cb);
    }
    async refreshNow() {
        return this.tm.refreshNow();
    }
    stop() {
        this.tm.stop();
    }
}
exports.CloudCredentialManager = CloudCredentialManager;
