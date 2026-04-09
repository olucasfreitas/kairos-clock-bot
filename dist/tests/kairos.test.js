import { describe, expect, test } from "vitest";
async function loadKairosModule() {
    const kairosModule = await import("../src/kairos.js").catch(() => undefined);
    expect(kairosModule).toBeDefined();
    return kairosModule;
}
describe("inlinePunchFormSignalsPresent", () => {
    test("accepts a direct form when email, password, and punch button are present", async () => {
        const { inlinePunchFormSignalsPresent } = await loadKairosModule();
        expect(inlinePunchFormSignalsPresent({
            hasEmailField: true,
            hasPasswordField: true,
            hasPunchButton: true
        })).toBe(true);
    });
    test("rejects incomplete direct form signals", async () => {
        const { inlinePunchFormSignalsPresent } = await loadKairosModule();
        expect(inlinePunchFormSignalsPresent({
            hasEmailField: true,
            hasPasswordField: false,
            hasPunchButton: true
        })).toBe(false);
    });
});
describe("pageTextShowsSuccessfulPunch", () => {
    test("accepts the exact success banner from the proven page", async () => {
        const { pageTextShowsSuccessfulPunch } = await loadKairosModule();
        expect(pageTextShowsSuccessfulPunch("Marcacao de Ponto inserida com sucesso\n08/04/2026 17:14:00")).toBe(true);
    });
    test("accepts the exact receipt heading from the proven page", async () => {
        const { pageTextShowsSuccessfulPunch } = await loadKairosModule();
        expect(pageTextShowsSuccessfulPunch("COMPROVANTE DE REGISTRO DE PONTO DO TRABALHADOR")).toBe(true);
    });
    test("rejects a generic comprovante mention", async () => {
        const { pageTextShowsSuccessfulPunch } = await loadKairosModule();
        expect(pageTextShowsSuccessfulPunch("Comprovante disponivel")).toBe(false);
    });
});
describe("buildArtifactLabel", () => {
    test("uses a success suffix for successful punches", async () => {
        const { buildArtifactLabel } = await loadKairosModule();
        expect(buildArtifactLabel("clock-in", "success")).toBe("clock-in-success");
    });
    test("uses a dry-run suffix for dry runs", async () => {
        const { buildArtifactLabel } = await loadKairosModule();
        expect(buildArtifactLabel("clock-out", "dry-run")).toBe("clock-out-dry-run");
    });
    test("supports manual artifact labels", async () => {
        const { buildArtifactLabel } = await loadKairosModule();
        const buildManualArtifactLabel = buildArtifactLabel;
        expect(buildManualArtifactLabel("manual", "success")).toBe("manual-success");
    });
});
