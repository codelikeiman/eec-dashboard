import express from "express";
import { configureApp } from "./create-app.js";
import { env } from "./env.js";

/**
 * Entry point. Vercel's Express preset needs this file to import express and
 * export the app as default; it then runs as a serverless function. Everywhere
 * else (local dev, Railway, Render, a VPS) it listens on PORT as a normal server.
 */
const app = express();
configureApp(app);
export default app;

if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`EEC dashboard API listening on http://localhost:${env.port}`);
  });
}
