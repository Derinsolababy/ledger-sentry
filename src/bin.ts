#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { start } from "./sentry.js";

const path = process.argv[2] ?? "sentry.config.json";
try {
  const config = loadConfig(path);
  const stop = start(config);
  const shutdown = () => {
    console.log("[ledger-sentry] stopping");
    stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (err) {
  console.error(`ledger-sentry: ${err instanceof Error ? err.message : String(err)}`);
  console.error("usage: ledger-sentry [path/to/sentry.config.json]");
  process.exit(1);
}
