import { buildApp } from "./app";
import { loadEnv } from "./config/env";
import "dotenv/config";

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp({ env });

  await app.listen({
    host: env.HOST,
    port: env.PORT,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
