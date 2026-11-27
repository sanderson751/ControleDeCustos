import { listDocuments } from "./support/emulators";
import { expect, login, test } from "./support/app";

test.describe("lista de mercado", () => {
  test("lista, conclusão com total e preços, lançamento e previsão na próxima lista", async ({
    page,
    seedUser,
  }) => {
    const user = await seedUser("standard");
    await login(page, user);
    await page.getByRole("link", { name: "Mercado", exact: true }).click();

    await page.getByLabel("Nome da lista").fill("Feira de sábado");
    await page.getByRole("button", { name: "Criar lista" }).click();
    await expect(page.getByRole("heading", { name: "Feira de sábado" })).toBeVisible();

    const addForm = page.getByRole("form", { name: "Adicionar item" });
    for (const [name, quantity] of [["Arroz 5kg", "2"], ["Café", "1"]] as const) {
      await addForm.getByLabel("Produto").fill(name);
      await addForm.getByLabel("Quantidade").fill(quantity);
      await addForm.getByRole("button", { name: "Adicionar" }).click();
      await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
    }

    // Primeira compra: nada no historico.
    await expect(page.getByRole("row", { name: /^Total previsto/ })).toContainText("(2 itens sem histórico)");

    await page.getByRole("button", { name: "Concluir compra" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Loja").fill("Assaí");
    await dialog.getByLabel("Total pago").fill("");
    await dialog.getByLabel("Total pago").pressSequentially("6000");
    await dialog.getByLabel("Preço pago de Arroz 5kg").pressSequentially("2590");
    await dialog.getByLabel("Preço pago de Café").pressSequentially("820");
    await dialog.getByRole("button", { name: "Concluir e lançar" }).click();

    await expect(page.getByText(/Compra concluída: R\$ 60,00 lançados em Alimentação/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Usar novamente" })).toBeVisible();

    const [cost] = await listDocuments(`users/${user.uid}/costEntries`);
    expect(cost).toMatchObject({ accountName: "Mercado — Assaí", amount: 60, category: "alimentacao" });
    expect(await listDocuments(`users/${user.uid}/groceryPurchases`)).toHaveLength(1);

    // Proxima lista: previsao pelo preco pago.
    await page.getByRole("button", { name: "Usar novamente" }).click();
    await expect(page.getByRole("heading", { name: /^Compra de / })).toBeVisible();
    await expect(page.getByRole("row", { name: /Arroz 5kg/ })).toContainText("R$ 51,80");
    await expect(page.getByRole("row", { name: /^Total previsto/ })).toContainText("R$ 60,00");

    await page.getByRole("link", { name: "Custos", exact: true }).click();
    await expect(page.getByRole("row", { name: /Mercado — Assaí/ })).toContainText("R$ 60,00");
  });
});
