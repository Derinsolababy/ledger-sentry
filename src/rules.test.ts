import { describe, expect, it } from "vitest";
import { evaluate } from "./rules.js";
import type { OperationRecord, Rule } from "./types.js";

const ME = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const THEM = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const account = { address: ME, label: "Treasury" };

function op(extra: Partial<OperationRecord>): OperationRecord {
  return {
    id: "1",
    paging_token: "1",
    type: "payment",
    created_at: "2026-10-04T12:00:00Z",
    transaction_hash: "abc123",
    source_account: THEM,
    ...extra,
  };
}

const payIn = op({ from: THEM, to: ME, amount: "250.0000000", asset_type: "native" });
const payOut = op({ source_account: ME, from: ME, to: THEM, amount: "10.0000000", asset_type: "credit_alphanum4", asset_code: "USDC" });

describe("payment rules", () => {
  it("alerts on incoming payments above the minimum", () => {
    const [alert] = evaluate(payIn, account, [{ type: "payment_received", minAmount: 100 }]);
    expect(alert).toMatchObject({ severity: "info", title: "Treasury received 250 XLM", detail: "From GA5Z…KZVN" });
  });

  it("ignores incoming payments below the minimum or in another asset", () => {
    expect(evaluate(payIn, account, [{ type: "payment_received", minAmount: 1000 }])).toEqual([]);
    expect(evaluate(payIn, account, [{ type: "payment_received", asset: "USDC" }])).toEqual([]);
  });

  it("alerts on outgoing payments, filtered by asset", () => {
    expect(evaluate(payOut, account, [{ type: "payment_sent", asset: "usdc" }])[0]).toMatchObject({
      severity: "warning",
      title: "Treasury sent 10 USDC",
    });
    expect(evaluate(payOut, account, [{ type: "payment_received" }])).toEqual([]);
  });

  it("treats create_account and path payments as payments", () => {
    const funded = op({ type: "create_account", funder: THEM, account: ME, starting_balance: "5.0000000" });
    expect(evaluate(funded, account, [{ type: "payment_received" }])[0].title).toBe("Treasury received 5 XLM");
    const path = op({ type: "path_payment_strict_send", from: THEM, to: ME, amount: "3", asset_type: "native" });
    expect(evaluate(path, account, [{ type: "payment_received" }])).toHaveLength(1);
  });
});

describe("security rules", () => {
  it("flags added and removed signers as critical", () => {
    const added = op({ type: "set_options", source_account: ME, signer_key: THEM, signer_weight: 10 });
    const removed = op({ type: "set_options", source_account: ME, signer_key: THEM, signer_weight: 0 });
    expect(evaluate(added, account, [{ type: "signer_change" }])[0]).toMatchObject({
      severity: "critical",
      title: "Treasury: signer added",
    });
    expect(evaluate(removed, account, [{ type: "signer_change" }])[0].title).toBe("Treasury: signer removed");
  });

  it("flags a disabled master key", () => {
    const disabled = op({ type: "set_options", source_account: ME, master_key_weight: 0 });
    expect(evaluate(disabled, account, [{ type: "signer_change" }])[0].detail).toMatch(/can no longer sign/);
  });

  it("flags threshold changes and merges", () => {
    const thresholds = op({ type: "set_options", source_account: ME, high_threshold: 5 });
    expect(evaluate(thresholds, account, [{ type: "threshold_change" }])[0].severity).toBe("critical");
    const merged = op({ type: "account_merge", source_account: ME, account: ME, into: THEM });
    expect(evaluate(merged, account, [{ type: "account_merge" }])[0].title).toBe("Treasury was merged");
  });

  it("ignores set_options from other accounts", () => {
    const foreign = op({ type: "set_options", source_account: THEM, signer_key: ME, signer_weight: 1 });
    expect(evaluate(foreign, account, [{ type: "signer_change" }])).toEqual([]);
  });

  it("reports trustline removal", () => {
    const removed = op({ type: "change_trust", trustor: ME, asset_type: "credit_alphanum4", asset_code: "USDC", limit: "0.0000000" });
    expect(evaluate(removed, account, [{ type: "trustline_change" }])[0].title).toBe("Treasury removed trustline USDC");
  });
});

describe("evaluate", () => {
  it("runs every matching rule and fills in links", () => {
    const rules: Rule[] = [{ type: "payment_received" }, { type: "any_operation" }];
    const alerts = evaluate(payIn, account, rules, "https://stellar.expert/explorer/testnet/tx/{hash}");
    expect(alerts.map((a) => a.rule)).toEqual(["payment_received", "any_operation"]);
    expect(alerts[0].link).toBe("https://stellar.expert/explorer/testnet/tx/abc123");
  });

  it("falls back to a shortened address without a label", () => {
    const [alert] = evaluate(payIn, { address: ME }, [{ type: "payment_received" }]);
    expect(alert.title).toBe("GBRP…OX2H received 250 XLM");
  });
});
