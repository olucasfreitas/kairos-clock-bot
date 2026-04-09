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

- **Scheduled**: Runs at 10:00 and 19:00 BRT, Monday to Friday. Skips weekends and configured holidays.
- **Manual**: Click "Run workflow" in GitHub Actions. Punches immediately. Always takes priority over scheduled runs.

## Manual trigger

```bash
gh workflow run punch.yml
```

## Notes

- Manual triggers always cancel any pending scheduled run so they execute immediately.
- Holidays are configured in `config/holidays-2026.json`.
- Success is confirmed by the Kairos success message. Kairos sends email confirmations separately.
