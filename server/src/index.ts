import { createApp } from "./create-app.js";
import { env } from "./env.js";

/**
 * Entry point. On Vercel the exported app runs as a serverless function
 * (Vercel's Express preset picks up this default export). Everywhere else
 * (local dev, Railway, Render, a VPS) it listens on PORT as a normal server.
 */
const app = createApp();
export default app;

if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`EEC dashboard API listening on http://localhost:${env.port}`);
  });
}
