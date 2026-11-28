import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  FieldPath,
  type Firestore,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

/**
 * Lista de mercado compartilhada: convites (groceryInvites), participantes
 * (memberIds), acesso ao catalogo do dono (groceryMembers).
 */
let testEnv: RulesTestEnvironment;

const EMAILS: Record<string, string> = {
  ana: "ana@exemplo.com",
  bia: "bia@exemplo.com",
  caio: "caio@exemplo.com",
  gui: "gui@exemplo.com",
};

/** Usuario logado; `verified` simula o e-mail confirmado no token. */
const as = (uid: string, verified = true): Firestore =>
  testEnv
    .authenticatedContext(uid, { email: EMAILS[uid], email_verified: verified })
    .firestore() as unknown as Firestore;

const LIST = {
  userId: "ana",
  name: "Feira",
  status: "aberta",
  items: { i1: { productId: "p1", name: "Arroz", quantity: 2, checked: false, order: 0 } },
  purchaseId: null,
  paidTotal: null,
  completedAt: null,
};

const PRODUCT = {
  userId: "ana",
  name: "Arroz",
  normalizedName: "arroz",
  unit: "un",
  lastUnitPrice: 25.9,
  previousUnitPrice: null,
  lastPurchasedAt: null,
  lastStore: "Assaí",
  purchaseCount: 1,
  avgIntervalDays: null,
  intervalCount: 0,
  aliases: [],
};

const NEW_PRODUCT = {
  userId: "ana",
  name: "Leite",
  normalizedName: "leite",
  unit: "un",
  lastUnitPrice: null,
  previousUnitPrice: null,
  lastPurchasedAt: null,
  lastStore: "",
  purchaseCount: 0,
  avgIntervalDays: null,
  intervalCount: 0,
  aliases: [],
};

const inviteId = (uid: string) => `ana_l1_${EMAILS[uid]}`;

const invite = (uid: string) => ({
  ownerId: "ana",
  ownerName: "Ana",
  ownerEmail: EMAILS.ana,
  listId: "l1",
  listName: "Feira",
  email: EMAILS[uid],
  status: "pendente",
  memberUid: null,
  createdAt: serverTimestamp(),
  respondedAt: null,
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-controle-de-custos-share",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [uid, role] of [["ana", "standard"], ["bia", "standard"], ["caio", "standard"], ["gui", "guest"]]) {
      await setDoc(doc(db, `users/${uid}`), { uid, displayName: uid, role });
    }
    await setDoc(doc(db, "users/ana/groceryLists/l1"), { ...LIST, createdAt: new Date(), updatedAt: new Date() });
    await setDoc(doc(db, "users/ana/groceryProducts/p1"), { ...PRODUCT, createdAt: new Date(), updatedAt: new Date() });
  });
});

async function createInvite(uid: string) {
  await assertSucceeds(setDoc(doc(as("ana"), `groceryInvites/${inviteId(uid)}`), invite(uid)));
}

/** Mesmo lote do app (acceptInvite). */
function accept(uid: string, options: { verified?: boolean; inviteOf?: string } = {}) {
  const db = as(uid, options.verified ?? true);
  const batch = writeBatch(db);
  batch.update(doc(db, `groceryInvites/${inviteId(options.inviteOf ?? uid)}`), {
    status: "aceito",
    memberUid: uid,
    respondedAt: serverTimestamp(),
  });
  batch.update(
    doc(db, "users/ana/groceryLists/l1"),
    new FieldPath("memberIds"),
    arrayUnion(uid),
    new FieldPath("members", uid),
    { name: uid, email: EMAILS[uid] },
    new FieldPath("updatedAt"),
    serverTimestamp(),
  );
  batch.set(doc(db, `users/ana/groceryMembers/${uid}`), {
    ownerId: "ana",
    memberUid: uid,
    email: EMAILS[uid],
    name: uid,
    listId: "l1",
    createdAt: serverTimestamp(),
  });
  return batch.commit();
}

function leave(uid: string, by = uid) {
  const db = as(by);
  const batch = writeBatch(db);
  batch.update(
    doc(db, "users/ana/groceryLists/l1"),
    new FieldPath("memberIds"),
    arrayRemove(uid),
    new FieldPath("members", uid),
    deleteField(),
    new FieldPath("updatedAt"),
    serverTimestamp(),
  );
  batch.delete(doc(db, `groceryInvites/${inviteId(uid)}`));
  batch.delete(doc(db, `users/ana/groceryMembers/${uid}`));
  return batch.commit();
}

describe("convites (groceryInvites)", () => {
  it("dono convida um e-mail para a propria lista aberta", async () => {
    await createInvite("bia");
    // Mesmo e-mail de novo e uma atualizacao: negada (sem duplicar).
    await assertFails(setDoc(doc(as("ana"), `groceryInvites/${inviteId("bia")}`), invite("bia")));
  });

  it("bloqueia convite invalido", async () => {
    const db = as("ana");
    for (const [id, data] of [
      ["ana_l1_caio@exemplo.com", { ...invite("caio"), email: "CAIO@exemplo.com" }],
      ["ana_l1_x@exemplo.com", invite("caio")],
      // Sem o dono no id (outra pessoa poderia ocupar o id do convite).
      ["l1_caio@exemplo.com", invite("caio")],
      [inviteId("ana"), invite("ana")],
      ["ana_l1_caio@exemplo.com", { ...invite("caio"), status: "aceito" }],
      ["ana_l1_caio@exemplo.com", { ...invite("caio"), ownerId: "bia" }],
      // E-mail de quem convida tem de ser o do login.
      ["ana_l1_caio@exemplo.com", { ...invite("caio"), ownerEmail: "outra@exemplo.com" }],
      ["ana_l1_caio@exemplo.com", { ...invite("caio"), extra: 1 }],
      ["ana_l9_caio@exemplo.com", { ...invite("caio"), listId: "l9" }],
    ] as const) {
      await assertFails(setDoc(doc(db, `groceryInvites/${id}`), data));
    }
    // Convidar para a lista de outra pessoa.
    await assertFails(
      setDoc(doc(as("bia"), "groceryInvites/bia_l1_caio@exemplo.com"), {
        ...invite("caio"),
        ownerId: "bia",
        ownerEmail: EMAILS.bia,
      }),
    );
  });

  it("lista concluida nao recebe convite", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "users/ana/groceryLists/l1"), { status: "concluida" });
    });
    await assertFails(setDoc(doc(as("ana"), `groceryInvites/${inviteId("bia")}`), invite("bia")));
  });

  it("so o dono e a pessoa convidada, com e-mail confirmado, leem o convite", async () => {
    await createInvite("bia");
    await assertSucceeds(getDoc(doc(as("ana"), `groceryInvites/${inviteId("bia")}`)));
    await assertSucceeds(getDoc(doc(as("bia"), `groceryInvites/${inviteId("bia")}`)));
    await assertFails(getDoc(doc(as("bia", false), `groceryInvites/${inviteId("bia")}`)));
    await assertFails(getDoc(doc(as("caio"), `groceryInvites/${inviteId("bia")}`)));

    await assertSucceeds(
      getDocs(query(collection(as("bia"), "groceryInvites"), where("email", "==", EMAILS.bia), where("status", "==", "pendente"))),
    );
    await assertFails(getDocs(query(collection(as("caio"), "groceryInvites"), where("email", "==", EMAILS.bia))));
    await assertSucceeds(
      getDocs(query(collection(as("ana"), "groceryInvites"), where("ownerId", "==", "ana"), where("listId", "==", "l1"))),
    );
  });

  it("convidada recusa; dono cancela", async () => {
    await createInvite("bia");
    await assertFails(updateDoc(doc(as("bia", false), `groceryInvites/${inviteId("bia")}`), { status: "recusado", respondedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as("bia"), `groceryInvites/${inviteId("bia")}`), { status: "recusado", respondedAt: serverTimestamp() }));
    // Respondido nao volta a pendente pela convidada.
    await assertFails(updateDoc(doc(as("bia"), `groceryInvites/${inviteId("bia")}`), { status: "pendente" }));
    await assertSucceeds(deleteDoc(doc(as("ana"), `groceryInvites/${inviteId("bia")}`)));
  });
});

describe("participar da lista", () => {
  it("aceitar entra na lista: participante le lista e catalogo e altera so os itens", async () => {
    await createInvite("bia");
    await assertSucceeds(accept("bia"));

    const bia = as("bia");
    await assertSucceeds(getDoc(doc(bia, "users/ana/groceryLists/l1")));
    const shared = await assertSucceeds(
      getDocs(query(collectionGroup(bia, "groceryLists"), where("memberIds", "array-contains", "bia"))),
    );
    expect(shared.docs.map((item) => item.id)).toEqual(["l1"]);
    await assertSucceeds(getDocs(collection(bia, "users/ana/groceryProducts")));

    // Itens: incluir e marcar.
    await assertSucceeds(updateDoc(doc(bia, "users/ana/groceryLists/l1"), "items.i1.checked", true, "updatedAt", serverTimestamp()));
    await assertSucceeds(
      updateDoc(doc(bia, "users/ana/groceryLists/l1"), "items.i2", { productId: "p2", name: "Leite", quantity: 1, checked: false, order: 9 }, "updatedAt", serverTimestamp()),
    );
    // Produto novo so sem preco.
    await assertSucceeds(
      setDoc(doc(bia, "users/ana/groceryProducts/p2"), { ...NEW_PRODUCT, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
    await assertFails(
      setDoc(doc(bia, "users/ana/groceryProducts/p3"), {
        ...NEW_PRODUCT,
        lastUnitPrice: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(updateDoc(doc(bia, "users/ana/groceryProducts/p1"), { lastUnitPrice: 1 }));

    // Nome, conclusao, exclusao e outros participantes sao do dono.
    await assertFails(updateDoc(doc(bia, "users/ana/groceryLists/l1"), { name: "Outra" }));
    await assertFails(updateDoc(doc(bia, "users/ana/groceryLists/l1"), { status: "concluida" }));
    await assertFails(updateDoc(doc(bia, "users/ana/groceryLists/l1"), { memberIds: ["bia", "caio"] }));
    await assertFails(deleteDoc(doc(bia, "users/ana/groceryLists/l1")));
    await assertFails(getDocs(collection(bia, "users/ana/groceryLists")));
    await assertFails(getDocs(collection(bia, "users/ana/costEntries")));
    await assertFails(
      setDoc(doc(bia, "groceryInvites/bia_l1_caio@exemplo.com"), { ...invite("caio"), ownerId: "bia", ownerEmail: EMAILS.bia }),
    );
    // updatedAt so com o horario do servidor.
    await assertFails(
      updateDoc(doc(bia, "users/ana/groceryLists/l1"), "items.i1.checked", false, "updatedAt", new Date(2000, 0, 1)),
    );
    // Dono nao inventa participante em members.
    await assertFails(
      updateDoc(doc(as("ana"), "users/ana/groceryLists/l1"), "members.fantasma", { name: "X", email: "x@y.com" }),
    );
  });

  it("ninguem entra sem o proprio convite aceito com e-mail confirmado", async () => {
    // Sem convite.
    await assertFails(accept("caio"));
    await createInvite("bia");
    // Convite de outra pessoa.
    await assertFails(accept("caio", { inviteOf: "bia" }));
    // E-mail nao confirmado.
    await assertFails(accept("bia", { verified: false }));
    // So o convite aceito, sem entrar na lista.
    await assertFails(
      updateDoc(doc(as("bia"), `groceryInvites/${inviteId("bia")}`), { status: "aceito", memberUid: "bia", respondedAt: serverTimestamp() }),
    );
    // Acesso ao catalogo sem estar na lista.
    await assertFails(
      setDoc(doc(as("caio"), "users/ana/groceryMembers/caio"), {
        ownerId: "ana",
        memberUid: "caio",
        email: EMAILS.caio,
        name: "caio",
        listId: "l1",
        createdAt: serverTimestamp(),
      }),
    );

    const caio = as("caio");
    await assertFails(getDoc(doc(caio, "users/ana/groceryLists/l1")));
    await assertFails(getDocs(collection(caio, "users/ana/groceryProducts")));
    await assertFails(updateDoc(doc(caio, "users/ana/groceryLists/l1"), "items.i1.checked", true, "updatedAt", serverTimestamp()));
  });

  it("dono nao inclui participante sem o aceite", async () => {
    await assertFails(updateDoc(doc(as("ana"), "users/ana/groceryLists/l1"), { memberIds: ["bia"] }));
  });

  it("guest aceita, mas so consulta", async () => {
    await createInvite("gui");
    await assertSucceeds(accept("gui"));
    await assertSucceeds(getDoc(doc(as("gui"), "users/ana/groceryLists/l1")));
    await assertFails(updateDoc(doc(as("gui"), "users/ana/groceryLists/l1"), "items.i1.checked", true, "updatedAt", serverTimestamp()));
  });

  it("participante sai; dono remove; o acesso acaba", async () => {
    await createInvite("bia");
    await assertSucceeds(accept("bia"));
    await createInvite("caio");
    await assertSucceeds(accept("caio"));

    // Sair: so a si mesmo.
    await assertFails(leave("caio", "bia"));
    await assertSucceeds(leave("bia"));
    await assertFails(getDoc(doc(as("bia"), "users/ana/groceryLists/l1")));
    await assertFails(getDocs(collection(as("bia"), "users/ana/groceryProducts")));

    // Dono remove (tambem de lista concluida).
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "users/ana/groceryLists/l1"), { status: "concluida" });
    });
    await assertSucceeds(leave("caio", "ana"));
    await assertFails(getDoc(doc(as("caio"), "users/ana/groceryLists/l1")));
    expect((await getDoc(doc(as("ana"), "users/ana/groceryLists/l1"))).data()?.memberIds).toEqual([]);
  });

  it("lista concluida: participante so consulta", async () => {
    await createInvite("bia");
    await assertSucceeds(accept("bia"));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await updateDoc(doc(context.firestore(), "users/ana/groceryLists/l1"), { status: "concluida" });
    });
    await assertSucceeds(getDoc(doc(as("bia"), "users/ana/groceryLists/l1")));
    await assertFails(updateDoc(doc(as("bia"), "users/ana/groceryLists/l1"), "items.i1.checked", true, "updatedAt", serverTimestamp()));
  });

  it("participante que apaga o proprio convite nao impede o dono de remove-lo nem a si de sair", async () => {
    await createInvite("bia");
    await assertSucceeds(accept("bia"));
    await createInvite("caio");
    await assertSucceeds(accept("caio"));
    await assertSucceeds(deleteDoc(doc(as("bia"), `groceryInvites/${inviteId("bia")}`)));
    await assertSucceeds(deleteDoc(doc(as("caio"), `groceryInvites/${inviteId("caio")}`)));

    await assertSucceeds(leave("bia", "ana"));
    await assertSucceeds(leave("caio"));
  });

  it("depois de sair, o convite antigo nao reabre a lista", async () => {
    await createInvite("bia");
    await assertSucceeds(accept("bia"));

    // Sai sem apagar o convite aceito.
    const db = as("bia");
    const out = writeBatch(db);
    out.update(
      doc(db, "users/ana/groceryLists/l1"),
      new FieldPath("memberIds"),
      arrayRemove("bia"),
      new FieldPath("members", "bia"),
      deleteField(),
      new FieldPath("updatedAt"),
      serverTimestamp(),
    );
    await assertSucceeds(out.commit());

    // Tenta voltar so com a lista e o acesso ao catalogo (convite antigo ja aceito).
    const back = writeBatch(db);
    back.update(
      doc(db, "users/ana/groceryLists/l1"),
      new FieldPath("memberIds"),
      arrayUnion("bia"),
      new FieldPath("members", "bia"),
      { name: "bia", email: EMAILS.bia },
      new FieldPath("updatedAt"),
      serverTimestamp(),
    );
    await assertFails(back.commit());
  });

  it("lista cheia (5 participantes) nao recebe convite nem sexto participante", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const members = ["m1", "m2", "m3", "m4"];
      await updateDoc(doc(db, "users/ana/groceryLists/l1"), {
        memberIds: members,
        members: Object.fromEntries(members.map((uid) => [uid, { name: uid, email: `${uid}@x.com` }])),
      });
      // Convite pendente da Bia feito antes de lotar.
      await setDoc(doc(db, `groceryInvites/${inviteId("bia")}`), { ...invite("bia"), createdAt: new Date() });
    });
    await createInvite("caio");
    await assertSucceeds(accept("caio"));
    // 5 participantes: sem convite novo e sem sexto.
    await assertFails(setDoc(doc(as("ana"), `groceryInvites/${inviteId("gui")}`), invite("gui")));
    await assertFails(accept("bia"));
  });
});
