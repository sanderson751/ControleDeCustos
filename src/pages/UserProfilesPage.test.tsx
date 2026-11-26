import { screen, waitFor, within } from "@testing-library/react";
import { notify } from "@/lib/notify";
import UserProfilesPage from "@/pages/UserProfilesPage";
import { useSession } from "@/providers/AuthProvider";
import {
  listUsers,
  updateOwnDisplayName,
  updateUserByAdmin,
} from "@/services/userService";
import { makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/userService", () => ({
  listUsers: vi.fn(),
  updateUserByAdmin: vi.fn(async () => undefined),
  updateOwnDisplayName: vi.fn(async () => undefined),
}));

const admin = makeProfile("admin", { displayName: "Admin Geral" });
const standard = makeProfile("standard", {
  userId: "uid-bia",
  email: "bia@exemplo.com",
  displayName: "Bia",
});

describe("UserProfilesPage", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      profile: admin,
      firebaseUser: {} as never,
    });
    vi.mocked(listUsers).mockResolvedValue([admin, standard]);
  });

  it("lista usuarios com nivel de acesso", async () => {
    renderWithRouter(<UserProfilesPage />);

    expect(await screen.findByText("bia@exemplo.com")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Usuário padrão")).toBeInTheDocument();
  });

  it("admin altera o papel de outro usuario", async () => {
    const { user } = renderWithRouter(<UserProfilesPage />);

    await user.click(
      await screen.findByRole("button", {
        name: "Editar usuário bia@exemplo.com",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Convidado/ }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(updateUserByAdmin).toHaveBeenCalledWith("uid-bia", {
        displayName: "Bia",
        role: "guest",
      }),
    );
    expect(notify).toHaveBeenCalledWith(
      "success",
      "Usuário atualizado com sucesso.",
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Convidado")).toBeInTheDocument();
  });

  it("admin nao altera o proprio papel, apenas o nome", async () => {
    const { user } = renderWithRouter(<UserProfilesPage />);

    await user.click(
      await screen.findByRole("button", {
        name: `Editar usuário ${admin.email}`,
      }),
    );
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByText(
        "Você não pode alterar o seu próprio nível de acesso.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /Convidado/ })).toBeDisabled();

    const nameInput = within(dialog).getByLabelText("Nome completo");
    await user.clear(nameInput);
    await user.type(nameInput, "Admin Novo");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(updateOwnDisplayName).toHaveBeenCalledWith(
        admin.userId,
        "Admin Novo",
      ),
    );
    expect(updateUserByAdmin).not.toHaveBeenCalled();
  });

  it("exige nome preenchido", async () => {
    const { user } = renderWithRouter(<UserProfilesPage />);

    await user.click(
      await screen.findByRole("button", {
        name: "Editar usuário bia@exemplo.com",
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Nome completo"));
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(updateUserByAdmin).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      "warning",
      "Nome completo é obrigatório.",
    );
  });

  it("exibe erro quando nao consegue listar", async () => {
    vi.mocked(listUsers).mockRejectedValue(
      Object.assign(new Error("x"), { code: "permission-denied" }),
    );
    renderWithRouter(<UserProfilesPage />);

    expect(
      await screen.findByText("Você não possui permissão para esta operação."),
    ).toBeInTheDocument();
  });
});
