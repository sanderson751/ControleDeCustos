import { listDocuments } from "./support/emulators";
import { brDate, expect, login, test, today, typeCurrency } from "./support/app";

test.describe("importação, recorrentes e metas", () => {
  test("importa CSV do extrato e ignora o crédito", async ({ page, seedUser }) => {
    const user = await seedUser("standard");
    await login(page, user);
    await page.getByRole("link", { name: "Importar extrato", exact: true }).click();

    const csv = [
      "Data;Histórico;Valor",
      `${brDate(1)};UBER TRIP;-23,90`,
      `${brDate(1)};Salário;5.000,00`,
      `${brDate(1)};IFOOD *RESTAURANTE;-58,40`,
    ].join("\n");
    await page.locator("#statement-file").setInputFiles({
      name: "extrato.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });

    await expect(page.getByRole("row", { name: /Salário/ })).toContainText("Crédito ignorado");
    await expect(page.getByLabel(/Categoria da linha \d+: IFOOD/)).toHaveValue("alimentacao");
    await page.getByRole("button", { name: "Importar 2 lançamentos" }).click();

    await expect(page.getByText("2 lançamentos importados com sucesso.")).toBeVisible();
    await expect(page).toHaveURL(/\/costs/);
    await expect(page.getByRole("row", { name: /UBER TRIP/ })).toBeVisible();
    expect(await listDocuments(`users/${user.uid}/costEntries`)).toHaveLength(2);
  });

  test("recorrência gera os meses pendentes uma única vez", async ({ page, seedUser }) => {
    const user = await seedUser("standard");
    await login(page, user);
    await page.getByRole("link", { name: "Recorrentes", exact: true }).click();

    const { year, month } = today();
    const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    const form = page.getByRole("form", { name: "Nova recorrência" });
    await form.getByLabel("Conta").fill("Aluguel");
    await typeCurrency(page, "Valor", "200000");
    await form.getByLabel("Categoria").selectOption("moradia");
    await form.getByLabel("Ano do primeiro lançamento").selectOption(String(previous.year));
    await form.getByLabel("Mês do primeiro lançamento").selectOption(String(previous.month).padStart(2, "0"));
    await page.getByRole("button", { name: "Adicionar recorrência" }).click();

    await expect(page.getByText('Recorrência "Aluguel" criada. 2 lançamentos gerados.')).toBeVisible();
    expect(await listDocuments(`users/${user.uid}/costEntries`)).toHaveLength(2);

    // Reabrir o app nao duplica (cursor + id deterministico).
    await page.reload();
    await expect(page.getByRole("row", { name: /Aluguel/ })).toBeVisible();
    await page.getByRole("link", { name: "Custos", exact: true }).click();
    await expect(page.getByRole("row", { name: /Aluguel/ })).toContainText("Recorrente");
    expect(await listDocuments(`users/${user.uid}/costEntries`)).toHaveLength(2);
  });

  test("meta de economia com depósito aparece no Início", async ({ page, seedUser }) => {
    const user = await seedUser("standard");
    await login(page, user);
    await page.getByRole("link", { name: "Metas", exact: true }).click();

    const form = page.getByRole("form", { name: "Nova meta" });
    await form.getByLabel("Nome da meta").fill("Viagem");
    await typeCurrency(page, "Valor-alvo", "100000");
    await page.getByRole("button", { name: "Criar meta" }).click();

    const card = page.getByRole("region", { name: "Meta Viagem" });
    await card.getByRole("button", { name: "Depositar" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Valor").pressSequentially("25000");
    await dialog.getByRole("button", { name: "Registrar" }).click();

    await expect(card).toContainText("R$ 250,00");
    await expect(card).toContainText("25%");

    await page.getByRole("link", { name: "Início", exact: true }).click();
    await expect(page.getByText("Metas de economia")).toBeVisible();
    await expect(page.getByText(/Guardado em .*: R\$ 250,00/)).toBeVisible();
  });
});
