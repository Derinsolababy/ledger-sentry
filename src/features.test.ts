import { describe, expect, it, vi } from "vitest";
import { validateConfig } from "./config.js";
import { CursorStore } from "./cursors.js";
import { Digest, notify, type Fetch } from "./notify.js";
import { handleOperation, isStalled, SeenOperations } from "./sentry.js";
import type { Alert, Config, OperationRecord } from "./types.js";

const A = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const B = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

const alert = (severity: Alert["severity"], title = "t"): Alert => ({
  severity,
  rule: "payment_received",
  account: { address: A, label: "Treasury" },
  title,
  detail: "d",
  transactionHash: "h",
  operationId: "1",
  at: "2026-10-05T00:00:00Z",
});

const ok = () => vi.fn<Fetch>().mockResolvedValue({ ok: true, status: 200 });

describe("telegram notifier", () => {
  it("posts to the bot API with the chat id", async () => {
    const f = ok();
    await notify(alert("critical", "Treasury: signer added"), [{ type: "telegram", botToken: "123:abc", chatId: "-100" }], f);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    expect(JSON.parse(init.body)).toMatchObject({ chat_id: "-100", text: expect.stringContaining("signer added") });
  });
});

describe("minSeverity and digests", () => {
  it("only sends alerts at or above minSeverity right away", async () => {
    const f = ok();
    const hook = { type: "webhook" as const, url: "https://ops.example/a", minSeverity: "warning" as const };
    await notify(alert("info"), [hook], f);
    await notify(alert("critical"), [hook], f);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("batches lower-severity alerts into one digest", async () => {
    const f = ok();
    const digest = new Digest();
    const slack = { type: "slack" as const, webhookUrl: "https://slack.example/h", minSeverity: "critical" as const, digestMinutes: 60 };
    await notify(alert("info", "got 5 XLM"), [slack], f, () => {}, digest);
    await notify(alert("warning", "sent 9 XLM"), [slack], f, () => {}, digest);
    expect(f).not.toHaveBeenCalled();
    expect(digest.size(slack)).toBe(2);
    await digest.flush(slack, f);
    expect(f).toHaveBeenCalledTimes(1);
    const text = JSON.parse(f.mock.calls[0][1].body).text as string;
    expect(text).toContain("Digest: 2 alerts");
    expect(text).toContain("got 5 XLM");
    expect(text).toContain("sent 9 XLM");
    expect(digest.size(slack)).toBe(0);
  });

  it("validates the new notifier options", () => {
    const base = { horizonUrl: "https://h.example", accounts: [{ address: A }], rules: [{ type: "any_operation" }] };
    expect(() => validateConfig({ ...base, notifiers: [{ type: "telegram", botToken: "", chatId: "1" }] })).toThrow(/botToken/);
    expect(() => validateConfig({ ...base, notifiers: [{ type: "console", minSeverity: "loud" }] })).toThrow(/minSeverity/);
    expect(() => validateConfig({ ...base, notifiers: [{ type: "console", digestMinutes: 10 }] })).toThrow(/needs minSeverity/);
    expect(() => validateConfig({ ...base, notifiers: [{ type: "console" }], healthPort: 70_000 })).toThrow(/healthPort/);
    expect(validateConfig({ ...base, notifiers: [{ type: "console", minSeverity: "warning", digestMinutes: 30 }] })).toBeTruthy();
  });
});

describe("dedupe across watched accounts", () => {
  it("alerts once for a payment between two watched accounts", async () => {
    const config = validateConfig({
      horizonUrl: "https://h.example",
      accounts: [{ address: A }, { address: B }],
      rules: [{ type: "payment_received" }, { type: "payment_sent" }],
      notifiers: [{ type: "console" }],
    }) as Config;
    const op: OperationRecord = {
      id: "77",
      paging_token: "77",
      type: "payment",
      created_at: "2026-10-05T00:00:00Z",
      transaction_hash: "h",
      source_account: A,
      from: A,
      to: B,
      amount: "5",
      asset_type: "native",
    };
    const seen = new SeenOperations();
    const lines: string[] = [];
    const cursors = new CursorStore();
    const first = await handleOperation(op, { address: A }, config, cursors, undefined, (l) => lines.push(l), { seen });
    const second = await handleOperation(op, { address: B }, config, cursors, undefined, (l) => lines.push(l), { seen });
    expect([first, second]).toEqual([1, 0]);
    expect(lines).toHaveLength(1);
    expect(cursors.get(B)).toBe("77"); // the cursor still advances
  });
});

describe("isStalled", () => {
  const now = 1_000_000;
  it("is false for quiet accounts and fresh streams", () => {
    expect(isStalled("100", "100", 0, now)).toBe(false);
    expect(isStalled("101", "100", now - 1_000, now)).toBe(false);
    expect(isStalled("101", "now", 0, now)).toBe(false);
    expect(isStalled(undefined, "100", 0, now)).toBe(false);
  });
  it("is true when Horizon is ahead and nothing arrived for a while", () => {
    expect(isStalled("101", "100", now - 120_000, now)).toBe(true);
  });
});
