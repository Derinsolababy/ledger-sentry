# Architecture

```text
Horizon SSE stream (per account, from saved cursor)
  └─ per-account promise queue (strict ordering)
       └─ handleOperation(op)
            ├─ evaluate(op, account, rules) → Alert[]          (pure)
            ├─ notify(alert, notifiers)                       (retries, isolation)
            └─ CursorStore.set(account, op.paging_token)      (atomic file write)
```

## Delivery guarantees

- **At-least-once per operation across restarts.** The cursor is saved
  *after* alerts are sent, so a crash mid-alert re-sends rather than
  skips. Receivers can de-duplicate on `operationId`.
- **Ordering** within an account is preserved by chaining handlers.
- **Isolation**: each notifier fails independently, and errors are logged,
  not thrown.

## Retry policy

Up to 3 attempts with exponential backoff (200ms, 400ms, 800ms) for network
errors, 5xx and 429. Other 4xx responses mean a misconfigured endpoint, so
retrying won't help.
