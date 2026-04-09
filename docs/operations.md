# Kairos Punch Bot

## Setup

### Secrets

```bash
gh secret set KAIROS_EMAIL
gh secret set KAIROS_PASSWORD
```

## How it works

- **Scheduled**: Starts at 09:58 and 18:58 BRT, finishes setup, then waits until 10:00 / 19:00 before punching. Monday to Friday only, skips holidays.
- **Manual**: Click "Run workflow" in GitHub Actions. Punches immediately. Manual runs cancel any in-progress scheduled run and take priority over it.

## Manual trigger

```bash
gh workflow run punch.yml
```

## Notes

- Manual triggers cancel any in-progress scheduled run so they execute immediately. Scheduled runs do not cancel manual runs.
- Holidays are configured in `config/holidays-2026.json` and only cover 2026. Update that file before relying on scheduled mode in another year.
- Scheduled runs skip themselves if setup finishes more than 60 seconds after the target time.
- Success is confirmed by both the `Marcacao` response HTML and the updated Kairos success message. Kairos sends email confirmations separately.
- If the job fails, this automation did not confirm success. Check the GitHub run logs and the Kairos email separately.
