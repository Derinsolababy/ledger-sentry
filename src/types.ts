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

export type NotifierConfig =
  | { type: "console" }
  | { type: "webhook"; url: string; headers?: Record<string, string> }
  | { type: "discord"; webhookUrl: string }
  | { type: "slack"; webhookUrl: string };

export interface Config {
  horizonUrl: string;
  accounts: WatchedAccount[];
  rules: Rule[];
  notifiers: NotifierConfig[];
  /** Where per-account stream cursors are saved so restarts don't miss or repeat events. */
  cursorFile?: string;
  /** Link template for alerts; `{hash}` is replaced. */
  explorerTxUrl?: string;
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
