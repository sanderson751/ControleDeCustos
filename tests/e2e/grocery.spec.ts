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

test.describe("lista de mercado — foto da comanda (OCR real no navegador)", () => {
  test("lê a comanda, preenche total e preços e registra a chave da compra", async ({ page, browser, seedUser }) => {
    test.setTimeout(240_000);
    const user = await seedUser("standard");
    await login(page, user);
    await page.getByRole("link", { name: "Mercado", exact: true }).click();
    await page.getByLabel("Nome da lista").fill("Compra com foto");
    await page.getByRole("button", { name: "Criar lista" }).click();

    const addForm = page.getByRole("form", { name: "Adicionar item" });
    for (const [name, quantity] of [["Arroz 5kg", "2"], ["Café Pilão 500g", "1"]] as const) {
      await addForm.getByLabel("Produto").fill(name);
      await addForm.getByLabel("Quantidade").fill(quantity);
      await addForm.getByRole("button", { name: "Adicionar" }).click();
      await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
    }

    // "Foto" da comanda: cupom renderizado e capturado como imagem.
    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const receiptPage = await browser.newPage({ viewport: { width: 900, height: 600 } });
    await receiptPage.setContent(`
      <body style="margin:0;background:#fff">
        <pre style="font: 26px/1.5 'Courier New', monospace; color:#000; padding:40px; margin:0">MERCADO TESTE
CNPJ: 12.345.678/0001-90
001 7896006716112 ARROZ 5KG 2 UN X 25,90 51,80
002 7891910000197 CAFE PILAO 500G 1 UN X 8,20 8,20
VALOR A PAGAR R$ 60,00
Emissao ${today} 10:00:00</pre>
      </body>`);
    const photo = await receiptPage.screenshot({ fullPage: true });
    await receiptPage.close();

    await page.getByRole("button", { name: "Concluir compra" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#receipt-photo").setInputFiles({ name: "comanda.png", mimeType: "image/png", buffer: photo });

    await expect(page.getByText(/Comanda lida: 2 itens/)).toBeVisible({ timeout: 180_000 });
    await expect(dialog.getByLabel("Total pago")).toHaveValue("R$ 60,00");
    await expect(dialog.getByLabel("Preço pago de Arroz 5kg")).toHaveValue("R$ 25,90");
    await expect(dialog.getByLabel("Preço pago de Café Pilão 500g")).toHaveValue("R$ 8,20");

    await dialog.getByRole("button", { name: "Concluir e lançar" }).click();
    await expect(page.getByText(/Compra concluída: R\$ 60,00 lançados em Alimentação/)).toBeVisible();

    const [purchase] = await listDocuments(`users/${user.uid}/groceryPurchases`);
    // Chave: CNPJ do emissor (ou nome da loja, se o OCR nao ler o CNPJ) + dia + total.
    expect(String(purchase.receiptKey)).toMatch(/^h-[a-z0-9]+-\d{8}-6000$/);
    const [receiptKey] = await listDocuments(`users/${user.uid}/groceryReceiptKeys`);
    expect(receiptKey).toMatchObject({ purchaseId: expect.any(String), total: 60 });
    expect(Number(purchase.ocrConfidence)).toBeGreaterThan(50);
  });
});
