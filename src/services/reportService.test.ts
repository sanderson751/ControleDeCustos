import * as firestore from "firebase/firestore";
import {
  InvalidDateRangeError,
  listCostsForReport,
} from "@/services/reportService";
import { querySnapshot, timestamp } from "@/test/firestoreMock";

vi.mock("firebase/firestore", async () =>
  (await import("@/test/firestoreMock")).createFirestoreMock(),
);

const mocked = vi.mocked(firestore);

describe("listCostsForReport", () => {
  it("filtra por intervalo de criacao inclusivo e ordena desc", async () => {
    mocked.getDocs.mockResolvedValueOnce(
      querySnapshot([
        {
          id: "1",
          data: {
            accountName: "Internet",
            amount: 99,
            costType: "fixo",
            createdAt: timestamp(new Date(2026, 10, 5)),
          },
        },
      ]) as never,
    );

    const entries = await listCostsForReport("uid-1", {
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      costType: "todos",
    });

    const [start, end] = vi.mocked(firestore.Timestamp.fromDate).mock.calls.map(
      (call) => call[0],
    );
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(30);
    expect(end.getHours()).toBe(23);
    expect(mocked.where).not.toHaveBeenCalledWith(
      "costType",
      expect.anything(),
      expect.anything(),
    );
    expect(mocked.orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(entries).toHaveLength(1);
    expect(entries[0].accountName).toBe("Internet");
  });

  it("adiciona filtro de frente quando informado", async () => {
    mocked.getDocs.mockResolvedValueOnce(querySnapshot([]) as never);

    await listCostsForReport("uid-1", {
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      costType: "variavel",
    });

    expect(mocked.where).toHaveBeenCalledWith("costType", "==", "variavel");
  });

  it("rejeita intervalo invalido sem consultar o Firestore", async () => {
    await expect(
      listCostsForReport("uid-1", {
        startDate: "2026-12-01",
        endDate: "2026-11-01",
        costType: "todos",
      }),
    ).rejects.toBeInstanceOf(InvalidDateRangeError);
    expect(mocked.getDocs).not.toHaveBeenCalled();
  });
});
