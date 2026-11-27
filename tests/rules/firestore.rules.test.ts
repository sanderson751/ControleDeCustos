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
  writeBatch,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const validCost = {
  userId: "ana",
  accountName: "Aluguel",
  amount: 1500,
  costType: "fixo",
  category: "moradia",
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
      { ...validCost, category: "viagem" },
      (({ category: _ignored, ...withoutCategory }) => withoutCategory)(validCost),
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

describe("users/{uid}/budgetLimits", () => {
  const validBudget = {
    userId: "ana",
    year: 2026,
    month: 3,
    category: "alimentacao",
    limit: 1200,
    createdAt: new Date(2026, 2, 1),
    updatedAt: new Date(2026, 2, 1),
  };
  const budgetPath = "users/ana/budgetLimits/2026-03-alimentacao";

  it("standard cria, altera o limite e remove o proprio orcamento", async () => {
    await assertSucceeds(setDoc(doc(as("ana"), budgetPath), validBudget));
    await assertSucceeds(
      updateDoc(doc(as("ana"), budgetPath), {
        limit: 1500,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDoc(doc(as("ana"), budgetPath)));
    await assertSucceeds(deleteDoc(doc(as("ana"), budgetPath)));
  });

  it("bloqueia orcamentos invalidos", async () => {
    const invalids = [
      { ...validBudget, limit: 0 },
      { ...validBudget, limit: "1200" },
      { ...validBudget, limit: 1000000001 },
      { ...validBudget, category: "viagem" },
      { ...validBudget, month: 13 },
      { ...validBudget, year: 1999 },
      { ...validBudget, userId: "gui" },
      { ...validBudget, month: 4 }, // id 2026-03 com dados de abril
    ];

    for (const data of invalids) {
      await assertFails(
        setDoc(doc(as("ana"), budgetPath), data),
      );
    }
  });

  it("nao permite trocar categoria/competencia de um orcamento existente", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), budgetPath), validBudget);
    });

    await assertFails(
      updateDoc(doc(as("ana"), budgetPath), { category: "lazer" }),
    );
    await assertFails(updateDoc(doc(as("ana"), budgetPath), { month: 4 }));
  });

  it("guest e outros usuarios nao gravam; somente o dono le", async () => {
    await assertFails(
      setDoc(doc(as("gui"), "users/gui/budgetLimits/2026-03-lazer"), {
        ...validBudget,
        userId: "gui",
        category: "lazer",
      }),
    );
    await assertFails(setDoc(doc(as("admin"), budgetPath), validBudget));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), budgetPath), validBudget);
    });
    await assertFails(getDoc(doc(as("admin"), budgetPath)));
    await assertFails(deleteDoc(doc(as("gui"), budgetPath)));
  });
});

describe("id deterministico de budgetLimits", () => {
  it("aceita meses de dois digitos e recusa id que nao corresponde aos dados", async () => {
    await assertSucceeds(
      setDoc(doc(as("ana"), "users/ana/budgetLimits/2026-11-lazer"), {
        userId: "ana",
        year: 2026,
        month: 11,
        category: "lazer",
        limit: 300,
      }),
    );
    await assertFails(
      setDoc(doc(as("ana"), "users/ana/budgetLimits/qualquer-id"), {
        userId: "ana",
        year: 2026,
        month: 11,
        category: "saude",
        limit: 300,
      }),
    );
  });
});

describe("lancamento legado sem categoria", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const { category: _ignored, ...legacy } = validCost;
      await setDoc(doc(context.firestore(), "users/ana/costEntries/legado"), legacy);
    });
  });

  it("pode ser lido e excluido; edicao exige informar a categoria", async () => {
    const ref = () => doc(as("ana"), "users/ana/costEntries/legado");

    await assertSucceeds(getDoc(ref()));
    await assertFails(updateDoc(ref(), { amount: 10 }));
    await assertSucceeds(
      updateDoc(ref(), { amount: 10, category: "lazer", updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(deleteDoc(ref()));
  });
});

describe("users/{uid}/recurringBudgets", () => {
  const base = {
    userId: "ana",
    year: 2026,
    month: 3,
    category: "alimentacao",
    limit: 1200,
  };
  const path = "users/ana/recurringBudgets/2026-03-alimentacao";

  it("standard cria vigencia, altera o limite e encerra com limite nulo", async () => {
    await assertSucceeds(setDoc(doc(as("ana"), path), base));
    await assertSucceeds(
      updateDoc(doc(as("ana"), path), { limit: 1500, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      setDoc(doc(as("ana"), "users/ana/recurringBudgets/2026-09-alimentacao"), {
        ...base,
        month: 9,
        limit: null,
      }),
    );
    await assertSucceeds(getDoc(doc(as("ana"), path)));
  });

  it("bloqueia vigencias invalidas ou com id divergente", async () => {
    for (const data of [
      { ...base, limit: 0 },
      { ...base, limit: "1200" },
      { ...base, category: "viagem" },
      { ...base, month: 4 },
      { ...base, userId: "gui" },
      (({ limit: _ignored, ...withoutLimit }) => withoutLimit)(base),
    ]) {
      await assertFails(setDoc(doc(as("ana"), path), data));
    }
  });

  it("nao permite mudar o inicio/categoria de uma vigencia existente", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), path), base);
    });

    await assertFails(updateDoc(doc(as("ana"), path), { month: 5 }));
    await assertFails(updateDoc(doc(as("ana"), path), { category: "lazer" }));
  });

  it("guest e outros usuarios nao gravam nem leem vigencias alheias", async () => {
    await assertFails(
      setDoc(doc(as("gui"), "users/gui/recurringBudgets/2026-03-lazer"), {
        ...base,
        userId: "gui",
        category: "lazer",
      }),
    );
    await assertFails(setDoc(doc(as("admin"), path), base));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), path), base);
    });
    await assertFails(getDoc(doc(as("admin"), path)));
    await assertSucceeds(getDoc(doc(as("ana"), path)));
  });
});

describe("recurringBudgets: encerramento por update e escrita de guest", () => {
  const anaPath = "users/ana/recurringBudgets/2026-03-alimentacao";
  const guiPath = "users/gui/recurringBudgets/2026-03-lazer";

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, anaPath), {
        userId: "ana", year: 2026, month: 3, category: "alimentacao", limit: 1200,
      });
      await setDoc(doc(db, guiPath), {
        userId: "gui", year: 2026, month: 3, category: "lazer", limit: 300,
      });
    });
  });

  it("dono encerra a vigencia do proprio mes com update para limite nulo", async () => {
    await assertSucceeds(
      updateDoc(doc(as("ana"), anaPath), { limit: null, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(deleteDoc(doc(as("ana"), anaPath)));
  });

  it("guest nao altera nem exclui as proprias vigencias", async () => {
    await assertFails(updateDoc(doc(as("gui"), guiPath), { limit: 500 }));
    await assertFails(deleteDoc(doc(as("gui"), guiPath)));
    await assertSucceeds(getDoc(doc(as("gui"), guiPath)));
  });
});

describe("consultas da evolucao mensal (in por ano)", () => {
  it("dono consulta custos e orcamentos por anos; outros usuarios nao", async () => {
    const { query, where } = await import("firebase/firestore");

    await assertSucceeds(
      getDocs(
        query(
          collection(as("ana"), "users/ana/costEntries"),
          where("competenceYear", "in", [2025, 2026]),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(
        query(collection(as("ana"), "users/ana/budgetLimits"), where("year", "in", [2026])),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(as("gui"), "users/ana/costEntries"),
          where("competenceYear", "in", [2026]),
        ),
      ),
    );
  });
});

describe("descricao do lancamento", () => {
  it("aceita descricao opcional ate 500 caracteres e recusa maior ou nao-texto", async () => {
    await assertSucceeds(
      setDoc(doc(as("ana"), "users/ana/costEntries/d1"), { ...validCost, description: "" }),
    );
    await assertSucceeds(
      setDoc(doc(as("ana"), "users/ana/costEntries/d2"), {
        ...validCost,
        description: "a".repeat(500),
      }),
    );
    await assertFails(
      setDoc(doc(as("ana"), "users/ana/costEntries/d3"), {
        ...validCost,
        description: "a".repeat(501),
      }),
    );
    await assertFails(
      setDoc(doc(as("ana"), "users/ana/costEntries/d4"), { ...validCost, description: 42 }),
    );
    // Legado sem o campo continua valido (validCost nao tem description).
    await assertSucceeds(setDoc(doc(as("ana"), "users/ana/costEntries/d5"), validCost));
  });
});

describe("edicao de lancamento legado sem descricao", () => {
  it("update incluindo categoria e descricao vazia e aceito; descricao longa e negada", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const { category: _ignored, ...legacy } = validCost;
      await setDoc(doc(context.firestore(), "users/ana/costEntries/sem-desc"), legacy);
    });
    const ref = doc(as("ana"), "users/ana/costEntries/sem-desc");

    await assertSucceeds(
      updateDoc(ref, { category: "outros", description: "", updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(ref, { description: "x".repeat(501) }));
  });
});

describe("users/{uid}/categories (categorias personalizadas)", () => {
  const category = {
    userId: "ana",
    name: "Pets",
    archived: false,
    createdAt: new Date(2026, 10, 1),
    updatedAt: new Date(2026, 10, 1),
  };
  const path = "users/ana/categories/petsId01";

  async function seedCategory(uid = "ana", id = "petsId01") {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `users/${uid}/categories/${id}`), {
        ...category,
        userId: uid,
      });
    });
  }

  it("standard cria, renomeia e arquiva; ninguem exclui", async () => {
    await assertSucceeds(setDoc(doc(as("ana"), path), category));
    await assertSucceeds(
      updateDoc(doc(as("ana"), path), { name: "Animais", updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      updateDoc(doc(as("ana"), path), { archived: true, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(getDocs(collection(as("ana"), "users/ana/categories")));
    await assertFails(deleteDoc(doc(as("ana"), path)));
  });

  it("bloqueia categorias invalidas e troca de dono", async () => {
    for (const data of [
      { ...category, name: "" },
      { ...category, name: "a".repeat(41) },
      { ...category, name: 42 },
      { ...category, archived: "nao" },
      { ...category, userId: "gui" },
      { ...category, name: "   " },
      { ...category, role: "admin" },
    ]) {
      await assertFails(setDoc(doc(as("ana"), path), data));
    }

    await seedCategory();
    await assertFails(updateDoc(doc(as("ana"), path), { userId: "gui" }));
  });

  it("guest nao grava e outros usuarios nao leem nem gravam", async () => {
    await assertFails(
      setDoc(doc(as("gui"), "users/gui/categories/x1"), { ...category, userId: "gui" }),
    );
    await seedCategory();
    await assertFails(getDoc(doc(as("gui"), path)));
    await assertFails(getDoc(doc(as("admin"), path)));
    await assertFails(setDoc(doc(as("gui"), "users/ana/categories/x2"), category));
  });

  it("lancamento e orcamentos aceitam categoria personalizada existente do proprio usuario", async () => {
    await seedCategory();
    await assertSucceeds(
      setDoc(doc(as("ana"), "users/ana/costEntries/p1"), { ...validCost, category: "petsId01" }),
    );
    await assertSucceeds(
      setDoc(doc(as("ana"), "users/ana/budgetLimits/2026-03-petsId01"), {
        userId: "ana",
        year: 2026,
        month: 3,
        category: "petsId01",
        limit: 300,
      }),
    );
    await assertSucceeds(
      setDoc(doc(as("ana"), "users/ana/recurringBudgets/2026-03-petsId01"), {
        userId: "ana",
        year: 2026,
        month: 3,
        category: "petsId01",
        limit: 300,
      }),
    );
  });

  it("recusa categoria inexistente ou pertencente a outro usuario", async () => {
    await seedCategory("gui", "daGui01");
    for (const categoryId of ["naoExiste", "daGui01", "com-hifen", ""]) {
      await assertFails(
        setDoc(doc(as("ana"), `users/ana/costEntries/x-${categoryId || "vazio"}`), {
          ...validCost,
          category: categoryId,
        }),
      );
    }
    await assertFails(
      setDoc(doc(as("ana"), "users/ana/budgetLimits/2026-03-naoExiste"), {
        userId: "ana",
        year: 2026,
        month: 3,
        category: "naoExiste",
        limit: 300,
      }),
    );
  });

  it("categoria arquivada continua valida para editar lancamentos existentes", async () => {
    await seedCategory();
    await assertSucceeds(
      updateDoc(doc(as("ana"), path), { archived: true, updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(
      setDoc(doc(as("ana"), "users/ana/costEntries/p2"), { ...validCost, category: "petsId01" }),
    );
  });
});

describe("batch de orcamentos com muitas categorias personalizadas", () => {
  const ids = Array.from({ length: 20 }, (_, index) => `cat${index}`);

  async function commitBudgets(categoryIds: string[]) {
    const db = as("ana");
    const batch = writeBatch(db);
    for (const id of categoryIds) {
      batch.set(doc(db, `users/ana/budgetLimits/2026-03-${id}`), {
        userId: "ana",
        year: 2026,
        month: 3,
        category: id,
        limit: 100,
      });
      batch.set(doc(db, `users/ana/recurringBudgets/2026-03-${id}`), {
        userId: "ana",
        year: 2026,
        month: 3,
        category: id,
        limit: 100,
      });
    }
    return batch.commit();
  }

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      for (const id of ids) {
        await setDoc(doc(context.firestore(), `users/ana/categories/${id}`), {
          userId: "ana",
          name: id,
          archived: false,
        });
      }
    });
  });

  it("lote com 10 personalizadas distintas (limite do budgetService) e aceito", async () => {
    await assertSucceeds(commitBudgets(ids.slice(0, 10)));
    await assertSucceeds(commitBudgets(ids.slice(10)));
  });

  it("documenta o limite: 20 personalizadas em um unico batch e negado", async () => {
    await assertFails(commitBudgets(ids));
  });
});

describe("importacao de extrato (lote de costEntries)", () => {
  it("lote com 10 categorias personalizadas distintas e aceito; guest e negado", async () => {
    const ids = Array.from({ length: 10 }, (_, index) => `imp${index}`);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      for (const id of ids) {
        await setDoc(doc(context.firestore(), `users/ana/categories/${id}`), {
          userId: "ana",
          name: id,
          archived: false,
        });
      }
    });

    const db = as("ana");
    const batch = writeBatch(db);
    ids.forEach((id, index) => {
      batch.set(doc(db, `users/ana/costEntries/imp-${index}`), {
        ...validCost,
        category: id,
        description: "Importado de extrato.csv",
      });
      batch.set(doc(db, `users/ana/costEntries/imp-padrao-${index}`), validCost);
    });
    await assertSucceeds(batch.commit());

    const guestDb = as("gui");
    const guestBatch = writeBatch(guestDb);
    guestBatch.set(doc(guestDb, "users/gui/costEntries/imp-g"), { ...validCost, userId: "gui" });
    await assertFails(guestBatch.commit());
  });
});

describe("users/{uid}/recurringCosts (lancamentos recorrentes)", () => {
  const recurring = {
    userId: "ana",
    accountName: "Aluguel",
    amount: 2000,
    costType: "fixo",
    category: "moradia",
    description: "",
    dayOfMonth: 5,
    startYear: 2026,
    startMonth: 9,
    active: true,
    lastGeneratedYear: null,
    lastGeneratedMonth: null,
  };
  const path = "users/ana/recurringCosts/r1";

  it("standard cria, atualiza cursor, pausa e exclui a propria recorrencia", async () => {
    await assertSucceeds(setDoc(doc(as("ana"), path), recurring));
    await assertSucceeds(
      updateDoc(doc(as("ana"), path), { lastGeneratedYear: 2026, lastGeneratedMonth: 11 }),
    );
    await assertSucceeds(updateDoc(doc(as("ana"), path), { active: false }));
    await assertSucceeds(getDoc(doc(as("ana"), path)));
    await assertSucceeds(deleteDoc(doc(as("ana"), path)));
  });

  it("bloqueia recorrencias invalidas, campos extras e troca de dono", async () => {
    for (const data of [
      { ...recurring, dayOfMonth: 29 },
      { ...recurring, dayOfMonth: 0 },
      { ...recurring, amount: 0 },
      { ...recurring, amount: "2000" },
      { ...recurring, costType: "outro" },
      { ...recurring, category: "naoExiste" },
      { ...recurring, accountName: "" },
      { ...recurring, startMonth: 13 },
      { ...recurring, active: "sim" },
      { ...recurring, lastGeneratedMonth: 13 },
      { ...recurring, description: "x".repeat(501) },
      { ...recurring, role: "admin" },
      { ...recurring, userId: "gui" },
    ]) {
      await assertFails(setDoc(doc(as("ana"), path), data));
    }

    await assertSucceeds(setDoc(doc(as("ana"), path), recurring));
    await assertFails(updateDoc(doc(as("ana"), path), { userId: "gui" }));
  });

  it("guest nao grava; outros usuarios nao leem", async () => {
    await assertFails(
      setDoc(doc(as("gui"), "users/gui/recurringCosts/g1"), { ...recurring, userId: "gui" }),
    );
    await assertSucceeds(setDoc(doc(as("ana"), path), recurring));
    await assertFails(getDoc(doc(as("admin"), path)));
    await assertFails(getDocs(collection(as("gui"), "users/ana/recurringCosts")));
  });

  it("lote de geracao: ocorrencia com recurringId + cursor; repetir regrava sem duplicar", async () => {
    await assertSucceeds(setDoc(doc(as("ana"), path), recurring));
    const occurrence = {
      ...validCost,
      accountName: "Aluguel",
      amount: 2000,
      recurringId: "r1",
      competenceYear: 2026,
      competenceMonth: 11,
    };

    const db = as("ana");
    const first = writeBatch(db);
    first.set(doc(db, "users/ana/costEntries/rec-r1-2026-11"), occurrence);
    first.update(doc(db, path), { lastGeneratedYear: 2026, lastGeneratedMonth: 11 });
    await assertSucceeds(first.commit());

    const again = writeBatch(db);
    again.set(doc(db, "users/ana/costEntries/rec-r1-2026-11"), occurrence);
    await assertSucceeds(again.commit());

    await assertFails(
      setDoc(doc(db, "users/ana/costEntries/x1"), { ...occurrence, recurringId: 42 }),
    );
    await assertFails(
      setDoc(doc(db, "users/ana/costEntries/x2"), { ...occurrence, recurringId: "r".repeat(41) }),
    );
  });
});

describe("recorrencias: cursor e vinculo do lancamento gerado", () => {
  const base = {
    userId: "ana",
    accountName: "Aluguel",
    amount: 2000,
    costType: "fixo",
    category: "moradia",
    description: "",
    dayOfMonth: 5,
    startYear: 2026,
    startMonth: 9,
    active: true,
  };

  it("cursor deve vir completo (ano e mes juntos)", async () => {
    const ref = doc(as("ana"), "users/ana/recurringCosts/c1");
    await assertSucceeds(setDoc(ref, { ...base, lastGeneratedYear: null, lastGeneratedMonth: null }));
    await assertSucceeds(updateDoc(ref, { lastGeneratedYear: 2026, lastGeneratedMonth: 11 }));
    await assertFails(updateDoc(ref, { lastGeneratedYear: null }));
    await assertFails(updateDoc(ref, { lastGeneratedMonth: null }));
    await assertFails(
      setDoc(doc(as("ana"), "users/ana/recurringCosts/c2"), {
        ...base,
        lastGeneratedYear: 2026,
        lastGeneratedMonth: null,
      }),
    );
  });

  it("recurringId so e aceito no id rec-<recorrencia>-<AAAA-MM>", async () => {
    const occurrence = { ...validCost, recurringId: "r1" };

    await assertSucceeds(setDoc(doc(as("ana"), "users/ana/costEntries/rec-r1-2026-11"), occurrence));
    await assertFails(setDoc(doc(as("ana"), "users/ana/costEntries/qualquer"), occurrence));
    await assertFails(setDoc(doc(as("ana"), "users/ana/costEntries/rec-r2-2026-11"), occurrence));
    await assertFails(
      setDoc(doc(as("ana"), "users/ana/costEntries/rec-r.1-2026-11"), { ...validCost, recurringId: "r.1" }),
    );
    // Lancamento comum sem recurringId segue livre.
    await assertSucceeds(setDoc(doc(as("ana"), "users/ana/costEntries/comum"), validCost));
  });
});
