import { chromium } from "playwright";

const KAIROS_URL =
  "https://www.dimepkairos.com.br/Dimep/Account/Marcacao";
const DEFAULT_TIMEOUT_MS = 30_000;
const SUCCESS_TIMEOUT_MS = 15_000;
const SUCCESS_TEXT = "marcacao de ponto inserida com sucesso";

export async function punch(email, password, options = {}) {
  const defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const successTimeoutMs = options.successTimeoutMs ?? SUCCESS_TIMEOUT_MS;
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo"
    });

    page.setDefaultTimeout(defaultTimeoutMs);
    await page.goto(KAIROS_URL, {
      waitUntil: "domcontentloaded",
      timeout: defaultTimeoutMs
    });

    const emailInput = page.getByPlaceholder(/e-?mail/i).first();
    await emailInput.waitFor({ state: "visible" });
    await emailInput.fill(email);

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: "visible" });
    await passwordInput.fill(password);

    const punchButton = page
      .getByRole("button", { name: /marcar ponto/i })
      .first();
    await punchButton.waitFor({ state: "visible" });

    // Kairos currently confirms the punch by returning the final Marcacao HTML document.
    const marcacaoResponsePromise = page.waitForResponse(
      (response) =>
        response.status() === 200 &&
        response.request().resourceType() === "document" &&
        response.url().toLowerCase().includes("/dimep/account/marcacao"),
      { timeout: successTimeoutMs }
    );

    await punchButton.click();

    const marcacaoResponse = await marcacaoResponsePromise;
    const marcacaoHtml = normalizeText(await marcacaoResponse.text());

    if (!marcacaoHtml.includes(SUCCESS_TEXT)) {
      throw new Error("Kairos Marcacao response did not confirm the punch.");
    }

    await page.waitForFunction(
      (expectedText) =>
        document.body.innerText
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/\s+/g, " ")
          .toLowerCase()
          .includes(expectedText),
      SUCCESS_TEXT,
      { timeout: successTimeoutMs }
    );
  } finally {
    await browser.close();
  }
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}
