import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, validateConfig } from "./config.js";
import { CursorStore } from "./cursors.js";
import { handleOperation } from "./sentry.js";

const ME = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const valid = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  accounts: [{ address: ME }],
  rules: [{ type: "payment_received" }],
  notifiers: [{ type: "console" }],
};

describe("config", () => {
  it("accepts a valid config", () => {
    expect(validateConfig(valid)).toEqual(valid);
  });

  it.each([
    [{ ...valid, horizonUrl: "ftp://x" }, /horizonUrl/],
    [{ ...valid, accounts: [] }, /at least one account/],
    [{ ...valid, accounts: [{ address: "GNOPE" }] }, /invalid account address/],
    [{ ...valid, rules: [{ type: "moon_landing" }] }, /unknown rule type/],
    [{ ...valid, rules: [{ type: "payment_sent", minAmount: -1 }] }, /minAmount/],
    [{ ...valid, notifiers: [{ type: "discord", webhookUrl: "http://insecure" }] }, /https/],
  ])("rejects invalid config %#", (config, message) => {
    expect(() => validateConfig(config)).toThrow(message);
  });

  it("expands ${ENV} references and fails on missing ones", () => {
    const dir = mkdtempSync(join(tmpdir(), "sentry-"));
    const path = join(dir, "c.json");
    writeFileSync(path, JSON.stringify({ ...valid, notifiers: [{ type: "discord", webhookUrl: "${HOOK}" }] }));
    expect(loadConfig(path, { HOOK: "https://discord.example/x" }).notifiers[0]).toEqual({
      type: "discord",
      webhookUrl: "https://discord.example/x",
    });
    expect(() => loadConfig(path, {})).toThrow(/\$\{HOOK\}/);
  });
});

describe("cursors + handleOperation", () => {
  it("persists the cursor after each processed operation and resumes from it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sentry-"));
    const file = join(dir, "cursors.json");
    const store = new CursorStore(file);
    expect(store.get(ME)).toBe("now");

    const lines: string[] = [];
    const count = await handleOperation(
      {
        id: "9",
        paging_token: "12345",
        type: "payment",
        created_at: "2026-10-04T00:00:00Z",
        transaction_hash: "h",
        source_account: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        from: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        to: ME,
        amount: "1",
        asset_type: "native",
      },
      { address: ME },
      validateConfig(valid),
      store,
      undefined,
      (l) => lines.push(l),
    );

    expect(count).toBe(1);
    expect(lines[0]).toContain("received 1 XLM");
    expect(new CursorStore(file).get(ME)).toBe("12345");
  });
});
