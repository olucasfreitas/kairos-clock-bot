import { describe, expect, test } from "vitest";

async function loadKairosModule() {
  const kairosModule = await import("../src/kairos.ts").catch(() => undefined);

  expect(kairosModule).toBeDefined();

  return kairosModule!;
}

describe("getActionKeywords", () => {
  test("includes entry-oriented labels for clock-in", async () => {
    const { getActionKeywords } = await loadKairosModule();

    expect(getActionKeywords("clock-in")).toEqual(
      expect.arrayContaining(["entrada", "iniciar jornada", "marcar ponto"])
    );
  });

  test("includes exit-oriented labels for clock-out", async () => {
    const { getActionKeywords } = await loadKairosModule();

    expect(getActionKeywords("clock-out")).toEqual(
      expect.arrayContaining(["saida", "encerrar jornada", "marcar ponto"])
    );
  });
});

describe("pageTextSupportsAction", () => {
  test("accepts entry text for clock-in runs", async () => {
    const { pageTextSupportsAction } = await loadKairosModule();

    expect(
      pageTextSupportsAction(
        "clock-in",
        "Registrar Entrada\nSeu proximo registro sera de entrada."
      )
    ).toBe(true);
  });

  test("rejects explicit exit text for clock-in runs", async () => {
    const { pageTextSupportsAction } = await loadKairosModule();

    expect(pageTextSupportsAction("clock-in", "Registrar Saida")).toBe(false);
  });

  test("rejects generic text when the action cannot be confirmed", async () => {
    const { pageTextSupportsAction } = await loadKairosModule();

    expect(pageTextSupportsAction("clock-out", "Marcar ponto")).toBe(false);
  });
});

describe("punchAppearsSuccessful", () => {
  test("accepts explicit success text after the click", async () => {
    const { punchAppearsSuccessful } = await loadKairosModule();

    expect(
      punchAppearsSuccessful(
        "clock-in",
        "Registrar Entrada",
        "Registro efetuado com sucesso. Comprovante disponivel."
      )
    ).toBe(true);
  });

  test("rejects success fragments that were already visible before the click", async () => {
    const { punchAppearsSuccessful } = await loadKairosModule();

    expect(
      punchAppearsSuccessful(
        "clock-in",
        "Registrar Entrada. Comprovante disponivel.",
        "Registrar Entrada. Comprovante disponivel."
      )
    ).toBe(false);
  });

  test("accepts the opposite action becoming available after the click", async () => {
    const { punchAppearsSuccessful } = await loadKairosModule();

    expect(
      punchAppearsSuccessful(
        "clock-in",
        "Registrar Entrada",
        "Ultimo registro: Entrada\nRegistrar Saida"
      )
    ).toBe(true);
  });

  test("rejects unchanged text with no positive signal", async () => {
    const { punchAppearsSuccessful } = await loadKairosModule();

    expect(
      punchAppearsSuccessful("clock-out", "Registrar Saida", "Registrar Saida")
    ).toBe(false);
  });
});

describe("pickConfirmationLabel", () => {
  test("chooses the affirmative option when cancel appears first", async () => {
    const { pickConfirmationLabel } = await loadKairosModule();

    expect(pickConfirmationLabel(["Cancelar", "Confirmar"])).toBe("Confirmar");
  });

  test("accepts short affirmative labels", async () => {
    const { pickConfirmationLabel } = await loadKairosModule();

    expect(pickConfirmationLabel(["Nao", "Sim"])).toBe("Sim");
  });

  test("returns undefined when there is no affirmative option", async () => {
    const { pickConfirmationLabel } = await loadKairosModule();

    expect(pickConfirmationLabel(["Fechar", "Cancelar"])).toBeUndefined();
  });
});
