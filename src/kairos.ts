import { chromium } from "playwright";

const KAIROS_URL =
  "https://www.dimepkairos.com.br/Dimep/Account/Marcacao";

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
    await punchButton.click();

    await page.waitForFunction(
      () => {
        return document.body.innerText
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .includes("marcacao de ponto inserida com sucesso");
      },
      { timeout: 15_000 }
    );
  } finally {
    await browser.close();
  }
}
