import { createApp } from "./app.js";
import { devAuthEnabled, env, ssoConfigured } from "./env.js";

createApp().listen(env.port, () => {
  console.log(`\n  Lantern Roster backend listening on http://localhost:${env.port}`);
  console.log(`  Microsoft sign-in: ${ssoConfigured ? "configured" : "NOT configured (set MICROSOFT_* in .env.local)"}`);
  if (devAuthEnabled) console.log("  Dev sign-in: ON (local prototype only — DEV_AUTH=false to disable)");
  console.log(`  Public API: http://localhost:${env.port}/api/v1  (API key required)\n`);
});
