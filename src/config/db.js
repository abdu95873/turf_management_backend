"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const globalCache = global;
if (!globalCache.__mongooseCache) {
    globalCache.__mongooseCache = { conn: null, promise: null };
}
const cache = globalCache.__mongooseCache;
async function connectDB() {
    if (cache.conn) {
        return cache.conn;
    }
    if (!cache.promise) {
        cache.promise = mongoose_1.default.connect(env_1.env.MONGODB_URI).then((mongoose) => {
            const { host, name } = mongoose.connection;
            console.log(`MongoDB connected: ${host}/${name}`);
            return mongoose;
        });
    }
    cache.conn = await cache.promise;
    return cache.conn;
}
