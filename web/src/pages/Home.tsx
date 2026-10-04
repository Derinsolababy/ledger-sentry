import { useEffect, useState } from "react";
import { Horizon } from "@stellar/stellar-sdk";

const DEMO = "GDNWGX5WQ4P74MAFOEE2NRF2LB2NS6TTVSA54HFC7M3XSEKL2GRDOYXS";
import { Link, useTitle } from "../lib/router";

export function Home() {
  useTitle("ledger-sentry · alerts for Stellar accounts");
  const [ops, setOps] = useState<{ id: string; type: string; at: string }[] | null>(null);
  useEffect(() => {
    new Horizon.Server("https://horizon-testnet.stellar.org")
      .operations()
      .forAccount(DEMO)
      .order("desc")
      .limit(6)
      .call()
      .then((page) => setOps(page.records.map((r) => ({ id: r.id, type: r.type, at: r.created_at }))))
      .catch(() => setOps([]));
  }, []);
  const STATS: [string, string][] = [
    ["Alert rules", "7"],
    ["Channels", "4"],
    ["Restart-safe", "yes"],
  ];
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 md:grid-cols-[1.2fr_1fr] md:pt-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-info">Stellar account monitoring</p>
          <h1 className="mt-4 text-5xl leading-[1.03] md:text-6xl font-extrabold tracking-tight text-txt">Know the second your <span className="text-crit">treasury moves</span>.</h1>
          <p className="mt-6 max-w-xl text-lg text-sub">ledger-sentry watches Stellar accounts and alerts you on what matters: payments in and out, signer and threshold changes, account merges and trustline changes.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app" className="btn btn-pri inline-block">Open the dashboard →</Link>
            <Link to="/docs" className="btn btn-sec inline-block">How it works</Link>
          </div>
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
            {STATS.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] uppercase tracking-wider text-sub">{label}</dt>
                <dd className="mt-1 text-2xl font-extrabold tracking-tight text-txt">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="card p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-sub">Demo treasury · latest activity</p>
            <span className="rounded bg-live/15 px-2 py-0.5 text-[10px] font-bold text-live">TESTNET</span>
          </div>
          <ul className="mt-4 space-y-2">
            {ops === null && <li className="text-sm text-sub">Loading from Horizon…</li>}
            {ops?.length === 0 && <li className="text-sm text-sub">No operations found.</li>}
            {ops?.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 rounded-lg border-l-4 border-info bg-coal px-3 py-2.5">
                <span className="font-mono text-sm">{o.type.replace(/_/g, " ")}</span>
                <span className="font-mono text-[11px] text-sub">{new Date(o.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-sub">The dashboard runs operations like these through your alert rules and can stream new ones live.</p>
        </div>
      </section>

      <section className="border-y border-line bg-slab/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-info">How it works</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-txt">Watch, match, alert</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="card p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold bg-info text-coal">{i + 1}</span>
                <h3 className="mt-4 text-xl font-extrabold tracking-tight text-txt">{title}</h3>
                <p className="mt-2 text-sm text-sub">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-info">Use cases</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-txt">For anyone responsible for Stellar funds</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USES.map(([icon, title, body]) => (
            <div key={title} className="card p-6">
              <span className="text-3xl">{icon}</span>
              <h3 className="mt-3 text-lg font-extrabold tracking-tight text-txt">{title}</h3>
              <p className="mt-2 text-sm text-sub">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-info">Guarantees</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-txt">Built for the 3am incident</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PROMISES.map(([title, body]) => (
            <div key={title} className="rounded-2xl p-7 border border-line bg-slab text-txt">
              <h3 className="text-xl font-extrabold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-sub">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-20">
        <div className="card flex flex-col items-start justify-between gap-6 p-10 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-txt">Start watching an account.</h2>
            <p className="mt-2 text-sub">No sign-up. Paste an address and see its recent activity through your rules.</p>
          </div>
          <Link to="/app" className="btn btn-pri inline-block shrink-0">Open the dashboard →</Link>
        </div>
      </section>
    </>
  );
}

const STEPS: [string, string][] = [
  [
    "Pick accounts",
    "Add treasury, hot-wallet and partner addresses with friendly labels."
  ],
  [
    "Choose rules",
    "Payments above a minimum, signer and threshold changes, merges, trustline changes, or every operation."
  ],
  [
    "Get alerted",
    "Try the rules live in the dashboard, then export the config and run the service 24/7."
  ]
];

const USES: [string, string, string][] = [
  [
    "🏦",
    "Treasuries",
    "Instant notice of outgoing payments and key changes on team accounts."
  ],
  [
    "🔑",
    "Security teams",
    "Signer, master-key and threshold changes are graded critical."
  ],
  [
    "🧾",
    "Accounting",
    "A channel feed of incoming payments with amounts and links."
  ],
  [
    "🧪",
    "Developers",
    "Watch test accounts while you build, with a live feed in the browser."
  ]
];

const PROMISES: [string, string][] = [
  [
    "Severity-graded",
    "Critical, warning and info, so key changes don’t get lost among routine payments."
  ],
  [
    "Doesn’t miss events",
    "The service saves a cursor per account and picks up where it left off after a restart."
  ],
  [
    "Read-only",
    "It only reads public Horizon data. No keys, no signing, nothing to steal."
  ]
];
