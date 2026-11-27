import { expect, login, test } from "./support/app";

test.describe("autenticação", () => {
  test("visitante em rota protegida vai para o login", async ({ page, seedUser }) => {
    await seedUser("standard");
    await page.goto("/costs");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("cadastro cria conta e abre o Início; sair volta ao login", async ({ page, seedUser }) => {
    await seedUser("admin");
    await page.goto("/login");
    await page.getByRole("button", { name: "Quero criar conta" }).click();
    await page.getByLabel("Nome").fill("Marina Souza");
    await page.getByLabel("Email").fill(`marina.${Date.now()}@exemplo.com`);
    await page.getByLabel("Senha").fill("senha-segura-123");
    await page.locator('form button[type="submit"]').click();

    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByRole("heading", { name: /Olá, Marina/ })).toBeVisible();
    // Conta nova nasce standard: sem gestão de usuários.
    await expect(page.getByRole("link", { name: "Perfis de usuários", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Menu do usuário" }).click();
    await page.getByRole("menuitem", { name: "Sair do sistema" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("login com senha errada mostra erro e não entra", async ({ page, seedUser }) => {
    const user = await seedUser("standard");
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Senha").fill("senha-errada");
    await page.locator('form button[type="submit"]').click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/senha|credenciais|inválid/i).first()).toBeVisible();
  });

  test("login de conta existente", async ({ page, seedUser }) => {
    const user = await seedUser("admin", "Carla Admin");
    await login(page, user);
    await expect(page.getByRole("heading", { name: /Olá, Carla/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Perfis de usuários", exact: true })).toBeVisible();
  });
});
