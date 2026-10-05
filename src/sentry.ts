import { createServer, type Server } from "node:http";
import { Horizon } from "@stellar/stellar-sdk";
import { CursorStore } from "./cursors.js";
import { Digest, notify, type Fetch } from "./notify.js";
import { evaluate } from "./rules.js";
import type { Config, OperationRecord, WatchedAccount } from "./types.js";

/** Operation ids already alerted on, so a transfer between two watched accounts alerts once. */
export class SeenOperations {
  private ids = new Set<string>();
  constructor(private readonly capacity = 5_000) {}

  /** Records the id; returns false if it was already seen. */
  add(id: string): boolean {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    if (this.ids.size > this.capacity) this.ids.delete(this.ids.values().next().value as string);
    return true;
  }
}

export interface HandleContext {
  seen?: SeenOperations;
  digest?: Digest;
}

/** Process one operation: evaluate rules, send alerts, advance the cursor. */
export async function handleOperation(
  op: OperationRecord,
  account: WatchedAccount,
  config: Config,
  cursors: CursorStore,
  fetchImpl?: Fetch,
  log: (line: string) => void = console.log,
  ctx: HandleContext = {},
): Promise<number> {
  let alerts = evaluate(op, account, config.rules, config.explorerTxUrl);
  // The same operation arrives once per watched account it touches; alert only the first time.
  if (alerts.length && ctx.seen && !ctx.seen.add(op.id)) alerts = [];
  for (const alert of alerts) {
    const errors = await notify(alert, config.notifiers, fetchImpl, log, ctx.digest);
    for (const e of errors) log(`[ledger-sentry] ${e}`);
  }
  cursors.set(account.address, op.paging_token);
  return alerts.length;
}

/**
 * A stream has silently stalled if Horizon already has a newer operation than
 * our cursor and nothing has been delivered for a while. (Quiet accounts are
 * fine: their latest operation is the one we already processed.)
 */
export function isStalled(latestToken: string | undefined, cursor: string, lastDeliveryMs: number, nowMs: number, graceMs = 60_000): boolean {
  if (!latestToken || cursor === "now") return false;
  return BigInt(latestToken) > BigInt(cursor) && nowMs - lastDeliveryMs > graceMs;
}

export interface StreamStatus {
  address: string;
  label?: string;
  cursor: string;
  lastEventAt: string | null;
  restarts: number;
  stalled: boolean;
}

/** Stream operations for every watched account until stopped. Returns a stop function. */
export function start(config: Config, log: (line: string) => void = console.log): () => void {
  const server = new Horizon.Server(config.horizonUrl);
  const cursors = new CursorStore(config.cursorFile);
  const ctx: HandleContext = { seen: new SeenOperations(), digest: new Digest() };
  // Process each account's operations strictly in order.
  const queues = new Map<string, Promise<unknown>>();
  const status = new Map<string, StreamStatus>();
  const closers = new Map<string, () => void>();
  const lastDelivery = new Map<string, number>();

  const open = (account: WatchedAccount) => {
    log(`[ledger-sentry] watching ${account.label ?? account.address} from cursor ${cursors.get(account.address)}`);
    lastDelivery.set(account.address, Date.now());
    const close = server
      .operations()
      .forAccount(account.address)
      .cursor(cursors.get(account.address))
      .stream({
        onmessage: (record) => {
          lastDelivery.set(account.address, Date.now());
          const st = status.get(account.address)!;
          st.lastEventAt = new Date().toISOString();
          st.stalled = false;
          const previous = queues.get(account.address) ?? Promise.resolve();
          const next = previous
            .then(() => handleOperation(record as unknown as OperationRecord, account, config, cursors, undefined, log, ctx))
            .then(() => (st.cursor = cursors.get(account.address)));
          queues.set(account.address, next.catch((err) => log(`[ledger-sentry] ${String(err)}`)));
        },
        onerror: () => {
          // EventSource reconnects on its own; stall detection covers silent failures.
          log(`[ledger-sentry] stream for ${account.label ?? account.address} interrupted, reconnecting…`);
        },
      });
    closers.set(account.address, close);
  };

  for (const account of config.accounts) {
    status.set(account.address, {
      address: account.address,
      label: account.label,
      cursor: cursors.get(account.address),
      lastEventAt: null,
      restarts: 0,
      stalled: false,
    });
    open(account);
  }

  const timers: ReturnType<typeof setInterval>[] = [];
  const stallMinutes = config.stallCheckMinutes ?? 5;
  if (stallMinutes > 0) {
    timers.push(
      setInterval(() => {
        for (const account of config.accounts) {
          server
            .operations()
            .forAccount(account.address)
            .order("desc")
            .limit(1)
            .call()
            .then((page) => {
              const latest = page.records[0]?.paging_token;
              const cursor = cursors.get(account.address);
              if (!isStalled(latest, cursor, lastDelivery.get(account.address) ?? 0, Date.now())) return;
              const st = status.get(account.address)!;
              st.stalled = true;
              st.restarts++;
              log(`[ledger-sentry] stream for ${account.label ?? account.address} stalled; restarting from ${cursor}`);
              closers.get(account.address)?.();
              open(account);
            })
            .catch(() => {
              /* Horizon unreachable: the next check will try again */
            });
        }
      }, stallMinutes * 60_000),
    );
  }

  for (const n of config.notifiers) {
    if (!n.digestMinutes) continue;
    timers.push(
      setInterval(() => {
        ctx.digest!.flush(n, undefined, log).then((errs) => errs.forEach((e) => log(`[ledger-sentry] ${e}`)));
      }, n.digestMinutes * 60_000),
    );
  }

  let health: Server | undefined;
  if (config.healthPort) {
    health = createServer((req, res) => {
      if (req.url !== "/health") {
        res.writeHead(404).end();
        return;
      }
      const accounts = [...status.values()];
      const ok = accounts.every((a) => !a.stalled);
      res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok, accounts }, null, 2));
    }).listen(config.healthPort, () => log(`[ledger-sentry] health on http://localhost:${config.healthPort}/health`));
  }

  return () => {
    timers.forEach(clearInterval);
    closers.forEach((close) => close());
    health?.close();
    for (const n of config.notifiers) if (n.digestMinutes) void ctx.digest!.flush(n, undefined, log);
  };
}
