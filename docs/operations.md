# Kairos Punch Bot Operations

## Required Secrets
- `KAIROS_EMAIL`
- `KAIROS_PASSWORD`

Add them with the GitHub CLI after the repository is pushed:

```bash
gh secret set KAIROS_EMAIL
gh secret set KAIROS_PASSWORD
```

## Schedule Safety Gate
Scheduled runs stay disabled until the repository variable below is set to `true`:

- `KAIROS_AUTOMATION_ENABLED`

Start with:

```bash
gh variable set KAIROS_AUTOMATION_ENABLED -b false
```

After both manual live checks succeed, enable the weekday schedule:

```bash
gh variable set KAIROS_AUTOMATION_ENABLED -b true
```

## Manual Validation
Dry-run the morning flow:

```bash
gh workflow run punch.yml -f action=clock-in -f dry_run=true -f force_live=false
```

Dry-run the evening flow:

```bash
gh workflow run punch.yml -f action=clock-out -f dry_run=true -f force_live=false
```

Run the real morning flow:

```bash
gh workflow run punch.yml -f action=clock-in -f dry_run=false -f force_live=true
```

Run the real evening flow:

```bash
gh workflow run punch.yml -f action=clock-out -f dry_run=false -f force_live=true
```

## Notes
- The workflow is scheduled for `09:57` and `18:57` in `America/Sao_Paulo`, then waits in-process until `10:00` or `19:00`.
- Scheduled runs fail closed if GitHub starts them more than 5 minutes after the target punch time.
- `workflow_dispatch` bypasses that late-start guard so you can dry-run or manually recover a missed punch at any time.
- Live manual dispatches require `force_live=true`, and live reruns are blocked to reduce accidental duplicate punches.
- This setup assumes the bot is the only normal writer of punches. Do not keep using the same Kairos page manually in parallel with the automation.
- Weekend and holiday skipping is handled in code, using `config/holidays-2026.json`.
- Failure screenshots and dry-run screenshots are uploaded as workflow artifacts.
- If the Kairos UI changes, inspect the latest artifact screenshot and update the selectors in `src/kairos.ts`.
