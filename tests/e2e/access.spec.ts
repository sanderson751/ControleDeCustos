import { readFile } from "node:fs/promises";
import { expect, login, seedCost, test } from "./support/app";

test.describe("relatórios e controle de acesso", () => {
  test("exporta o relatório do mês em CSV", async ({ page, seedUser }) => {
    const user = await seedUser("standard");
    await seedCost(user, "internet", { accountName: "Internet fibra", amount: 119.9, category: "moradia" });
    await login(page, user);

    await page.getByRole("link", { name: "Relatórios", exact: true }).click();
    await expect(page.getByRole("row", { name: /Internet fibra/ })).toBeVisible();
    await page.getByRole("button", { name: "Exportar" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: "Exportar CSV" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^relatorio-custos-.*\.csv$/);
    const content = await readFile((await download.path())!, "utf8");
    expect(content).toContain('"Internet fibra"');
    expect(content).toContain('"119,90"');
  });

  test("guest vê os próprios dados sem ações de edição", async ({ page, seedUser }) => {
    const guest = await seedUser("guest", "Gui Convidado");
    await seedCost(guest, "luz", { accountName: "Conta de luz", amount: 210, category: "moradia" });
    await login(page, guest);

    await expect(page.getByRole("link", { name: "Ver custos", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Importar extrato", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Perfis de usuários", exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: "Custos", exact: true }).click();
    await expect(page.getByRole("row", { name: /Conta de luz/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar custo" })).toHaveCount(0);

    await page.goto("/import");
    await expect(page.getByText("Você não possui permissão para importar lançamentos.")).toBeVisible();
  });
});
