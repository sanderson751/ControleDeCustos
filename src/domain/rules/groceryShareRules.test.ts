import {
  inviteIdFor,
  keepsCatalogAccess,
  memberDisplayName,
  normalizeEmail,
  validateInvite,
} from "@/domain/rules/groceryShareRules";

const openList = { status: "aberta" as const, memberIds: ["bia"], members: { bia: { name: "Bia", email: "bia@exemplo.com" } } };

describe("groceryShareRules", () => {
  it("normaliza e-mail e monta o id do convite", () => {
    expect(normalizeEmail("  Bia@Exemplo.COM ")).toBe("bia@exemplo.com");
    expect(inviteIdFor("ana", "l1", " Bia@Exemplo.com")).toBe("ana_l1_bia@exemplo.com");
  });

  it("nome exibido: nome, ou a parte do e-mail antes do @", () => {
    expect(memberDisplayName("  Ana  ", "ana@x.com")).toBe("Ana");
    expect(memberDisplayName("", "carlos.silva@x.com")).toBe("carlos.silva");
    expect(memberDisplayName(null, "")).toBe("Participante");
    expect(memberDisplayName("x".repeat(100), "a@b.com")).toHaveLength(80);
  });

  it("valida o convite", () => {
    const base = { ownerEmail: "ana@exemplo.com", list: openList, invites: [] };
    expect(validateInvite({ ...base, email: " Caio@Exemplo.com " })).toEqual({ ok: true, value: "caio@exemplo.com" });

    const message = (input: Partial<Parameters<typeof validateInvite>[0]>) => {
      const result = validateInvite({ ...base, email: "caio@exemplo.com", ...input });
      return result.ok ? null : result.message;
    };
    expect(message({ email: "" })).toBe("Informe o e-mail de quem você quer convidar.");
    expect(message({ email: "caio@" })).toBe("Informe um e-mail válido.");
    expect(message({ email: "ANA@exemplo.com" })).toBe("Você já é o dono desta lista.");
    expect(message({ email: "bia@exemplo.com" })).toBe("Essa pessoa já participa da lista.");
    expect(message({ invites: [{ email: "caio@exemplo.com", status: "pendente" }] })).toBe(
      "Já existe um convite pendente para esse e-mail.",
    );
    // Convite recusado pode ser refeito.
    expect(message({ invites: [{ email: "caio@exemplo.com", status: "recusado" }] })).toBeNull();
    expect(message({ list: { ...openList, status: "concluida" } })).toBe("Só é possível compartilhar uma lista aberta.");
    expect(
      message({
        list: { ...openList, memberIds: ["a", "b", "c"] },
        invites: [{ email: "x@y.com", status: "pendente" }],
      }),
    ).toBeNull();
    expect(
      message({
        list: { ...openList, memberIds: ["a", "b", "c", "d"] },
        invites: [{ email: "x@y.com", status: "pendente" }],
      }),
    ).toBe("A lista pode ter no máximo 5 participantes (contando convites pendentes).");
  });

  it("acesso ao catalogo continua se a pessoa participa de outra lista do mesmo dono", () => {
    const lists = [
      { id: "l1", ownerId: "ana", memberIds: ["bia"] },
      { id: "l2", ownerId: "ana", memberIds: ["bia", "caio"] },
      { id: "l3", ownerId: "outro", memberIds: ["caio"] },
    ];
    expect(keepsCatalogAccess("bia", "ana", "l1", lists)).toBe(true);
    expect(keepsCatalogAccess("caio", "ana", "l2", lists)).toBe(false);
    expect(keepsCatalogAccess("bia", "ana", "l1", lists.slice(0, 1))).toBe(false);
  });
});
