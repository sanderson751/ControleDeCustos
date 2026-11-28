/**
 * Acesso direto aos emuladores para preparar cenarios (sem passar pelas regras).
 * O Firestore aceita "Authorization: Bearer owner" como administrador.
 */
const PROJECT = "demo-controle-de-custos";
const AUTH = "http://127.0.0.1:9099";
const FIRESTORE = "http://127.0.0.1:8080";
const DOCUMENTS = `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };

export type Role = "admin" | "standard" | "guest";

export type TestUser = {
  uid: string;
  email: string;
  password: string;
  name: string;
};

async function check(response: Response, action: string) {
  if (!response.ok) {
    throw new Error(`${action}: ${response.status} ${await response.text()}`);
  }
  return response;
}

/** Limpa contas do Auth e todos os documentos do Firestore. */
export async function resetEmulators() {
  await check(
    await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {
      method: "DELETE",
    }),
    "limpar Firestore",
  );
  await check(
    await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" }),
    "limpar Auth",
  );
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function toValue(value: unknown): FirestoreValue {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value as object).map(([key, item]) => [key, toValue(item)])),
      },
    };
  }
  return { stringValue: String(value) };
}

/** Valor do REST do Firestore => JS (inteiros como number; listas e mapas recursivos). */
function fromValue(value: Record<string, unknown>): unknown {
  const [type, raw] = Object.entries(value)[0];
  if (type === "integerValue") return Number(raw);
  if (type === "arrayValue") {
    return ((raw as { values?: Array<Record<string, unknown>> }).values ?? []).map(fromValue);
  }
  if (type === "mapValue") {
    return Object.fromEntries(
      Object.entries((raw as { fields?: Record<string, Record<string, unknown>> }).fields ?? {}).map(
        ([key, item]) => [key, fromValue(item)],
      ),
    );
  }
  return raw;
}

/** Grava (cria ou substitui) um documento como administrador. */
export async function setDocument(path: string, data: Record<string, unknown>) {
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toValue(value)]));
  await check(
    await fetch(`${DOCUMENTS}/${path}`, {
      method: "PATCH",
      headers: OWNER,
      body: JSON.stringify({ fields }),
    }),
    `gravar ${path}`,
  );
}

/** Lista os documentos de uma colecao como administrador (campos simplificados). */
export async function listDocuments(path: string): Promise<Array<Record<string, unknown>>> {
  const response = await check(await fetch(`${DOCUMENTS}/${path}`, { headers: OWNER }), `listar ${path}`);
  const body = (await response.json()) as {
    documents?: Array<{ name: string; fields?: Record<string, Record<string, unknown>> }>;
  };

  return (body.documents ?? []).map((document) => ({
    id: document.name.split("/").pop(),
    ...Object.fromEntries(Object.entries(document.fields ?? {}).map(([key, value]) => [key, fromValue(value)])),
  }));
}

let counter = 0;

/**
 * Cria a conta no emulador de Auth e o perfil com o papel desejado
 * (o primeiro login apenas atualiza os dados, sem trocar o papel).
 */
export async function createUser(role: Role, name = `Teste ${role}`): Promise<TestUser> {
  counter += 1;
  const email = `${role}.${Date.now()}.${counter}@exemplo.com`;
  const password = "senha-segura-123";
  const response = await check(
    await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName: name, returnSecureToken: true }),
    }),
    "criar conta",
  );
  const { localId: uid } = (await response.json()) as { localId: string };

  await setDocument(`users/${uid}`, {
    uid,
    email,
    emailNormalized: email,
    displayName: name,
    photoURL: "",
    provider: "password",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { uid, email, password, name };
}

/** Abre o link de confirmação de e-mail mais recente enviado para `email` (emulador de Auth). */
export async function openVerificationLink(email: string) {
  const response = await check(
    await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/oobCodes`),
    "listar e-mails do Auth",
  );
  const { oobCodes = [] } = (await response.json()) as {
    oobCodes?: Array<{ email: string; requestType: string; oobLink: string }>;
  };
  const link = oobCodes.filter((code) => code.email === email && code.requestType === "VERIFY_EMAIL").pop();
  if (!link) throw new Error(`nenhum e-mail de confirmação para ${email}`);
  await check(await fetch(link.oobLink), "confirmar e-mail");
}
