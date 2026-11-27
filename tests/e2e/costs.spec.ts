import { listDocuments } from "./support/emulators";
import { expect, login, seedCost, test, typeCurrency } from "./support/app";

test.describe("custos, categorias e orçamentos", () => {
  test("cria categoria personalizada e lança um custo nela", async ({ page, seedUser }) => {
    const user = await seedUser("standard");
    await login(page, user);

    await page.getByRole("link", { name: "Categorias", exact: true }).click();
    await page.getByLabel("Nome").fill("Pets");
    await page.getByRole("button", { name: "Adicionar categoria" }).click();
    await expect(page.getByText('Categoria "Pets" criada com sucesso.')).toBeVisible();

    await page.getByRole("link", { name: "Custos", exact: true }).click();
    // Campos do cadastro rapido (ids estaveis; "Conta"/"Valor" tambem aparecem em filtros).
    await page.locator("#cost-account-name").fill("Ração");
    await page.locator("#cost-amount").pressSequentially("15990");
    await page.locator("#cost-category").selectOption({ label: "Pets" });
    await page.getByRole("button", { name: "Adicionar custo" }).click();

    const row = page.getByRole("row", { name: /Ração/ });
    await expect(row).toContainText("Pets");
    await expect(row).toContainText("R$ 159,90");

    const [entry] = await listDocuments(`users/${user.uid}/costEntries`);
    expect(entry).toMatchObject({ accountName: "Ração", amount: 159.9 });

    await page.getByRole("link", { name: "Início", exact: true }).click();
    await expect(page.getByText("R$ 159,90").first()).toBeVisible();
  });

  test("orçamento atingido gera alerta no Início", async ({ page, seedUser }) => {
    const user = await seedUser("standard");
    await seedCost(user, "mercado", { accountName: "Mercado", amount: 90, category: "alimentacao" });
    await login(page, user);

    await page.getByRole("link", { name: "Orçamentos", exact: true }).click();
    await typeCurrency(page, "Alimentação", "10000");
    await page.getByRole("button", { name: "Salvar orçamentos" }).click();
    await expect(page.getByText(/salvos? com sucesso|Orçamentos? atualizados?/i).first()).toBeVisible();

    await page.getByRole("link", { name: "Início", exact: true }).click();
    await expect(page.getByText(/Alimentação atingiu 90% do orçamento/)).toBeVisible();
  });
});
