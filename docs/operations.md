# Kairos Punch Bot

## Setup

### Secrets

```bash
gh secret set KAIROS_EMAIL
gh secret set KAIROS_PASSWORD
```

## How it works

- **Scheduled**: Runs at 10:00 and 19:00 BRT, Monday to Friday, skipping holidays. The cron fires at the target time and the script punches as soon as setup completes.
- **Manual**: Click "Run workflow" in GitHub Actions. Punches immediately. Manual runs cancel any in-progress scheduled run and take priority.

## Manual trigger

```bash
gh workflow run punch.yml
```

## Notes

- Runtime is plain Node.js ESM with a single dependency: `playwright`.
- Local sanity checks expect Node 24+, matching the GitHub Actions runtime.
- Manual triggers cancel any in-progress scheduled run so they execute immediately. Scheduled runs do not cancel manual runs.
- Holidays are configured in `config/holidays-2026.json` and only cover 2026. Update that file before relying on scheduled mode in another year.
- Playwright browsers are cached between runs with `actions/cache@v5`. The first run after a cache miss or dependency change can be slower than later runs.
- Success is confirmed by both the `Marcacao` response HTML and the updated Kairos success message. Kairos sends email confirmations separately.
- If the job fails, this automation did not confirm success. Check the GitHub run logs and the Kairos email separately.
