import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
export const KAIROS_PUNCH_URL = "https://www.dimepkairos.com.br/Dimep/Account/Marcacao";
const SUCCESS_MARKERS = [
    "marcacao de ponto inserida com sucesso",
    "comprovante de registro de ponto do trabalhador"
];
const ERROR_MARKERS = [
    "usuario ou senha invalidos",
    "login invalido",
    "ocorreu um erro",
    "erro ao registrar",
    "nao foi possivel"
];
const USERNAME_INPUT_FACTORIES = [
    (candidatePage) => candidatePage.getByPlaceholder(/e-mail|email/i),
    (candidatePage) => candidatePage.getByLabel(/e-mail|email|nome do usuario|usuario/i),
    (candidatePage) => candidatePage.locator('input[name*="email" i], input[id*="email" i], input[type="email"]')
];
const PASSWORD_INPUT_FACTORIES = [
    (candidatePage) => candidatePage.getByPlaceholder(/senha|password/i),
    (candidatePage) => candidatePage.getByLabel(/senha|password/i),
    (candidatePage) => candidatePage.locator('input[type="password"]')
];
const PUNCH_BUTTON_FACTORIES = [
    (candidatePage) => candidatePage.getByRole("button", { name: /^marcar ponto$/i }),
    (candidatePage) => candidatePage.locator('input[type="submit"][value="Marcar ponto" i], input[type="button"][value="Marcar ponto" i]')
];
export function inlinePunchFormSignalsPresent(signals) {
    return signals.hasEmailField && signals.hasPasswordField && signals.hasPunchButton;
}
export function pageTextShowsSuccessfulPunch(pageText) {
    const normalizedPageText = normalizeText(pageText);
    return SUCCESS_MARKERS.some((marker) => normalizedPageText.includes(marker));
}
export function buildArtifactLabel(artifactLabel, kind) {
    return `${artifactLabel}-${kind}`;
}
export async function runKairosPunch({ artifactLabel, artifactsDir = "artifacts", dryRun = false, email, headless = true, password, timeoutMs = 30_000 }) {
    const browser = await chromium.launch({ headless });
    let page;
    try {
        page = await browser.newPage({
            locale: "pt-BR",
            timezoneId: "America/Sao_Paulo"
        });
        page.setDefaultTimeout(timeoutMs);
        await page.goto(KAIROS_PUNCH_URL, { waitUntil: "domcontentloaded" });
        const directFormSignals = await waitForInlinePunchForm(page);
        if (!inlinePunchFormSignalsPresent(directFormSignals)) {
            throw new Error("The Kairos inline punch form is not available.");
        }
        await fillLoginForm(page, email, password);
        const punchButton = await getDirectPunchButton(page);
        if (!punchButton) {
            throw new Error("Unable to find the Kairos punch button.");
        }
        if (dryRun) {
            const screenshotPath = await saveScreenshot(page, artifactsDir, buildArtifactLabel(artifactLabel, "dry-run"));
            return {
                artifactLabel,
                dryRun: true,
                finalUrl: page.url(),
                pageText: await getBodyText(page),
                screenshotPath
            };
        }
        await punchButton.click();
        await waitForPunchOutcome(page);
        const afterPunchText = await getBodyText(page);
        if (looksLikeErrorState(afterPunchText)) {
            throw new Error("Kairos displayed an error after the punch attempt.");
        }
        if (!pageTextShowsSuccessfulPunch(afterPunchText)) {
            throw new Error("Kairos did not show the proven success banner or receipt.");
        }
        const screenshotPath = await saveScreenshot(page, artifactsDir, buildArtifactLabel(artifactLabel, "success"));
        return {
            artifactLabel,
            dryRun: false,
            finalUrl: page.url(),
            pageText: afterPunchText,
            screenshotPath
        };
    }
    catch (error) {
        const screenshotPath = page
            ? await saveScreenshot(page, artifactsDir, buildArtifactLabel(artifactLabel, "failure"))
            : undefined;
        const reason = error instanceof Error ? error.message : String(error);
        const screenshotMessage = screenshotPath
            ? ` Failure screenshot: ${screenshotPath}`
            : "";
        throw new Error(`${reason}${screenshotMessage}`);
    }
    finally {
        await browser.close();
    }
}
async function waitForInlinePunchForm(page) {
    const emailField = await waitForFirstVisible(page, USERNAME_INPUT_FACTORIES);
    const passwordField = await waitForFirstVisible(page, PASSWORD_INPUT_FACTORIES);
    const punchButton = await waitForFirstVisible(page, PUNCH_BUTTON_FACTORIES);
    return {
        hasEmailField: emailField !== undefined,
        hasPasswordField: passwordField !== undefined,
        hasPunchButton: punchButton !== undefined
    };
}
async function inspectInlinePunchFormSignals(page) {
    const emailField = await getUsernameInput(page);
    const passwordField = await getPasswordInput(page);
    const punchButton = await getDirectPunchButton(page);
    return {
        hasEmailField: emailField !== undefined,
        hasPasswordField: passwordField !== undefined,
        hasPunchButton: punchButton !== undefined
    };
}
async function fillLoginForm(page, email, password) {
    const usernameInput = await getUsernameInput(page);
    if (!usernameInput) {
        throw new Error("Unable to find the Kairos username input.");
    }
    const passwordInput = await getPasswordInput(page);
    if (!passwordInput) {
        throw new Error("Unable to find the Kairos password input.");
    }
    await usernameInput.fill(email);
    await passwordInput.fill(password);
}
async function getUsernameInput(page) {
    return findFirstVisible(page, USERNAME_INPUT_FACTORIES);
}
async function getPasswordInput(page) {
    return findFirstVisible(page, PASSWORD_INPUT_FACTORIES);
}
async function getDirectPunchButton(page) {
    return findFirstVisible(page, PUNCH_BUTTON_FACTORIES);
}
async function findFirstVisible(page, factories) {
    for (const factory of factories) {
        const locator = factory(page);
        for (let index = 0; index < (await locator.count()); index += 1) {
            const candidate = locator.nth(index);
            if (await candidate.isVisible().catch(() => false)) {
                return candidate;
            }
        }
    }
    return undefined;
}
async function waitForFirstVisible(page, factories, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const locator = await findFirstVisible(page, factories);
        if (locator) {
            return locator;
        }
        await page.waitForTimeout(250);
    }
    return undefined;
}
async function getBodyText(page) {
    const body = page.locator("body").first();
    if ((await body.count()) === 0) {
        return "";
    }
    return body.innerText().catch(() => "");
}
async function saveScreenshot(page, artifactsDir, label) {
    await mkdir(artifactsDir, { recursive: true });
    await redactSensitiveInputs(page);
    const fileName = `${label}-${new Date().toISOString().replaceAll(":", "-")}.png`;
    const screenshotPath = path.join(artifactsDir, fileName);
    await page.screenshot({ fullPage: true, path: screenshotPath });
    return screenshotPath;
}
async function redactSensitiveInputs(page) {
    await page.evaluate(() => {
        const elements = document.querySelectorAll("input");
        for (const element of elements) {
            const fingerprint = [
                element.type,
                element.name,
                element.id,
                element.placeholder,
                element.getAttribute("aria-label") ?? ""
            ]
                .join(" ")
                .toLowerCase();
            const looksSensitive = fingerprint.includes("mail") ||
                fingerprint.includes("senha") ||
                fingerprint.includes("password") ||
                fingerprint.includes("usuario") ||
                fingerprint.includes("user");
            if (looksSensitive) {
                element.value = "";
            }
        }
    }).catch(() => undefined);
}
function looksLikeErrorState(pageText) {
    const normalizedPageText = normalizeText(pageText);
    return ERROR_MARKERS.some((fragment) => normalizedPageText.includes(fragment));
}
async function waitForPunchOutcome(page) {
    await page.waitForFunction(({ successMarkers, errorMarkers }) => {
        const text = document.body.innerText
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase();
        return (successMarkers.some((marker) => text.includes(marker)) ||
            errorMarkers.some((marker) => text.includes(marker)));
    }, {
        successMarkers: SUCCESS_MARKERS,
        errorMarkers: ERROR_MARKERS
    });
}
function normalizeText(value) {
    return value
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .replaceAll(/\s+/g, " ")
        .trim()
        .toLowerCase();
}
