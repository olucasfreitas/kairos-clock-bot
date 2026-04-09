# Kairos Punch Bot

## Setup

### Secrets

```bash
gh secret set KAIROS_EMAIL
gh secret set KAIROS_PASSWORD
```

### Enable scheduled runs

```bash
gh variable set KAIROS_AUTOMATION_ENABLED -b true
```

## How it works

- **Scheduled**: Starts at 09:59 and 18:59 BRT, waits in-process until 10:00 / 19:00, then punches. Monday to Friday only, skips holidays.
- **Manual**: Click "Run workflow" in GitHub Actions. Punches immediately. Always takes priority over scheduled runs.

## Manual trigger

```bash
gh workflow run punch.yml
```

## Notes

- Manual triggers always cancel any pending scheduled run so they execute immediately.
- Holidays are configured in `config/holidays-2026.json`.
- Success is confirmed by the Kairos success message. Kairos sends email confirmations separately.
