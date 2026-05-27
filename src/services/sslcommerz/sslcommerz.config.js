"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSslCommerzLive = useSslCommerzLive;
const env_1 = require("../../config/env");
function useSslCommerzLive() {
    if (env_1.env.SSLCOMMERZ_SANDBOX_MODE) {
        return false;
    }
    return Boolean(env_1.env.SSLCOMMERZ_STORE_ID && env_1.env.SSLCOMMERZ_STORE_PASSWORD);
}
