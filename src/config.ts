import { readFileSync } from "node:fs";
import { StrKey } from "@stellar/stellar-sdk";
import type { Config, NotifierConfig, Rule } from "./types.js";

const RULE_TYPES: Rule["type"][] = [
  "payment_received",
  "payment_sent",
  "signer_change",
  "account_merge",
  "threshold_change",
  "trustline_change",
  "any_operation",
];

/** Validate a parsed config object, throwing a readable error on the first problem. */
export function validateConfig(raw: unknown): Config {
  const c = raw as Partial<Config>;
  if (!c || typeof c !== "object") throw new Error("config must be a JSON object");
  if (typeof c.horizonUrl !== "string" || !/^https?:\/\//.test(c.horizonUrl)) {
    throw new Error("horizonUrl must be an http(s) URL");
  }
  if (!Array.isArray(c.accounts) || c.accounts.length === 0) {
    throw new Error("accounts must list at least one account to watch");
  }
  for (const a of c.accounts) {
    if (!a || !StrKey.isValidEd25519PublicKey(a.address)) {
      throw new Error(`invalid account address: ${JSON.stringify(a?.address)}`);
    }
  }
  if (!Array.isArray(c.rules) || c.rules.length === 0) throw new Error("rules must list at least one rule");
  for (const r of c.rules) {
    if (!RULE_TYPES.includes(r?.type)) throw new Error(`unknown rule type: ${JSON.stringify(r?.type)}`);
    const min = (r as { minAmount?: unknown }).minAmount;
    if (min !== undefined && (typeof min !== "number" || min < 0)) {
      throw new Error(`${r.type}.minAmount must be a non-negative number`);
    }
  }
  if (!Array.isArray(c.notifiers) || c.notifiers.length === 0) {
    throw new Error("notifiers must list at least one notifier");
  }
  for (const n of c.notifiers as NotifierConfig[]) {
    if (n.type === "console") continue;
    const url = n.type === "webhook" ? n.url : n.type === "discord" || n.type === "slack" ? n.webhookUrl : undefined;
    if (url === undefined) throw new Error(`unknown notifier type: ${JSON.stringify((n as { type?: unknown }).type)}`);
    if (!/^https:\/\//.test(url)) throw new Error(`${n.type} notifier needs an https URL`);
  }
  return c as Config;
}

/** Load a config file, expanding ${ENV_VAR} references so secrets stay out of the file. */
export function loadConfig(path: string, env: NodeJS.ProcessEnv = process.env): Config {
  const text = readFileSync(path, "utf8").replace(/\$\{([A-Z0-9_]+)\}/g, (_, name: string) => {
    const value = env[name];
    if (value === undefined) throw new Error(`config references \${${name}} but it isn't set`);
    return value;
  });
  return validateConfig(JSON.parse(text));
}
