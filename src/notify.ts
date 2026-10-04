import type { Alert, NotifierConfig, Severity } from "./types.js";

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

const EMOJI: Record<Severity, string> = { info: "🔵", warning: "🟠", critical: "🔴" };
const DISCORD_COLOR: Record<Severity, number> = { info: 0x3b82f6, warning: 0xf59e0b, critical: 0xdc2626 };

export function formatText(alert: Alert): string {
  return `${EMOJI[alert.severity]} ${alert.title}\n${alert.detail}${alert.link ? `\n${alert.link}` : ""}`;
}

export function discordPayload(alert: Alert) {
  return {
    embeds: [
      {
        title: alert.title,
        description: alert.detail,
        color: DISCORD_COLOR[alert.severity],
        url: alert.link,
        timestamp: alert.at,
        footer: { text: `${alert.rule} · ${alert.account.address}` },
      },
    ],
  };
}

export function slackPayload(alert: Alert) {
  return { text: formatText(alert) };
}

async function post(fetchImpl: Fetch, url: string, body: unknown, headers: Record<string, string> = {}, attempts = 3): Promise<void> {
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
      lastStatus = res.status;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break; // don't retry rejections
    } catch {
      lastStatus = 0;
    }
    await new Promise((r) => setTimeout(r, 200 * 2 ** i));
  }
  throw new Error(`notification to ${new URL(url).host} failed (status ${lastStatus || "network error"})`);
}

/** Send one alert to every configured notifier. Failures are collected, not thrown, so one broken channel doesn't silence the others. */
export async function notify(
  alert: Alert,
  notifiers: NotifierConfig[],
  fetchImpl: Fetch = fetch as unknown as Fetch,
  log: (line: string) => void = console.log,
): Promise<string[]> {
  const errors: string[] = [];
  await Promise.all(
    notifiers.map(async (n) => {
      try {
        switch (n.type) {
          case "console":
            log(formatText(alert));
            break;
          case "webhook":
            await post(fetchImpl, n.url, alert, n.headers);
            break;
          case "discord":
            await post(fetchImpl, n.webhookUrl, discordPayload(alert));
            break;
          case "slack":
            await post(fetchImpl, n.webhookUrl, slackPayload(alert));
            break;
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }),
  );
  return errors;
}
