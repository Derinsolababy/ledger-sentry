import { describe, expect, it, vi } from "vitest";
import { discordPayload, notify, type Fetch } from "./notify.js";
import type { Alert } from "./types.js";

const alert: Alert = {
  severity: "critical",
  rule: "signer_change",
  account: { address: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H", label: "Treasury" },
  title: "Treasury: signer added",
  detail: "GA5Z…KZVN now has weight 10",
  transactionHash: "abc",
  operationId: "1",
  at: "2026-10-04T12:00:00Z",
  link: "https://stellar.expert/explorer/testnet/tx/abc",
};

describe("notify", () => {
  it("posts Discord embeds, Slack text and raw webhooks", async () => {
    const fetchMock = vi.fn<Fetch>().mockResolvedValue({ ok: true, status: 204 });
    const errors = await notify(
      alert,
      [
        { type: "discord", webhookUrl: "https://discord.example/hook" },
        { type: "slack", webhookUrl: "https://slack.example/hook" },
        { type: "webhook", url: "https://ops.example/alerts", headers: { authorization: "Bearer t" } },
      ],
      fetchMock,
    );
    expect(errors).toEqual([]);
    const bodies = Object.fromEntries(fetchMock.mock.calls.map(([url, init]) => [url, JSON.parse(init.body)]));
    expect(bodies["https://discord.example/hook"].embeds[0]).toMatchObject({ title: alert.title, color: 0xdc2626 });
    expect(bodies["https://slack.example/hook"].text).toContain("🔴 Treasury: signer added");
    expect(bodies["https://ops.example/alerts"]).toMatchObject({ rule: "signer_change" });
    const webhookCall = fetchMock.mock.calls.find(([url]) => url === "https://ops.example/alerts")!;
    expect(webhookCall[1].headers.authorization).toBe("Bearer t");
  });

  it("retries transient failures, then succeeds", async () => {
    const fetchMock = vi
      .fn<Fetch>()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const errors = await notify(alert, [{ type: "webhook", url: "https://ops.example/a" }], fetchMock);
    expect(errors).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx and reports it without failing other channels", async () => {
    const fetchMock = vi.fn<Fetch>(async (url) => (url.includes("bad") ? { ok: false, status: 404 } : { ok: true, status: 200 }));
    const lines: string[] = [];
    const errors = await notify(
      alert,
      [{ type: "webhook", url: "https://bad.example/a" }, { type: "console" }],
      fetchMock,
      (l) => lines.push(l),
    );
    expect(errors).toEqual(["notification to bad.example failed (status 404)"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lines[0]).toContain("Treasury: signer added");
  });

  it("builds a Discord embed with link and timestamp", () => {
    expect(discordPayload(alert).embeds[0]).toMatchObject({ url: alert.link, timestamp: alert.at });
  });
});
