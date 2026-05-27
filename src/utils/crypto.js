"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = sha256;
exports.randomToken = randomToken;
const crypto_1 = require("crypto");
function sha256(input) {
    return (0, crypto_1.createHash)("sha256").update(input).digest("hex");
}
function randomToken(bytes = 32) {
    return (0, crypto_1.randomBytes)(bytes).toString("hex");
}
