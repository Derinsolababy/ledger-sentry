import { useEffect } from "react";
import { Link, useSection, useTitle } from "../lib/router";

const SECTIONS = [
  ["start", "Getting started"],
  ["concepts", "Concepts"],
  ["reference", "Rules & configuration"],
  ["faq", "FAQ"],
] as const;

export function Docs() {
  useTitle("Docs · ledger-sentry");
  const section = useSection();
  useEffect(() => {
    if (section) document.getElementById(section)?.scrollIntoView({ behavior: "smooth" });
  }, [section]);
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 lg:grid-cols-[210px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-1 text-sm">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.2em] text-info">On this page</p>
          {SECTIONS.map(([id, label]) => (
            <Link key={id} to={`/docs/${id}`} className="block rounded-lg px-3 py-2 text-sub hover:bg-slab hover:text-txt">
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 space-y-16">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-info">Documentation</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight text-txt">Running ledger-sentry</h1>
          <p className="mt-4 max-w-2xl text-lg text-sub">A Node service and browser dashboard that turn Stellar operations into severity-graded alerts.</p>
        </header>

        <section id="start" className="scroll-mt-24 space-y-5">
          <h2 className="text-3xl font-extrabold tracking-tight text-txt">Getting started</h2>
          <ol className="space-y-3">
            {START.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-info text-coal">{i + 1}</span>
                <p className="pt-0.5 text-txt/90">{step}</p>
              </li>
            ))}
          </ol>
          <Link to="/app" className="btn btn-pri inline-block inline-block">Open the dashboard →</Link>
        </section>

        <section id="concepts" className="scroll-mt-24 space-y-5">
          <h2 className="text-3xl font-extrabold tracking-tight text-txt">Concepts</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {CONCEPTS.map(([term, body]) => (
              <div key={term} className="card p-5">
                <h3 className="text-lg font-extrabold tracking-tight text-txt">{term}</h3>
                <p className="mt-1.5 text-sm text-sub">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="reference" className="scroll-mt-24 space-y-5">
          <h2 className="text-3xl font-extrabold tracking-tight text-txt">Rules & configuration</h2>
          <p className="text-sub">Run the service with a config file. The dashboard can export one for you:</p>
          <pre className="overflow-x-auto p-5 font-mono text-xs leading-relaxed card text-live">{`# not published to npm yet: install from source
git clone https://github.com/Derinsolababy/ledger-sentry && cd ledger-sentry
npm install && npm run build && npm link   # puts \`ledger-sentry\` on your PATH

npm install -g ledger-sentry          # or clone + npm install && npm run build
cp sentry.config.example.json sentry.config.json
export DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/…
ledger-sentry sentry.config.json`}</pre>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-sub">
                <tr>
                  <th className="p-3.5">Rule</th>
                  <th className="p-3.5">Severity</th>
                  <th className="p-3.5">What it does</th>
                </tr>
              </thead>
              <tbody>
                {REFERENCE.map(([fn, who, what]) => (
                  <tr key={fn} className="border-t border-line">
                    <td className="p-3.5 font-mono text-xs text-txt">{fn}</td>
                    <td className="p-3.5 text-sub">{who}</td>
                    <td className="p-3.5 text-sub">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 space-y-3">
          <h2 className="text-3xl font-extrabold tracking-tight text-txt">FAQ</h2>
          {FAQ.map(([q, a]) => (
            <details key={q} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-txt">
                {q}
                <span className="transition group-open:rotate-45 text-live">+</span>
              </summary>
              <p className="mt-3 text-sm text-sub">{a}</p>
            </details>
          ))}
        </section>
      </article>
    </div>
  );
}

const START: string[] = [
  "Open the dashboard. Two demo testnet accounts are already on the watchlist.",
  "Add the accounts you care about, with labels, on testnet or mainnet.",
  "Switch rules on or off and set minimum amounts for payment alerts. The feed replays the last 30 operations per account.",
  "Press “Go live” to stream new operations, then export sentry.config.json to run the same rules as a 24/7 service."
];

const CONCEPTS: [string, string][] = [
  [
    "Watched account",
    "A G… address and an optional label used in alert titles."
  ],
  [
    "Rule",
    "A condition on an operation, such as a payment above an amount or a signer change, with a fixed severity."
  ],
  [
    "Notifier",
    "Where alerts go: console, Discord, Slack, Telegram or a generic JSON webhook, each with an optional minimum severity and digest."
  ],
  [
    "Cursor",
    "The last processed operation per account, saved to disk so a restart doesn’t skip or repeat alerts."
  ]
];

const REFERENCE: [string, string, string][] = [
  [
    "payment_received",
    "info",
    "A payment arrived (optionally above minAmount, for one asset)"
  ],
  [
    "payment_sent",
    "warning",
    "A payment left the account"
  ],
  [
    "signer_change",
    "critical",
    "A signer or the master key weight changed"
  ],
  [
    "threshold_change",
    "critical",
    "Low, medium or high signing thresholds changed"
  ],
  [
    "account_merge",
    "critical",
    "The account was merged away"
  ],
  [
    "trustline_change",
    "info",
    "A trustline was added, changed or removed"
  ],
  [
    "any_operation",
    "info",
    "Every operation, for noisy debugging"
  ]
];

const FAQ: [string, string][] = [
  [
    "Does it need my secret key?",
    "No. It only reads public data from Horizon."
  ],
  [
    "Will I miss events if the service restarts?",
    "No. It saves a cursor per account and resumes from there."
  ],
  [
    "Can I watch mainnet?",
    "Yes. Switch the network in the dashboard, or set horizonUrl in the config."
  ],
  [
    "Where are dashboard settings stored?",
    "In your browser’s local storage. Nothing is sent to a server."
  ],
  [
    "How do I send alerts somewhere else?",
    "Use the webhook notifier to POST alerts as JSON anywhere, with custom headers. Telegram is built in too (botToken + chatId)."
  ],
  [
    "Is it open source?",
    "Yes, MIT licensed, with tests for the rules, notifiers, config and cursors."
  ]
];
