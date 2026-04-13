# Kairos Punch Bot

## Setup

### Secrets

```bash
gh secret set KAIROS_EMAIL
gh secret set KAIROS_PASSWORD
```

### External Scheduler

This bot no longer relies on GitHub's built-in `schedule` trigger.
`cron-job.org` dispatches the workflow, and the repo owns that setup through:

```bash
npm run sync-cron-jobs
```

That command reads:

- `CRON_JOB_API_KEY` to create/update cron-job.org jobs
- `GITHUB_TOKEN` to authorize the GitHub `workflow_dispatch` API calls stored in those jobs

`GITHUB_TOKEN` here means a personal GitHub token you provide in the local shell, not the ephemeral token GitHub Actions injects during a workflow run. It must be allowed to dispatch workflows for this repository.

## How it works

- **Scheduled**: `cron-job.org` dispatches the workflow at 09:45 and 18:45 BRT. The script skips weekends/holidays and waits in-process until exactly 10:00 / 19:00 before punching.
- **Manual**: Click "Run workflow" in GitHub Actions and leave `scheduled_target_hour` empty. It punches immediately. Manual runs cancel any in-progress scheduled run and take priority.

## Manual trigger

```bash
gh workflow run punch.yml
```

## Notes

- Runtime is plain Node.js ESM with a single dependency: `playwright`.
- Local sanity checks expect Node 24+, matching the GitHub Actions runtime.
- `npm run sync-cron-jobs` declaratively manages exactly two cron-job.org jobs that dispatch the workflow at 09:45 and 18:45 BRT.
- Manual triggers cancel any in-progress scheduled run so they execute immediately. Externally scheduled dispatches do not cancel waiting runs.
- Holidays are configured in `config/holidays-2026.json` and only cover 2026. Update that file before relying on scheduled mode in another year.
- Playwright browsers are cached between runs with `actions/cache@v5`. The first run after a cache miss or dependency change can be slower than later runs.
- The token in `GITHUB_TOKEN` is stored in cron-job.org job headers. If it changes, rerun `npm run sync-cron-jobs` so cron-job.org gets the new dispatch header.
- Monitor scheduler jitter/execution in cron-job.org and use GitHub Actions for the actual punch logs.
- Success is confirmed by both the `Marcacao` response HTML and the updated Kairos success message. Kairos sends email confirmations separately.
- If the job fails, this automation did not confirm success. Check the GitHub run logs and the Kairos email separately.
