import { listDocuments, openVerificationLink, setDocument } from "./support/emulators";
import { expect, login, test } from "./support/app";

test.describe("lista de mercado compartilhada", () => {
  test("dono convida por e-mail; convidada confirma o e-mail, aceita e monta a lista junto; dono remove", async ({
    browser,
    page,
    seedUser,
  }) => {
    test.setTimeout(180_000);
    const ana = await seedUser("standard", "Ana");
    const bia = await seedUser("standard", "Bia");
    await setDocument(`users/${ana.uid}/groceryProducts/arroz`, {
      userId: ana.uid,
      name: "Arroz 5kg",
      normalizedName: "arroz 5kg",
      unit: "un",
      lastUnitPrice: 25.9,
      previousUnitPrice: null,
      lastPurchasedAt: new Date(),
      lastStore: "Assaí",
      purchaseCount: 1,
      avgIntervalDays: null,
      intervalCount: 0,
      aliases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDocument(`users/${ana.uid}/groceryLists/l1`, {
      userId: ana.uid,
      name: "Feira",
      status: "aberta",
      items: { i1: { productId: "arroz", name: "Arroz 5kg", quantity: 2, checked: false, order: 0 } },
      purchaseId: null,
      paidTotal: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Ana convida a Bia.
    await login(page, ana);
    await page.goto("/grocery/l1");
    await page.getByRole("button", { name: "Compartilhar" }).click();
    const share = page.getByRole("dialog", { name: "Compartilhar lista" });
    await share.getByLabel("E-mail").fill(bia.email.toUpperCase());
    await share.getByRole("button", { name: "Convidar" }).click();
    await expect(page.getByText(`Convite criado para ${bia.email}`)).toBeVisible();
    await expect(share.getByText(bia.email)).toBeVisible();
    await page.keyboard.press("Escape");

    const { baseURL, locale, timezoneId } = test.info().project.use;
    const other = await browser.newContext({ baseURL, locale, timezoneId });
    const biaPage = await other.newPage();
    try {
      // Bia entra, confirma o e-mail e ve o convite.
      await login(biaPage, bia);
      await biaPage.goto("/grocery/convites");
      await expect(biaPage).toHaveURL(/\/grocery$/);
      const verify = biaPage.getByRole("region", { name: "Confirme seu e-mail para receber convites" });
      await verify.getByRole("button", { name: "Enviar e-mail de confirmação" }).click();
      await expect(biaPage.getByText(`Enviamos o link de confirmação para ${bia.email}.`)).toBeVisible();
      await openVerificationLink(bia.email);
      await verify.getByRole("button", { name: "Já confirmei" }).click();

      const invites = biaPage.getByRole("region", { name: "Convites para listas" });
      await expect(invites).toContainText(`Ana (${ana.email}) convidou você para a lista "Feira"`);
      await invites.getByRole("button", { name: "Aceitar convite para Feira" }).click();

      // Lista da Ana, com a previsão pelos preços dela.
      await expect(biaPage).toHaveURL(new RegExp(`/grocery/compartilhada/${ana.uid}/l1$`));
      await expect(biaPage.getByText("Lista de Ana")).toBeVisible();
      await expect(biaPage.getByRole("row", { name: /Arroz 5kg/ })).toContainText("R$ 51,80");
      await expect(biaPage.getByRole("button", { name: "Concluir compra" })).toHaveCount(0);

      // Bia inclui um produto novo e marca o arroz.
      const addForm = biaPage.getByRole("form", { name: "Adicionar item" });
      await addForm.getByLabel("Produto").fill("Leite");
      await addForm.getByLabel("Quantidade").fill("6");
      await addForm.getByRole("button", { name: "Adicionar" }).click();
      await expect(biaPage.getByRole("row", { name: /Leite/ })).toBeVisible();
      await biaPage.getByRole("checkbox", { name: "Arroz 5kg no carrinho" }).click();

      // Ana vê na hora.
      await expect(page.getByRole("row", { name: /Leite/ })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("checkbox", { name: "Arroz 5kg no carrinho" })).toBeChecked({ timeout: 30_000 });
      const [product] = (await listDocuments(`users/${ana.uid}/groceryProducts`)).filter((item) => item.name === "Leite");
      expect(product).toMatchObject({ userId: ana.uid, lastUnitPrice: null, purchaseCount: 0 });

      // Ana remove a Bia: o acesso acaba.
      await page.getByRole("button", { name: "Compartilhada (1)" }).click();
      await page.getByRole("dialog", { name: "Compartilhar lista" }).getByRole("button", { name: "Remover Bia da lista" }).click();
      await expect(page.getByText("Bia não participa mais da lista.")).toBeVisible();
      await expect(biaPage.getByRole("alert")).toContainText(/permissão|acesso|participa/i, { timeout: 30_000 });

      await biaPage.goto("/grocery");
      await expect(biaPage.getByRole("heading", { name: "Compartilhadas comigo" })).toHaveCount(0);
    } finally {
      await other.close();
    }
  });
});
