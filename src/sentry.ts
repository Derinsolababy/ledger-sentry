import { Horizon } from "@stellar/stellar-sdk";
import { CursorStore } from "./cursors.js";
import { notify, type Fetch } from "./notify.js";
import { evaluate } from "./rules.js";
import type { Config, OperationRecord, WatchedAccount } from "./types.js";

/** Process one operation: evaluate rules, send alerts, advance the cursor. */
export async function handleOperation(
  op: OperationRecord,
  account: WatchedAccount,
  config: Config,
  cursors: CursorStore,
  fetchImpl?: Fetch,
  log: (line: string) => void = console.log,
): Promise<number> {
  const alerts = evaluate(op, account, config.rules, config.explorerTxUrl);
  for (const alert of alerts) {
    const errors = await notify(alert, config.notifiers, fetchImpl, log);
    for (const e of errors) log(`[ledger-sentry] ${e}`);
  }
  cursors.set(account.address, op.paging_token);
  return alerts.length;
}

/** Stream operations for every watched account until stopped. Returns a stop function. */
export function start(config: Config, log: (line: string) => void = console.log): () => void {
  const server = new Horizon.Server(config.horizonUrl);
  const cursors = new CursorStore(config.cursorFile);
  // Process each account's operations strictly in order.
  const queues = new Map<string, Promise<unknown>>();

  const closers = config.accounts.map((account) => {
    log(`[ledger-sentry] watching ${account.label ?? account.address} from cursor ${cursors.get(account.address)}`);
    return server
      .operations()
      .forAccount(account.address)
      .cursor(cursors.get(account.address))
      .stream({
        onmessage: (record) => {
          const previous = queues.get(account.address) ?? Promise.resolve();
          const next = previous.then(() =>
            handleOperation(record as unknown as OperationRecord, account, config, cursors, undefined, log),
          );
          queues.set(account.address, next.catch((err) => log(`[ledger-sentry] ${String(err)}`)));
        },
        onerror: () => {
          // EventSource reconnects on its own; just note it.
          log(`[ledger-sentry] stream for ${account.label ?? account.address} interrupted, reconnecting…`);
        },
      });
  });

  return () => closers.forEach((close) => close());
}
