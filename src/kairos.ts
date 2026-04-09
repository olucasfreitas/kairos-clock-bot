import { chromium } from "playwright";

const KAIROS_URL =
  "https://www.dimepkairos.com.br/Dimep/Account/Marcacao";
const SUCCESS_TEXT = "marcacao de ponto inserida com sucesso";

export async function punch(email: string, password: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo"
    });
    page.setDefaultTimeout(30_000);

    await page.goto(KAIROS_URL, { waitUntil: "domcontentloaded" });

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

    const marcacaoResponsePromise = page.waitForResponse(
      (response) => {
        return (
          response.request().resourceType() === "document" &&
          response.url().toLowerCase().includes("/dimep/account/marcacao")
        );
      },
      { timeout: 15_000 }
    );

    await punchButton.click();

    const marcacaoResponse = await marcacaoResponsePromise;

    const marcacaoHtml = normalizeText(await marcacaoResponse.text());

    if (!marcacaoHtml.includes(SUCCESS_TEXT)) {
      throw new Error("Kairos Marcacao response did not confirm the punch.");
    }

    await page.waitForFunction(
      () => {
        return document.body.innerText
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/\s+/g, " ")
          .toLowerCase()
          .includes("marcacao de ponto inserida com sucesso");
      },
      { timeout: 15_000 }
    );
  } finally {
    await browser.close();
  }
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}
