import * as firestore from "firebase/firestore";
import type { GroceryInvite } from "@/domain/entities/grocery";
import {
  acceptInvite,
  declineInvite,
  inviteToList,
  leaveList,
  listShareCleanup,
  removeMember,
  subscribeToList,
  subscribeToMyInvites,
  subscribeToSharedLists,
} from "@/services/groceryShareService";
import { docSnapshot, querySnapshot, timestamp } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

type BatchMock = Record<"set" | "update" | "delete" | "commit", ReturnType<typeof vi.fn>>;
const batch = (firestore as unknown as { __batch: BatchMock }).__batch;
const mocked = vi.mocked(firestore);
const NOW = new Date(2026, 10, 27, 12);
const ANA = { uid: "ana", name: "Ana", email: "ana@exemplo.com" };
const BIA = { uid: "bia", name: "Bia", email: "bia@exemplo.com" };

const INVITE: GroceryInvite = {
  id: "ana_l1_bia@exemplo.com",
  ownerId: "ana",
  ownerName: "Ana",
  ownerEmail: "ana@exemplo.com",
  listId: "l1",
  listName: "Feira",
  email: "bia@exemplo.com",
  status: "pendente",
  memberUid: null,
  createdAt: NOW,
};

const paths = (calls: unknown[][]) => calls.map(([ref]) => (ref as { path: string }).path);
const fieldPairs = (call: unknown[]) => {
  const pairs: Array<[string, unknown]> = [];
  for (let index = 1; index < call.length; index += 2) {
    pairs.push([(call[index] as { segments: string[] }).segments.join("."), call[index + 1]]);
  }
  return pairs;
};

describe("groceryShareService", () => {
  beforeEach(() => {
    batch.commit.mockResolvedValue(undefined);
  });

  it("convida: convite pendente e nome do dono na lista, no mesmo lote", async () => {
    await inviteToList(ANA, { id: "l1", name: "Feira" }, " Bia@Exemplo.com ", null);

    expect(mocked.deleteDoc).not.toHaveBeenCalled();
    expect(batch.set).toHaveBeenCalledWith(
      expect.objectContaining({ path: "groceryInvites/ana_l1_bia@exemplo.com" }),
      {
        ownerId: "ana",
        ownerName: "Ana",
        ownerEmail: "ana@exemplo.com",
        listId: "l1",
        listName: "Feira",
        email: "bia@exemplo.com",
        status: "pendente",
        memberUid: null,
        createdAt: "SERVER_TIMESTAMP",
        respondedAt: null,
      },
    );
    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/ana/groceryLists/l1" }),
      { ownerName: "Ana", updatedAt: "SERVER_TIMESTAMP" },
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("convite ja respondido e substituido por um novo", async () => {
    await inviteToList(ANA, { id: "l1", name: "Feira" }, "bia@exemplo.com", { id: INVITE.id, status: "recusado" });
    expect(mocked.deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: "groceryInvites/ana_l1_bia@exemplo.com" }));
    expect(mocked.deleteDoc.mock.invocationCallOrder[0]).toBeLessThan(batch.commit.mock.invocationCallOrder[0]);
  });

  it("aceita em um lote: convite, entrada na lista e acesso ao catalogo", async () => {
    await acceptInvite(INVITE, BIA);

    expect(batch.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: "groceryInvites/ana_l1_bia@exemplo.com" }),
      { status: "aceito", memberUid: "bia", respondedAt: "SERVER_TIMESTAMP" },
    );
    const listCall = batch.update.mock.calls.find(([ref]) => (ref as { path: string }).path === "users/ana/groceryLists/l1")!;
    expect(fieldPairs(listCall)).toEqual([
      ["memberIds", { arrayUnion: ["bia"] }],
      ["members.bia", { name: "Bia", email: "bia@exemplo.com" }],
      ["updatedAt", "SERVER_TIMESTAMP"],
    ]);
    expect(batch.set).toHaveBeenCalledWith(expect.objectContaining({ path: "users/ana/groceryMembers/bia" }), {
      ownerId: "ana",
      memberUid: "bia",
      email: "bia@exemplo.com",
      name: "Bia",
      listId: "l1",
      createdAt: "SERVER_TIMESTAMP",
    });
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("recusa", async () => {
    await declineInvite(INVITE.id);
    expect(mocked.updateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: "groceryInvites/ana_l1_bia@exemplo.com" }), {
      status: "recusado",
      memberUid: null,
      respondedAt: "SERVER_TIMESTAMP",
    });
  });

  it("sair: mantem o acesso ao catalogo se participa de outra lista do mesmo dono", async () => {
    mocked.getDocs.mockResolvedValueOnce(
      querySnapshot([
        { id: "l1", data: { userId: "ana", memberIds: ["bia"] } },
        { id: "l2", data: { userId: "ana", memberIds: ["bia"] } },
      ]) as never,
    );
    await leaveList("ana", "l1", BIA);

    const listCall = batch.update.mock.calls.find(([ref]) => (ref as { path: string }).path === "users/ana/groceryLists/l1")!;
    expect(fieldPairs(listCall)).toEqual([
      ["memberIds", { arrayRemove: ["bia"] }],
      ["members.bia", "DELETE_FIELD"],
      ["updatedAt", "SERVER_TIMESTAMP"],
    ]);
    expect(paths(batch.delete.mock.calls)).toEqual(["groceryInvites/ana_l1_bia@exemplo.com"]);
    // Consulta das minhas listas compartilhadas (grupo de colecoes).
    expect(mocked.collectionGroup).toHaveBeenCalledWith(expect.anything(), "groceryLists");
    expect(mocked.where).toHaveBeenCalledWith("memberIds", "array-contains", "bia");
  });

  it("dono remove: sem outra lista do dono, o acesso ao catalogo sai junto", async () => {
    mocked.getDocs.mockResolvedValueOnce(querySnapshot([{ id: "l1", data: { userId: "ana", memberIds: ["bia"] } }]) as never);
    await removeMember("ana", "l1", { uid: "bia", email: "bia@exemplo.com" });

    expect(paths(batch.delete.mock.calls)).toEqual([
      "groceryInvites/ana_l1_bia@exemplo.com",
      "users/ana/groceryMembers/bia",
    ]);
    expect(mocked.collection).toHaveBeenCalledWith(expect.anything(), "users", "ana", "groceryLists");
  });

  it("assina convites pendentes do e-mail e listas compartilhadas comigo", () => {
    const onInvites = vi.fn();
    mocked.onSnapshot.mockImplementationOnce(((_query: unknown, next: (s: unknown) => void) => {
      next(querySnapshot([{ id: INVITE.id, data: { ...INVITE, createdAt: timestamp(NOW), status: "outro" } }]));
      return () => undefined;
    }) as never);
    subscribeToMyInvites(" Bia@Exemplo.com", onInvites, vi.fn());
    expect(mocked.where).toHaveBeenCalledWith("email", "==", "bia@exemplo.com");
    expect(mocked.where).toHaveBeenCalledWith("status", "==", "pendente");
    expect(onInvites.mock.calls[0][0]).toEqual([{ ...INVITE, status: "pendente" }]);

    const onLists = vi.fn();
    mocked.onSnapshot.mockImplementationOnce(((_query: unknown, next: (s: unknown) => void) => {
      next(
        querySnapshot([
          {
            id: "l9",
            data: {
              userId: "ana",
              ownerName: "Ana",
              name: "Churrasco",
              status: "aberta",
              items: {},
              memberIds: ["bia", 3],
              members: { bia: { name: "Bia", email: "bia@exemplo.com" }, x: null },
              createdAt: timestamp(NOW),
            },
          },
        ]),
      );
      return () => undefined;
    }) as never);
    subscribeToSharedLists("bia", onLists, vi.fn());
    expect(onLists.mock.calls[0][0][0]).toMatchObject({
      id: "l9",
      ownerId: "ana",
      ownerName: "Ana",
      memberIds: ["bia"],
      members: { bia: { name: "Bia", email: "bia@exemplo.com" } },
    });
  });

  it("lista inexistente chega como null; sem sinal e sem copia no aparelho, espera o servidor", () => {
    const onData = vi.fn();
    mocked.onSnapshot.mockImplementationOnce(((_ref: unknown, next: (s: unknown) => void) => {
      next(docSnapshot("l1", null, true));
      next(docSnapshot("l1", null));
      return () => undefined;
    }) as never);
    subscribeToList("ana", "l1", onData, vi.fn());
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onData).toHaveBeenCalledWith(null);
  });

  it("limpeza ao excluir: convites da lista e acessos de quem nao esta em outra lista", async () => {
    mocked.getDocs.mockResolvedValueOnce(querySnapshot([{ id: "l1_bia@exemplo.com", data: {} }, { id: "l1_x@y.com", data: {} }]) as never);
    await expect(
      listShareCleanup("ana", { id: "l1", memberIds: ["bia", "caio"] }, [
        { id: "l1", memberIds: ["bia", "caio"] },
        { id: "l2", memberIds: ["caio"] },
      ]),
    ).resolves.toEqual({ inviteIds: ["l1_bia@exemplo.com", "l1_x@y.com"], memberUids: ["bia"], complete: true });

    // Falha na consulta: os acessos continuam calculados pela lista, sinalizando a falta dos convites.
    mocked.getDocs.mockRejectedValueOnce(new Error("offline"));
    await expect(listShareCleanup("ana", { id: "l1", memberIds: ["bia"] }, [])).resolves.toEqual({
      inviteIds: [],
      memberUids: ["bia"],
      complete: false,
    });
  });
});
