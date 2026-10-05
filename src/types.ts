export type Severity = "info" | "warning" | "critical";

/** The subset of a Horizon operation record the rules look at. */
export interface OperationRecord {
  id: string;
  paging_token: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  source_account: string;
  // payment / path payments
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  // create_account
  funder?: string;
  account?: string;
  starting_balance?: string;
  // account_merge
  into?: string;
  // set_options
  signer_key?: string;
  signer_weight?: number;
  master_key_weight?: number;
  low_threshold?: number;
  med_threshold?: number;
  high_threshold?: number;
  // change_trust
  trustor?: string;
  limit?: string;
}

export interface WatchedAccount {
  address: string;
  /** Friendly name used in alerts, e.g. "Treasury". */
  label?: string;
}

export type Rule =
  | { type: "payment_received"; minAmount?: number; asset?: string }
  | { type: "payment_sent"; minAmount?: number; asset?: string }
  | { type: "signer_change" }
  | { type: "account_merge" }
  | { type: "threshold_change" }
  | { type: "trustline_change" }
  | { type: "any_operation" };

/** Settings every notifier accepts. */
export interface NotifierOptions {
  /** Alerts below this severity aren't sent immediately (default: send everything). */
  minSeverity?: Severity;
  /** If set (with minSeverity), lower-severity alerts are batched into one digest every N minutes. */
  digestMinutes?: number;
}

export type NotifierConfig = NotifierOptions &
  (
    | { type: "console" }
    | { type: "webhook"; url: string; headers?: Record<string, string> }
    | { type: "discord"; webhookUrl: string }
    | { type: "slack"; webhookUrl: string }
    | { type: "telegram"; botToken: string; chatId: string }
  );

export interface Config {
  horizonUrl: string;
  accounts: WatchedAccount[];
  rules: Rule[];
  notifiers: NotifierConfig[];
  /** Where per-account stream cursors are saved so restarts don't miss or repeat events. */
  cursorFile?: string;
  /** Link template for alerts; `{hash}` is replaced. */
  explorerTxUrl?: string;
  /** How often (minutes) to check each stream against Horizon for silent stalls. Default 5; 0 disables. */
  stallCheckMinutes?: number;
  /** Serve GET /health on this port (JSON with per-account stream status). */
  healthPort?: number;
}

export interface Alert {
  severity: Severity;
  rule: Rule["type"];
  account: WatchedAccount;
  title: string;
  detail: string;
  transactionHash: string;
  operationId: string;
  at: string;
  link?: string;
}
