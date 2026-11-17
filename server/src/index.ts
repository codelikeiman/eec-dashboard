import { createApp } from "./app.js";
import { env } from "./env.js";

createApp().listen(env.port, () => {
  console.log(`EEC dashboard API listening on http://localhost:${env.port}`);
});
