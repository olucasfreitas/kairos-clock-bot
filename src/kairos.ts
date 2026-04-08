import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type Locator, type Page } from "playwright";

import type { PunchAction } from "./calendar.js";

export const KAIROS_PUNCH_URL =
  "https://www.dimepkairos.com.br/Dimep/Account/Marcacao";
export const KAIROS_LOGIN_URL =
  "https://www.dimepkairos.com.br/Dimep/Account/LogOn";

const GENERIC_PUNCH_KEYWORDS = ["marcar ponto", "registrar ponto", "bater ponto"];
const ACTION_KEYWORDS: Record<PunchAction, string[]> = {
  "clock-in": [
    "entrada",
    "registrar entrada",
    "iniciar jornada",
    "iniciar expediente",
    ...GENERIC_PUNCH_KEYWORDS
  ],
  "clock-out": [
    "saida",
    "registrar saida",
    "encerrar jornada",
    "encerrar expediente",
    ...GENERIC_PUNCH_KEYWORDS
  ]
};

const ACTION_SPECIFIC_KEYWORDS: Record<PunchAction, string[]> = {
  "clock-in": ["entrada", "registrar entrada", "iniciar jornada", "iniciar expediente"],
  "clock-out": ["saida", "registrar saida", "encerrar jornada", "encerrar expediente"]
};

export interface RunKairosPunchOptions {
  action: PunchAction;
  artifactsDir?: string;
  dryRun?: boolean;
  email: string;
  headless?: boolean;
  password: string;
  timeoutMs?: number;
}

export interface RunKairosPunchResult {
  action: PunchAction;
  dryRun: boolean;
  finalUrl: string;
  pageText: string;
  screenshotPath?: string;
}

export function getActionKeywords(action: PunchAction): readonly string[] {
  return ACTION_KEYWORDS[action];
}

export function pageTextSupportsAction(
  action: PunchAction,
  pageText: string
): boolean {
  const normalizedPageText = normalizeText(pageText);
  const expected = ACTION_SPECIFIC_KEYWORDS[action].some((keyword) =>
    normalizedPageText.includes(normalizeText(keyword))
  );
  const oppositeAction = action === "clock-in" ? "clock-out" : "clock-in";
  const opposite = ACTION_SPECIFIC_KEYWORDS[oppositeAction].some((keyword) =>
    normalizedPageText.includes(normalizeText(keyword))
  );

  return expected && !opposite;
}

export function punchAppearsSuccessful(
  action: PunchAction,
  beforePunchText: string,
  afterPunchText: string
): boolean {
  const normalizedBeforeText = normalizeText(beforePunchText);
  const normalizedAfterText = normalizeText(afterPunchText);
  const oppositeAction = action === "clock-in" ? "clock-out" : "clock-in";
  const explicitSuccessKeywords = [
    "registro efetuado com sucesso",
    "registrado com sucesso",
    "comprovante",
    "qr code",
    "protocolo",
    "assinatura"
  ];
  const explicitSuccess = explicitSuccessKeywords.some(
    (fragment) =>
      normalizedAfterText.includes(fragment) &&
      !normalizedBeforeText.includes(fragment)
  );
  const oppositeActionVisible = ACTION_SPECIFIC_KEYWORDS[oppositeAction].some((keyword) =>
    normalizedAfterText.includes(normalizeText(keyword))
  );
  const oppositeActionWasVisible = ACTION_SPECIFIC_KEYWORDS[oppositeAction].some(
    (keyword) => normalizedBeforeText.includes(normalizeText(keyword))
  );
  const currentActionVisibleAfter = ACTION_SPECIFIC_KEYWORDS[action].some((keyword) =>
    normalizedAfterText.includes(normalizeText(keyword))
  );
  const currentActionWasVisible = ACTION_SPECIFIC_KEYWORDS[action].some((keyword) =>
    normalizedBeforeText.includes(normalizeText(keyword))
  );
  const textChanged = normalizedBeforeText !== normalizedAfterText;

  return (
    explicitSuccess ||
    (textChanged &&
      oppositeActionVisible &&
      (!oppositeActionWasVisible ||
        (currentActionWasVisible && !currentActionVisibleAfter)))
  );
}

export function pickConfirmationLabel(labels: readonly string[]): string | undefined {
  return labels.find((label) => /confirmar|sim|ok/i.test(label));
}

export async function runKairosPunch({
  action,
  artifactsDir = "artifacts",
  dryRun = false,
  email,
  headless = true,
  password,
  timeoutMs = 30_000
}: RunKairosPunchOptions): Promise<RunKairosPunchResult> {
  const browser = await chromium.launch({ headless });
  let page: Page | undefined;

  try {
    page = await browser.newPage({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo"
    });
    page.setDefaultTimeout(timeoutMs);

    await page.goto(KAIROS_PUNCH_URL, { waitUntil: "domcontentloaded" });

    if (!(await hasVisibleLoginForm(page))) {
      await page.goto(KAIROS_LOGIN_URL, { waitUntil: "domcontentloaded" });
    }

    await fillLoginForm(page, email, password);
    await submitLogin(page);
    await page.goto(KAIROS_PUNCH_URL, { waitUntil: "domcontentloaded" });

    if (await hasVisibleLoginForm(page)) {
      throw new Error("Kairos login did not complete successfully.");
    }

    const beforePunchText = await getBodyText(page);

    if (!pageTextSupportsAction(action, beforePunchText)) {
      throw new Error(
        `The Kairos page does not clearly indicate the expected ${action} action.`
      );
    }

    const punchButton = await findPunchButton(page, action);

    if (!punchButton) {
      throw new Error(`Could not find a punch button for ${action}.`);
    }

    if (dryRun) {
      const screenshotPath = await saveScreenshot(page, artifactsDir, `${action}-dry-run`);

      return {
        action,
        dryRun: true,
        finalUrl: page.url(),
        pageText: beforePunchText,
        screenshotPath
      };
    }

    await punchButton.click();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await maybeConfirmPunch(page);

    const afterPunchText = await getBodyText(page);

    if (await hasVisibleLoginForm(page)) {
      throw new Error("Kairos returned to the login screen after the punch attempt.");
    }

    if (looksLikeErrorState(afterPunchText)) {
      throw new Error("Kairos displayed an error after the punch attempt.");
    }

    if (!punchAppearsSuccessful(action, beforePunchText, afterPunchText)) {
      throw new Error("Kairos did not show a reliable success signal after the punch attempt.");
    }

    return {
      action,
      dryRun: false,
      finalUrl: page.url(),
      pageText: afterPunchText
    };
  } catch (error) {
    const screenshotPath = page
      ? await saveScreenshot(page, artifactsDir, `${action}-failure`)
      : undefined;
    const reason = error instanceof Error ? error.message : String(error);
    const screenshotMessage = screenshotPath
      ? ` Failure screenshot: ${screenshotPath}`
      : "";

    throw new Error(`${reason}${screenshotMessage}`);
  } finally {
    await browser.close();
  }
}

async function fillLoginForm(page: Page, email: string, password: string) {
  const usernameInput = await findUniqueVisible(page, [
    'form input[type="email"]',
    'form input[autocomplete="username"]',
    'form input[name*="usuario" i], form input[id*="usuario" i], form input[name*="user" i], form input[id*="user" i]',
    'form input:not([type="password"]):not([type="hidden"]):not([disabled])'
  ], "Kairos username input");

  if (!usernameInput) {
    throw new Error("Unable to find the Kairos username input.");
  }

  const passwordInput = await findUniqueVisible(page, [
    'form input[type="password"]'
  ], "Kairos password input");

  if (!passwordInput) {
    throw new Error("Unable to find the Kairos password input.");
  }

  await usernameInput.fill(email);
  await passwordInput.fill(password);
}

async function submitLogin(page: Page) {
  const submitButton = await findUniqueVisible(page, [
    'form button[type="submit"], form input[type="submit"]',
    "form button"
  ], "Kairos login button");

  if (!submitButton) {
    throw new Error("Unable to find the Kairos login button.");
  }

  await submitButton.click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function findPunchButton(
  page: Page,
  action: PunchAction
): Promise<Locator | undefined> {
  const controlSelectors = [
    "button",
    "a",
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]'
  ] as const;
  const specificMatches = await findMatchingText(page, controlSelectors, ACTION_SPECIFIC_KEYWORDS[action]);

  if (specificMatches.length > 1) {
    throw new Error(`Found multiple ${action} controls on the Kairos page.`);
  }

  if (specificMatches.length === 1) {
    return specificMatches[0];
  }

  const genericMatches = await findMatchingText(page, controlSelectors, GENERIC_PUNCH_KEYWORDS);

  if (genericMatches.length > 1) {
    throw new Error("Found multiple generic punch controls on the Kairos page.");
  }

  return genericMatches[0];
}

async function hasVisibleLoginForm(page: Page): Promise<boolean> {
  const passwordField = page.locator('input[type="password"]').first();

  return (
    (await passwordField.count()) > 0 &&
    (await passwordField.isVisible().catch(() => false))
  );
}

async function findFirstVisible(
  page: Page,
  factories: ReadonlyArray<(page: Page) => Locator>
): Promise<Locator | undefined> {
  for (const factory of factories) {
    const locator = factory(page).first();

    if ((await locator.count()) === 0) {
      continue;
    }

    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }

  return undefined;
}

async function findUniqueVisible(
  page: Page,
  selectors: readonly string[],
  label: string
): Promise<Locator | undefined> {
  for (const selector of selectors) {
    const matches = await collectVisibleLocators(page.locator(selector));

    if (matches.length > 1) {
      throw new Error(`Found multiple candidates for ${label}.`);
    }

    if (matches.length === 1) {
      return matches[0];
    }
  }

  return undefined;
}

async function collectVisibleLocators(locator: Locator): Promise<Locator[]> {
  const matches: Locator[] = [];
  const count = await locator.count();

  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);

    if (await candidate.isVisible().catch(() => false)) {
      matches.push(candidate);
    }
  }

  return matches;
}

async function findMatchingText(
  page: Page,
  selectors: readonly string[],
  keywords: readonly string[]
): Promise<Locator[]> {
  const matches: Locator[] = [];

  for (const selector of selectors) {
    const locator = page.locator(selector);
    const count = await locator.count();

    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);

      if (!(await candidate.isVisible().catch(() => false))) {
        continue;
      }

      const rawText =
        (await candidate.textContent().catch(() => "")) ||
        (await candidate.inputValue().catch(() => ""));

      const normalizedCandidateText = normalizeText(rawText);
      const matchesKeyword = keywords.some((keyword) =>
        normalizedCandidateText.includes(normalizeText(keyword))
      );

      if (matchesKeyword) {
        matches.push(candidate);
      }
    }
  }

  return matches;
}

async function getBodyText(page: Page): Promise<string> {
  const body = page.locator("body").first();

  if ((await body.count()) === 0) {
    return "";
  }

  return body.innerText().catch(() => "");
}

async function saveScreenshot(
  page: Page,
  artifactsDir: string,
  label: string
): Promise<string> {
  await mkdir(artifactsDir, { recursive: true });

  const fileName = `${label}-${new Date().toISOString().replaceAll(":", "-")}.png`;
  const screenshotPath = path.join(artifactsDir, fileName);

  await page.screenshot({ fullPage: true, path: screenshotPath });

  return screenshotPath;
}

function looksLikeErrorState(pageText: string): boolean {
  const normalizedPageText = normalizeText(pageText);

  return [
    "usuario ou senha invalidos",
    "login invalido",
    "ocorreu um erro",
    "erro ao registrar",
    "nao foi possivel"
  ].some((fragment) => normalizedPageText.includes(fragment));
}

async function maybeConfirmPunch(page: Page) {
  const dialogButtons = await collectVisibleLocators(
    page.locator('[role="dialog"] button, .modal button, .swal2-container button')
  );
  const confirmationTexts = await Promise.all(
    dialogButtons.map(async (button) => {
      return (
        (await button.textContent().catch(() => "")) ||
        (await button.inputValue().catch(() => ""))
      );
    })
  );
  const labelToClick = pickConfirmationLabel(confirmationTexts);

  if (!labelToClick) {
    return;
  }
  const confirmationIndex = confirmationTexts.findIndex((text) => text === labelToClick);

  if (confirmationIndex === -1) {
    return;
  }

  const confirmationButton = dialogButtons.at(confirmationIndex);

  if (!confirmationButton) {
    return;
  }

  await confirmationButton.click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
