import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Horizon, StrKey } from "@stellar/stellar-sdk";
import { evaluate } from "../../src/rules";
import type { Alert, OperationRecord, Rule, WatchedAccount } from "../../src/types";

const NETWORKS = {
  testnet: { label: "Testnet", horizon: "https://horizon-testnet.stellar.org", explorer: "https://stellar.expert/explorer/testnet/tx/{hash}" },
  public: { label: "Mainnet", horizon: "https://horizon.stellar.org", explorer: "https://stellar.expert/explorer/public/tx/{hash}" },
} as const;
type Net = keyof typeof NETWORKS;

const RULE_INFO: { type: Rule["type"]; label: string; hasMin?: boolean }[] = [
  { type: "payment_received", label: "Payment received", hasMin: true },
  { type: "payment_sent", label: "Payment sent", hasMin: true },
  { type: "signer_change", label: "Signer / master key change" },
  { type: "threshold_change", label: "Threshold change" },
  { type: "account_merge", label: "Account merged" },
  { type: "trustline_change", label: "Trustline change" },
  { type: "any_operation", label: "Any operation" },
];

const DEFAULT_ACCOUNTS: WatchedAccount[] = [
  { address: "GDNWGX5WQ4P74MAFOEE2NRF2LB2NS6TTVSA54HFC7M3XSEKL2GRDOYXS", label: "Demo treasury" },
  { address: "GCO5NHZOL7XEIODHW4ADOYNYDERESC6RUWPD4WISORESK6QNDLZQRVZK", label: "Alice" },
];

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

const STYLE: Record<Alert["severity"], string> = {
  critical: "border-l-crit bg-crit/8",
  warning: "border-l-warn bg-warn/8",
  info: "border-l-info bg-info/6",
};

export function Workspace() {
  const [net, setNet] = useState<Net>(() => load("sentry.net", "testnet"));
  const [accounts, setAccounts] = useState<WatchedAccount[]>(() => load("sentry.accounts", DEFAULT_ACCOUNTS));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    load("sentry.rules", Object.fromEntries(RULE_INFO.map((r) => [r.type, r.type !== "any_operation"]))),
  );
  const [mins, setMins] = useState<Record<string, string>>(() => load("sentry.mins", { payment_received: "1", payment_sent: "" }));
  const [assets, setAssets] = useState<Record<string, string>>(() => load("sentry.assets", {}));
  const [alerts, setAlerts] = useState<(Alert & { live?: boolean })[]>([]);
  const [live, setLive] = useState(false);
  const [newAddr, setNewAddr] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const closers = useRef<(() => void)[]>([]);

  useEffect(() => {
    localStorage.setItem("sentry.net", JSON.stringify(net));
    localStorage.setItem("sentry.accounts", JSON.stringify(accounts));
    localStorage.setItem("sentry.rules", JSON.stringify(enabled));
    localStorage.setItem("sentry.mins", JSON.stringify(mins));
    localStorage.setItem("sentry.assets", JSON.stringify(assets));
  }, [net, accounts, enabled, mins, assets]);

  const rules: Rule[] = useMemo(
    () =>
      RULE_INFO.filter((r) => enabled[r.type]).map((r) => {
        const min = Number(mins[r.type]);
        const asset = (assets[r.type] ?? "").trim().toUpperCase();
        if (!r.hasMin) return { type: r.type } as Rule;
        return { type: r.type, ...(min > 0 ? { minAmount: min } : {}), ...(asset ? { asset } : {}) } as Rule;
      }),
    [enabled, mins, assets],
  );

  const server = useMemo(() => new Horizon.Server(NETWORKS[net].horizon), [net]);

  const replay = useCallback(async () => {
    const all: Alert[] = [];
    await Promise.all(
      accounts.map(async (a) => {
        try {
          const page = await server.operations().forAccount(a.address).order("desc").limit(30).call();
          for (const op of page.records) all.push(...evaluate(op as unknown as OperationRecord, a, rules, NETWORKS[net].explorer));
        } catch {
          /* unfunded or unknown account */
        }
      }),
    );
    all.sort((x, y) => y.at.localeCompare(x.at));
    setAlerts(all);
  }, [accounts, rules, server, net]);

  useEffect(() => {
    replay();
  }, [replay]);

  const stop = () => {
    closers.current.forEach((c) => c());
    closers.current = [];
    setLive(false);
  };
  const start = () => {
    stop();
    closers.current = accounts.map((a) =>
      server
        .operations()
        .forAccount(a.address)
        .cursor("now")
        .stream({
          onmessage: (op) => {
            const fresh = evaluate(op as unknown as OperationRecord, a, rules, NETWORKS[net].explorer).map((x) => ({ ...x, live: true }));
            if (fresh.length) setAlerts((prev) => [...fresh, ...prev].slice(0, 300));
          },
        }),
    );
    setLive(true);
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (live) start();
    // restart streams when the watch configuration changes
  }, [accounts, rules, net]);

  const config = {
    horizonUrl: NETWORKS[net].horizon,
    explorerTxUrl: NETWORKS[net].explorer,
    cursorFile: ".sentry-cursors.json",
    accounts,
    rules,
    notifiers: [{ type: "console" }, { type: "discord", webhookUrl: "${DISCORD_WEBHOOK_URL}" }],
  };

  const counts = { critical: 0, warning: 0, info: 0 };
  alerts.forEach((a) => counts[a.severity]++);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <select className="ctl w-auto" value={net} onChange={(e) => setNet(e.target.value as Net)}>
              {Object.entries(NETWORKS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <button className={`btn ${live ? "bg-live/15 text-live" : "btn-pri"}`} onClick={live ? stop : start}>
              {live ? "● Live: stop" : "Go live"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <section className="card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-sub">Watching</h2>
            <div className="mt-3 space-y-2">
              {accounts.map((a) => (
                <div key={a.address} className="flex items-center justify-between rounded-lg bg-coal px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold">{a.label ?? "Account"}</p>
                    <p className="font-mono text-[11px] text-sub">{a.address.slice(0, 6)}…{a.address.slice(-6)}</p>
                  </div>
                  <button className="text-sub hover:text-crit" onClick={() => setAccounts(accounts.filter((x) => x.address !== a.address))} aria-label="Remove">
                    ×
                  </button>
                </div>
              ))}
            </div>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!StrKey.isValidEd25519PublicKey(newAddr) || accounts.some((a) => a.address === newAddr)) return;
                setAccounts([...accounts, { address: newAddr, label: newLabel || undefined }]);
                setNewAddr("");
                setNewLabel("");
              }}
            >
              <input className="ctl font-mono text-xs" placeholder="G… address" value={newAddr} onChange={(e) => setNewAddr(e.target.value.trim())} />
              <div className="flex gap-2">
                <input className="ctl" placeholder="Label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                <button className="btn btn-sec shrink-0" disabled={!StrKey.isValidEd25519PublicKey(newAddr)}>
                  Add
                </button>
              </div>
            </form>
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-sub">Rules</h2>
            <div className="mt-3 space-y-2.5">
              {RULE_INFO.map((r) => (
                <div key={r.type} className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!enabled[r.type]} onChange={(e) => setEnabled({ ...enabled, [r.type]: e.target.checked })} />
                    {r.label}
                  </label>
                  {r.hasMin && enabled[r.type] && (
                    <div className="flex gap-1.5">
                      <input className="ctl w-20 py-1 text-xs" placeholder="min" aria-label={`${r.label} minimum`} value={mins[r.type] ?? ""} onChange={(e) => setMins({ ...mins, [r.type]: e.target.value })} />
                      <input
                        className="ctl w-20 py-1 text-xs uppercase"
                        placeholder="any asset"
                        aria-label={`${r.label} asset code`}
                        title="Asset code, e.g. XLM or USDC. Blank = any asset."
                        value={assets[r.type] ?? ""}
                        onChange={(e) => setAssets({ ...assets, [r.type]: e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 12) })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="btn btn-sec mt-4 w-full" onClick={() => setShowConfig((v) => !v)}>
              {showConfig ? "Hide" : "Export"} sentry.config.json
            </button>
            {showConfig && (
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-coal p-3 font-mono text-[11px] text-sub">{JSON.stringify(config, null, 2)}</pre>
            )}
          </section>
        </aside>

        <section>
          <div className="grid grid-cols-3 gap-3">
            {(["critical", "warning", "info"] as const).map((s) => (
              <div key={s} className="card p-4">
                <p className="text-xs uppercase tracking-wider text-sub">{s}</p>
                <p className={`mt-1 text-3xl font-extrabold ${s === "critical" ? "text-crit" : s === "warning" ? "text-warn" : "text-info"}`}>{counts[s]}</p>
              </div>
            ))}
          </div>
          <div className="card mt-5">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-bold">Alert feed</h2>
              <span className="text-xs text-sub">{live ? "streaming new operations from Horizon…" : "showing the last 30 operations per account"}</span>
            </div>
            {alerts.length === 0 ? (
              <p className="p-6 text-sm text-sub">No alerts for the current rules.</p>
            ) : (
              <ul className="divide-y divide-line">
                {alerts.map((a, i) => (
                  <li key={`${a.operationId}-${a.rule}-${i}`} className={`border-l-4 px-4 py-3 ${STYLE[a.severity]}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">
                        {a.live && <span className="mr-2 rounded bg-live/20 px-1.5 py-0.5 text-[10px] font-bold text-live">LIVE</span>}
                        {a.title}
                      </p>
                      <span className="shrink-0 font-mono text-[11px] text-sub">{new Date(a.at).toLocaleString()}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-sub">
                      {a.detail} ·{" "}
                      <a className="underline" href={a.link} target="_blank" rel="noreferrer">
                        tx
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-4 text-xs text-sub">
            This page runs the same rule engine as the ledger-sentry service. Export the config and run the service to get
            these alerts in Discord, Slack or a webhook 24/7.{" "}
            <a className="underline" href="https://github.com/Derinsolababy/ledger-sentry" target="_blank" rel="noreferrer">
              Source
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
