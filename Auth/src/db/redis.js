// Redis client. Uses real Redis in non-test environments and a lightweight
// in-memory mock for tests to avoid touching production/shared Redis.
const { Redis } = require("ioredis");

if (process.env.NODE_ENV === "test") {
    // Simple in-memory mock implementing subset of ioredis we use (set, get, del, quit)
    const store = new Map();

    const mock = {
        async set(key, value, mode, ttlSeconds) {
            let expiresAt = null;
            if (mode === "EX" && typeof ttlSeconds === "number") {
                expiresAt = Date.now() + ttlSeconds * 1000;
            }
            store.set(key, { value, expiresAt });
            return "OK";
        },
        async get(key) {
            const entry = store.get(key);
            if (!entry) return null;
            if (entry.expiresAt && Date.now() > entry.expiresAt) {
                store.delete(key);
                return null;
            }
            return entry.value;
        },
        async del(key) {
            store.delete(key);
            return 1;
        },
        async quit() {
            store.clear();
            return "OK";
        }
    };

    module.exports = mock;
} else {
    const redis = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
    });

    redis.on("connect", () => {
        console.log("Connected to Redis");
    });

    module.exports = redis;
}
