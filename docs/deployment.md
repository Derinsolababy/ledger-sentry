# Deployment

## systemd

```ini
[Service]
WorkingDirectory=/opt/ledger-sentry
Environment=DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/…
ExecStart=/usr/bin/node dist/bin.js sentry.config.json
Restart=always
```

## Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
CMD ["node", "dist/bin.js", "/config/sentry.config.json"]
```

Mount a volume for `cursorFile` so restarts resume from the right place.

## What to watch

| Account | Rules |
| --- | --- |
| Treasury / cold wallet | `any_operation`, `signer_change`, `account_merge` |
| Hot wallet | `payment_sent` (threshold), `signer_change` |
| Deposit address | `payment_received` |
| Asset issuer | `signer_change`, `threshold_change`, `any_operation` |
