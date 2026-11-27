import { expect, type Page, test as base } from "@playwright/test";
import { createUser, resetEmulators, type Role, setDocument, type TestUser } from "./emulators";

/** Cada teste comeca com os emuladores vazios. */
export const test = base.extend<{ seedUser: (role: Role, name?: string) => Promise<TestUser> }>({
  // eslint-disable-next-line no-empty-pattern
  seedUser: async ({}, provide) => {
    await resetEmulators();
    await provide((role, name) => createUser(role, name));
  },
});

export { expect };

export async function login(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.locator('form button[type="submit"]').click();
  // Primeira navegacao da execucao: o servidor de dev compila as telas sob demanda.
  await expect(page).toHaveURL(/\/home/, { timeout: 30_000 });
  await expect(page.getByText("Atualizando lançamentos recorrentes...")).toHaveCount(0);
}

/** Digita um valor em campo com mascara de moeda ("15990" => R$ 159,90). */
export async function typeCurrency(page: Page, label: string | RegExp, digits: string) {
  const input = page.getByLabel(label, { exact: typeof label === "string" });
  await input.fill("");
  await input.pressSequentially(digits);
}

export function today() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/** dd/mm/aaaa de um dia do mes atual (dia 1 nunca esta no futuro). */
export function brDate(day = 1) {
  const { year, month } = today();
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** Lancamento gravado direto no emulador (cenarios que partem de dados existentes). */
export async function seedCost(
  user: TestUser,
  id: string,
  data: { accountName: string; amount: number; category: string; costType?: "fixo" | "variavel" },
) {
  const { year, month } = today();
  const createdAt = new Date();
  await setDocument(`users/${user.uid}/costEntries/${id}`, {
    userId: user.uid,
    accountName: data.accountName,
    amount: data.amount,
    costType: data.costType ?? "variavel",
    category: data.category,
    description: "",
    installmentsTotal: 1,
    competenceYear: year,
    competenceMonth: month,
    createdAt,
    updatedAt: createdAt,
  });
}
