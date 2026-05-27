import { app } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";

async function bootstrap(): Promise<void> {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
