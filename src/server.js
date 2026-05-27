"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
async function bootstrap() {
    await (0, db_1.connectDB)();
    const server = app_1.app.listen(env_1.env.PORT, () => {
        console.log(`Server running on http://localhost:${env_1.env.PORT}`);
    });
    server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
            console.error(`Port ${env_1.env.PORT} is already in use. Stop the other process and run npm run dev again.`);
            console.error("Windows: netstat -ano | findstr :5000  then  taskkill /PID <pid> /F");
        } else {
            console.error("Server listen error:", error);
        }
        process.exit(1);
    });
}
bootstrap().catch((error) => {
    console.error("Failed to start server:", error?.message ?? error);
    process.exit(1);
});
