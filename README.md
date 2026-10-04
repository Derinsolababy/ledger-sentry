# ledger-sentry

**Real-time alerts for your Stellar accounts.**

`ledger-sentry` streams every operation on the accounts you care about
(treasuries, hot wallets, issuing accounts, customer deposit addresses)
and sends an alert to Discord, Slack, a webhook or the console the moment
something matches your rules. It's built to catch the events that
matter before it's too late: a new signer, a disabled master key, an
account merge, an unexpected outgoing payment.

```text
🔴 Treasury: signer added
GDX7…Q4KA now has weight 10
https://stellar.expert/explorer/public/tx/9f3c…
```

## Quick start

```bash
npm install -g ledger-sentry          # or clone + npm install && npm run build
cp sentry.config.example.json sentry.config.json
export DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/…
ledger-sentry sentry.config.json
```

## Configuration

```json
{
  "horizonUrl": "https://horizon.stellar.org",
  "explorerTxUrl": "https://stellar.expert/explorer/public/tx/{hash}",
  "cursorFile": ".sentry-cursors.json",
  "accounts": [{ "address": "GBRP…OX2H", "label": "Treasury" }],
  "rules": [
    { "type": "payment_received", "minAmount": 100 },
    { "type": "payment_sent", "asset": "USDC" },
    { "type": "signer_change" },
    { "type": "threshold_change" },
    { "type": "account_merge" },
    { "type": "trustline_change" }
  ],
  "notifiers": [
    { "type": "console" },
    { "type": "discord", "webhookUrl": "${DISCORD_WEBHOOK_URL}" },
    { "type": "slack", "webhookUrl": "${SLACK_WEBHOOK_URL}" },
    { "type": "webhook", "url": "https://ops.example/alerts", "headers": { "authorization": "Bearer ${OPS_TOKEN}" } }
  ]
}
```

`${VAR}` references are filled in from the environment, so webhook URLs
and tokens never have to live in the file. The config is validated at
startup with clear error messages (bad addresses, unknown rules, non-https
webhooks).

### Rules

| Rule | Fires when | Severity |
| --- | --- | --- |
| `payment_received` | The account receives a payment, path payment or is funded (`minAmount`, `asset` filters) | info |
| `payment_sent` | The account sends one | warning |
| `signer_change` | A signer is added or removed, or the master key weight changes | critical |
| `threshold_change` | Signing thresholds change | critical |
| `account_merge` | The account is merged away | critical |
| `trustline_change` | A trustline is added, changed or removed | info |
| `any_operation` | Anything happens (handy for low-traffic cold wallets) | info |

## Reliability

- **No missed or duplicate alerts across restarts.** The last processed
  paging token per account is saved (atomically) to `cursorFile`, and
  streams resume from it.
- **Ordered per account.** Operations are handled strictly in sequence.
- **Retries with backoff** for 5xx and network errors. 4xx responses
  aren't retried, since retrying a misconfigured webhook won't help.
- **One broken channel doesn't silence the rest.** Each notifier fails
  independently and the error is logged.
- Streams reconnect automatically, and SIGINT/SIGTERM shut down cleanly.

## Use it as a library

```ts
import { evaluate, notify } from "ledger-sentry";

const alerts = evaluate(horizonOperationRecord, { address, label: "Hot wallet" }, rules);
for (const alert of alerts) await notify(alert, notifiers);
```

## Development

```bash
npm install
npm test        # 24 tests: rules, notifiers, config, cursors
npm run lint && npm run typecheck && npm run build
```

## Web app

![ledger-sentry web app](docs/assets/web-app.png)

A live monitoring dashboard at `web/`, running the service's own rule engine in the browser:

- **Watchlist**: add any accounts with labels (testnet or mainnet), saved in your browser.
- **Rules**: toggle each rule and set minimum amounts for payment alerts.
- **Alert feed**: replays each account's last 30 operations through the rules, then **Go live** streams new operations from Horizon as they happen. Counters for critical, warning and info.
- **Export config**: generates the matching `sentry.config.json`, so you can run the service 24/7 with Discord, Slack or webhook delivery.

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

The app imports the library straight from `../src`, so the browser and the CLI
share one implementation. `netlify.toml` at the repo root deploys it as-is.

## Documentation

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [Changelog](CHANGELOG.md)

## Glossary (new to Stellar?)

- **Horizon**: Stellar's HTTP API server. It can *stream* new operations
  as they happen using Server-Sent Events.
- **Operation**: a single action inside a transaction: a payment, a
  trustline change, an options change and so on.
- **Paging token / cursor**: Horizon's bookmark for "everything after
  this point". Saving it is what lets ledger-sentry resume exactly.
- **Signer / master key / thresholds**: who can sign for an account and
  how much signing weight each action needs. Changes here are how
  account takeovers happen, so they're always critical.
- **Account merge**: deletes an account and moves all its XLM elsewhere.
- **Trustline**: an account's opt-in to hold a non-XLM asset.

## License

MIT
