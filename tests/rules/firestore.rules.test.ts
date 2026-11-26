import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const validCost = {
  userId: "ana",
  accountName: "Aluguel",
  amount: 1500,
  costType: "fixo",
  installmentsTotal: 1,
  competenceYear: 2026,
  competenceMonth: 11,
  createdAt: new Date(2026, 10, 1),
  updatedAt: new Date(2026, 10, 1),
};

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users/admin"), {
      uid: "admin",
      displayName: "Admin",
      role: "admin",
    });
    await setDoc(doc(db, "users/ana"), {
      uid: "ana",
      displayName: "Ana",
      role: "standard",
      createdAt: new Date(2026, 0, 1),
    });
    await setDoc(doc(db, "users/gui"), {
      uid: "gui",
      displayName: "Gui",
      role: "guest",
    });
    await setDoc(doc(db, "users/legado"), {
      uid: "legado",
      displayName: "Sem papel",
    });
    await setDoc(doc(db, "users/ana/costEntries/c1"), validCost);
    await setDoc(doc(db, "users/gui/costEntries/g1"), {
      ...validCost,
      userId: "gui",
    });
  });
}

const as = (uid: string) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-controle-de-custos",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe("users/{uid}", () => {
  it("visitante nao le nenhum perfil", async () => {
    await assertFails(
      getDoc(doc(testEnv.unauthenticatedContext().firestore(), "users/ana")),
    );
  });

  it("usuario le o proprio perfil mas nao o de outros", async () => {
    await assertSucceeds(getDoc(doc(as("ana"), "users/ana")));
    await assertFails(getDoc(doc(as("ana"), "users/gui")));
  });

  it("somente admin lista e le perfis de outros usuarios", async () => {
    await assertSucceeds(getDocs(collection(as("admin"), "users")));
    await assertSucceeds(getDoc(doc(as("admin"), "users/ana")));
    await assertFails(getDocs(collection(as("ana"), "users")));
  });

  it("novo usuario cria o proprio perfil apenas com papel standard", async () => {
    await assertSucceeds(
      setDoc(doc(as("novo"), "users/novo"), { uid: "novo", role: "standard" }),
    );
    await assertFails(
      setDoc(doc(as("hacker"), "users/hacker"), {
        uid: "hacker",
        role: "admin",
      }),
    );
    await assertFails(
      setDoc(doc(as("novo2"), "users/outro"), {
        uid: "outro",
        role: "standard",
      }),
    );
  });

  it("usuario atualiza dados de login mas nao o proprio papel nem createdAt", async () => {
    await assertSucceeds(
      updateDoc(doc(as("ana"), "users/ana"), {
        displayName: "Ana Lima",
        status: "online",
        lastLoginAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(as("ana"), "users/ana"), { role: "admin" }));
    await assertFails(
      updateDoc(doc(as("ana"), "users/ana"), { createdAt: new Date() }),
    );
    await assertFails(
      updateDoc(doc(as("gui"), "users/gui"), { role: "standard" }),
    );
  });

  it("admin altera nome e papel de outro usuario, com papel valido", async () => {
    await assertSucceeds(
      updateDoc(doc(as("admin"), "users/ana"), {
        displayName: "Ana",
        role: "guest",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as("admin"), "users/ana"), { role: "superuser" }),
    );
    await assertFails(
      updateDoc(doc(as("admin"), "users/ana"), { email: "x@y.com" }),
    );
  });

  it("admin nao altera o proprio papel e ninguem exclui perfis", async () => {
    await assertFails(
      updateDoc(doc(as("admin"), "users/admin"), { role: "standard" }),
    );
    await assertFails(deleteDoc(doc(as("admin"), "users/ana")));
    await assertFails(deleteDoc(doc(as("ana"), "users/ana")));
  });
});

describe("users/{uid}/settings", () => {
  it("cada usuario (inclusive guest) le e grava apenas as proprias preferencias", async () => {
    await assertSucceeds(
      setDoc(doc(as("gui"), "users/gui/settings/profile"), {
        ui: { theme: "light" },
      }),
    );
    await assertFails(
      setDoc(doc(as("gui"), "users/ana/settings/profile"), {
        ui: { theme: "light" },
      }),
    );
    await assertFails(getDoc(doc(as("admin"), "users/ana/settings/profile")));
  });
});

describe("users/{uid}/costEntries", () => {
  it("dono le os proprios custos; outros (inclusive admin) nao", async () => {
    await assertSucceeds(getDocs(collection(as("ana"), "users/ana/costEntries")));
    await assertFails(getDocs(collection(as("gui"), "users/ana/costEntries")));
    await assertFails(
      getDocs(collection(as("admin"), "users/ana/costEntries")),
    );
  });

  it("standard cria custo valido no proprio espaco", async () => {
    await assertSucceeds(
      setDoc(doc(as("ana"), "users/ana/costEntries/novo"), validCost),
    );
  });

  it("usuario legado sem papel e tratado como standard", async () => {
    await assertSucceeds(
      setDoc(doc(as("legado"), "users/legado/costEntries/novo"), {
        ...validCost,
        userId: "legado",
      }),
    );
  });

  it("bloqueia custos invalidos", async () => {
    const invalids = [
      { ...validCost, amount: 0 },
      { ...validCost, amount: "100" },
      { ...validCost, accountName: "" },
      { ...validCost, costType: "outro" },
      { ...validCost, installmentsTotal: 0 },
      { ...validCost, installmentsTotal: 121 },
      { ...validCost, competenceMonth: 13 },
      { ...validCost, userId: "gui" },
    ];

    for (const [index, data] of invalids.entries()) {
      await assertFails(
        setDoc(doc(as("ana"), `users/ana/costEntries/invalido-${index}`), data),
      );
    }
  });

  it("guest nao cria, edita nem exclui custos", async () => {
    await assertFails(
      setDoc(doc(as("gui"), "users/gui/costEntries/novo"), {
        ...validCost,
        userId: "gui",
      }),
    );
    await assertFails(
      updateDoc(doc(as("gui"), "users/gui/costEntries/g1"), { amount: 10 }),
    );
    await assertFails(deleteDoc(doc(as("gui"), "users/gui/costEntries/g1")));
    await assertSucceeds(getDoc(doc(as("gui"), "users/gui/costEntries/g1")));
  });

  it("standard edita e exclui os proprios custos sem trocar o dono", async () => {
    await assertSucceeds(
      updateDoc(doc(as("ana"), "users/ana/costEntries/c1"), {
        accountName: "Aluguel novo",
        amount: 1600,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as("ana"), "users/ana/costEntries/c1"), { userId: "gui" }),
    );
    await assertSucceeds(deleteDoc(doc(as("ana"), "users/ana/costEntries/c1")));
  });

  it("ninguem grava custos no espaco de outro usuario", async () => {
    await assertFails(
      setDoc(doc(as("admin"), "users/ana/costEntries/intruso"), validCost),
    );
    await assertFails(deleteDoc(doc(as("admin"), "users/ana/costEntries/c1")));
  });
});
