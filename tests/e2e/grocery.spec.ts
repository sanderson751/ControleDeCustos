import { listDocuments, setDocument } from "./support/emulators";
import { expect, login, test } from "./support/app";

type StoredItem = { name: string; checked: boolean; order: number };

/** Itens gravados como mapa items.{itemId}, na ordem da lista. */
async function storedItems(path: string) {
  const [list] = await listDocuments(path);
  return Object.values(list.items as Record<string, StoredItem>)
    .sort((left, right) => left.order - right.order)
    .map((item) => [item.name, item.checked]);
}

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

test.describe("lista de mercado — variação, reposição e modo mercado", () => {
  test("variação de preço, sugestão de reposição e marcação sem sinal no modo mercado", async ({
    page,
    context,
    seedUser,
  }) => {
    // Ao voltar a conexao, o SDK reconecta com espera crescente (ate ~1 min).
    test.setTimeout(180_000);
    const user = await seedUser("standard");
    const day = 24 * 60 * 60 * 1000;
    const product = (name: string, data: Record<string, unknown>) => ({
      userId: user.uid,
      name,
      normalizedName: name.toLowerCase(),
      unit: "un",
      lastStore: "Assaí",
      aliases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    });
    await setDocument(`users/${user.uid}/groceryProducts/arroz`, product("Arroz 5kg", {
      lastUnitPrice: 28,
      previousUnitPrice: 25,
      lastPurchasedAt: new Date(Date.now() - 2 * day),
      purchaseCount: 2,
      avgIntervalDays: 30,
      intervalCount: 1,
    }));
    await setDocument(`users/${user.uid}/groceryProducts/leite`, product("Leite", {
      lastUnitPrice: 4.79,
      previousUnitPrice: 4.99,
      lastPurchasedAt: new Date(Date.now() - 9 * day),
      purchaseCount: 4,
      avgIntervalDays: 7,
      intervalCount: 3,
    }));
    await setDocument(`users/${user.uid}/groceryLists/l1`, {
      userId: user.uid,
      name: "Feira",
      status: "aberta",
      items: [{ id: "i1", productId: "arroz", name: "Arroz 5kg", quantity: 2, checked: false }],
      purchaseId: null,
      paidTotal: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await login(page, user);
    await page.getByRole("link", { name: "Mercado", exact: true }).click();
    await expect(page.getByRole("table", { name: "Histórico de preços" })).toContainText("+12%");
    await page.getByRole("link", { name: "Abrir lista" }).click();

    // Variação ao lado do previsto e sugestão de reposição do leite.
    await expect(page.getByRole("row", { name: /Arroz 5kg/ })).toContainText("+12%");
    const restock = page.getByRole("region", { name: "Talvez esteja acabando" });
    await expect(restock).toContainText("Leite");
    await restock.getByRole("button", { name: "Adicionar Leite à lista" }).click();
    await expect(page.getByRole("row", { name: /Leite/ })).toBeVisible();

    await page.getByRole("link", { name: "Modo mercado" }).click();
    const summary = page.getByRole("status", { name: "Resumo do carrinho" });
    await page.getByRole("checkbox", { name: /Arroz 5kg/ }).click();
    await expect(summary).toContainText("R$ 56,00");

    // Sem sinal no corredor: marca e sincroniza quando a conexão volta.
    await context.setOffline(true);
    await expect(page.getByText(/Sem conexão/)).toBeVisible();
    await page.getByRole("checkbox", { name: /Leite/ }).click();
    await expect(page.getByRole("checkbox", { name: /Leite/ })).toBeChecked();
    await expect(summary).toContainText("R$ 60,79");
    await context.setOffline(false);
    await expect(page.getByText(/Sem conexão/)).toHaveCount(0);

    await expect
      .poll(() => storedItems(`users/${user.uid}/groceryLists`), { timeout: 90_000 })
      .toEqual([
        ["Arroz 5kg", true],
        ["Leite", true],
      ]);
  });

  test("dois aparelhos marcando itens diferentes, um sem sinal: nenhuma marcação se perde", async ({
    browser,
    page,
    seedUser,
  }) => {
    test.setTimeout(180_000);
    const user = await seedUser("standard");
    const item = (productId: string, name: string, order: number) => ({
      productId, name, quantity: 1, checked: false, order,
    });
    await setDocument(`users/${user.uid}/groceryLists/l1`, {
      userId: user.uid,
      name: "Feira",
      status: "aberta",
      items: { i1: item("arroz", "Arroz 5kg", 0), i2: item("cafe", "Café", 1) },
      purchaseId: null,
      paidTotal: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Contexto novo nao herda o `use` da configuracao.
    const { baseURL, locale, timezoneId } = test.info().project.use;
    const other = await browser.newContext({ baseURL, locale, timezoneId });
    const otherPage = await other.newPage();
    try {
      for (const current of [page, otherPage]) {
        await login(current, user);
        await current.goto("/grocery/l1/shop");
        await expect(current.getByRole("checkbox", { name: /Café/ })).toBeVisible();
      }

      // Um aparelho sem sinal marca o arroz; o outro, online, marca o café.
      await page.context().setOffline(true);
      await page.getByRole("checkbox", { name: /Arroz 5kg/ }).click();
      await expect(page.getByRole("checkbox", { name: /Arroz 5kg/ })).toBeChecked();
      await otherPage.getByRole("checkbox", { name: /Café/ }).click();
      await expect
        .poll(() => storedItems(`users/${user.uid}/groceryLists`), { timeout: 30_000 })
        .toEqual([["Arroz 5kg", false], ["Café", true]]);

      // A conexão volta: a marcação feita sem sinal se soma, sem desfazer a outra.
      await page.context().setOffline(false);
      await expect
        .poll(() => storedItems(`users/${user.uid}/groceryLists`), { timeout: 90_000 })
        .toEqual([["Arroz 5kg", true], ["Café", true]]);
      await expect(otherPage.getByRole("checkbox", { name: /Arroz 5kg/ })).toBeChecked({ timeout: 30_000 });
      await expect(page.getByRole("checkbox", { name: /Café/ })).toBeChecked({ timeout: 30_000 });
    } finally {
      await other.close();
    }
  });
});
