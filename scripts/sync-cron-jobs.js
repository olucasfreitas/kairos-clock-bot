const CRON_JOB_API_BASE = "https://api.cron-job.org";
const GITHUB_DISPATCH_URL =
  "https://api.github.com/repos/olucasfreitas/kairos-clock-bot/actions/workflows/punch.yml/dispatches";
const GITHUB_API_VERSION = "2022-11-28";
const SCHEDULE_TIMEZONE = "America/Sao_Paulo";
const WEEKDAYS = [1, 2, 3, 4, 5];

const DESIRED_JOBS = [
  {
    title: "Kairos Punch Dispatch 10:00",
    dispatchHour: 10,
    dispatchMinute: 0
  },
  {
    title: "Kairos Punch Dispatch 19:00",
    dispatchHour: 19,
    dispatchMinute: 0
  }
];

async function main() {
  const cronJobApiKey = requireEnv("CRON_JOB_API_KEY");
  const githubToken = requireEnv("GITHUB_TOKEN");
  const jobs = await listJobs(cronJobApiKey);
  const jobsByTitle = indexJobsByTitle(jobs);

  for (const desiredJob of DESIRED_JOBS) {
    const existingJob = jobsByTitle.get(desiredJob.title);
    const payload = { job: buildCronJobDefinition(desiredJob, githubToken) };

    if (existingJob) {
      await cronJobRequest(
        cronJobApiKey,
        `/jobs/${existingJob.jobId}`,
        "PATCH",
        payload
      );
      console.log(
        `[cron-job] Updated ${desiredJob.title} (jobId=${existingJob.jobId}).`
      );
      continue;
    }

    const response = await cronJobRequest(cronJobApiKey, "/jobs", "PUT", payload);
    console.log(
      `[cron-job] Created ${desiredJob.title} (jobId=${response.jobId}).`
    );
  }
}

main().catch((error) => {
  console.error(
    `[cron-job] ${error instanceof Error ? error.message : error}`
  );
  process.exit(1);
});

function buildCronJobDefinition(job, githubToken) {
  return {
    enabled: true,
    title: job.title,
    saveResponses: false,
    url: GITHUB_DISPATCH_URL,
    requestMethod: 1,
    requestTimeout: 30,
    redirectSuccess: false,
    schedule: {
      timezone: SCHEDULE_TIMEZONE,
      expiresAt: 0,
      hours: [job.dispatchHour],
      mdays: [-1],
      minutes: [job.dispatchMinute],
      months: [-1],
      wdays: WEEKDAYS
    },
    extendedData: {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": "kairos-clock-bot",
        "X-GitHub-Api-Version": GITHUB_API_VERSION
      },
      body: JSON.stringify({
        ref: "main",
        inputs: {
          scheduled_run: "true"
        }
      })
    }
  };
}

async function listJobs(cronJobApiKey) {
  const response = await cronJobRequest(cronJobApiKey, "/jobs", "GET");

  if (!Array.isArray(response.jobs)) {
    throw new Error("cron-job.org returned an unexpected jobs payload.");
  }

  return response.jobs;
}

function indexJobsByTitle(jobs) {
  const jobsByTitle = new Map();

  for (const job of jobs) {
    if (!job?.title) {
      continue;
    }

    if (jobsByTitle.has(job.title)) {
      throw new Error(
        `Duplicate cron-job.org titles found for "${job.title}". Clean them up before syncing.`
      );
    }

    jobsByTitle.set(job.title, job);
  }

  return jobsByTitle;
}

async function cronJobRequest(apiKey, path, method, payload, attempt = 1) {
  const response = await fetch(`${CRON_JOB_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: payload ? JSON.stringify(payload) : undefined
  });

  if (response.status === 429 && attempt < 4) {
    await sleep(1500 * attempt);
    return cronJobRequest(apiKey, path, method, payload, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(
      `cron-job.org ${method} ${path} failed: ${response.status} ${await response.text()}`
    );
  }

  return response.status === 204 ? {} : response.json();
}

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
