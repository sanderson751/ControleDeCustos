import { toast } from "sonner";
import { notify, SNACKBAR_DURATION_MS } from "@/lib/notify";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

describe("notify", () => {
  it("mantem o contrato de 3 segundos do snackbar", () => {
    expect(SNACKBAR_DURATION_MS).toBe(3000);
  });

  it.each([
    ["success", "Salvo."],
    ["warning", "Atenção."],
    ["error", "Falhou."],
  ] as const)("encaminha status %s para o toast correspondente", (status, message) => {
    notify(status, message);
    expect(toast[status]).toHaveBeenCalledWith(message);
  });
});
