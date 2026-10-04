import type { Alert, OperationRecord, Rule, Severity, WatchedAccount } from "./types.js";

export function assetLabel(op: Pick<OperationRecord, "asset_type" | "asset_code">): string {
  return op.asset_type === "native" ? "XLM" : (op.asset_code ?? "?");
}

const PAYMENT_TYPES = new Set([
  "payment",
  "path_payment_strict_send",
  "path_payment_strict_receive",
  "create_account",
]);

function short(address?: string): string {
  if (!address) return "?";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Normalise payment-like operations into from / to / amount / asset. */
function asPayment(op: OperationRecord): { from: string; to: string; amount: number; asset: string } | null {
  if (!PAYMENT_TYPES.has(op.type)) return null;
  if (op.type === "create_account") {
    return {
      from: op.funder ?? op.source_account,
      to: op.account ?? "",
      amount: Number(op.starting_balance ?? 0),
      asset: "XLM",
    };
  }
  return {
    from: op.from ?? op.source_account,
    to: op.to ?? "",
    amount: Number(op.amount ?? 0),
    asset: assetLabel(op),
  };
}

function matchesAsset(rule: { asset?: string }, asset: string): boolean {
  return !rule.asset || rule.asset.toUpperCase() === asset.toUpperCase();
}

/**
 * Evaluate every rule against one operation seen on `account`'s stream and
 * return the alerts it triggers. Pure: no I/O, so it's trivially testable.
 */
export function evaluate(
  op: OperationRecord,
  account: WatchedAccount,
  rules: Rule[],
  explorerTxUrl?: string,
): Alert[] {
  const alerts: Alert[] = [];
  const name = account.label ?? short(account.address);
  const push = (severity: Severity, rule: Rule["type"], title: string, detail: string) =>
    alerts.push({
      severity,
      rule,
      account,
      title,
      detail,
      transactionHash: op.transaction_hash,
      operationId: op.id,
      at: op.created_at,
      link: explorerTxUrl?.replace("{hash}", op.transaction_hash),
    });

  const payment = asPayment(op);
  for (const rule of rules) {
    switch (rule.type) {
      case "payment_received":
        if (payment && payment.to === account.address && matchesAsset(rule, payment.asset) && payment.amount >= (rule.minAmount ?? 0)) {
          push("info", rule.type, `${name} received ${payment.amount} ${payment.asset}`, `From ${short(payment.from)}`);
        }
        break;
      case "payment_sent":
        if (payment && payment.from === account.address && matchesAsset(rule, payment.asset) && payment.amount >= (rule.minAmount ?? 0)) {
          push("warning", rule.type, `${name} sent ${payment.amount} ${payment.asset}`, `To ${short(payment.to)}`);
        }
        break;
      case "signer_change":
        if (op.type === "set_options" && op.source_account === account.address) {
          if (op.signer_key !== undefined) {
            const removed = op.signer_weight === 0;
            push(
              "critical",
              rule.type,
              `${name}: signer ${removed ? "removed" : "added"}`,
              `${short(op.signer_key)} ${removed ? "can no longer sign" : `now has weight ${op.signer_weight}`}`,
            );
          }
          if (op.master_key_weight !== undefined) {
            push("critical", rule.type, `${name}: master key weight set to ${op.master_key_weight}`, op.master_key_weight === 0 ? "The account's own key can no longer sign." : "Master key weight changed.");
          }
        }
        break;
      case "threshold_change":
        if (op.type === "set_options" && op.source_account === account.address && (op.low_threshold !== undefined || op.med_threshold !== undefined || op.high_threshold !== undefined)) {
          push("critical", rule.type, `${name}: signing thresholds changed`, `low ${op.low_threshold ?? "-"}, med ${op.med_threshold ?? "-"}, high ${op.high_threshold ?? "-"}`);
        }
        break;
      case "account_merge":
        if (op.type === "account_merge" && (op.account === account.address || op.source_account === account.address)) {
          push("critical", rule.type, `${name} was merged`, `All XLM moved to ${short(op.into)}; the account no longer exists.`);
        }
        break;
      case "trustline_change":
        if (op.type === "change_trust" && (op.trustor ?? op.source_account) === account.address) {
          const removed = op.limit !== undefined && Number(op.limit) === 0;
          push("info", rule.type, `${name} ${removed ? "removed" : "changed"} trustline ${assetLabel(op)}`, removed ? "Trustline removed." : `Limit ${op.limit ?? "?"}`);
        }
        break;
      case "any_operation":
        push("info", rule.type, `${name}: ${op.type.replace(/_/g, " ")}`, `Operation ${op.id}`);
        break;
    }
  }
  return alerts;
}
