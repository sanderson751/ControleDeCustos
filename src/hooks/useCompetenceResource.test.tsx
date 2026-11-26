import { act, renderHook, waitFor } from "@testing-library/react";
import type { Competence } from "@/domain/entities/cost";
import { useCompetenceResource } from "@/hooks/useCompetenceResource";

type Deferred = {
  promise: Promise<string[]>;
  resolve: (value: string[]) => void;
  reject: (error: unknown) => void;
};

function deferred(): Deferred {
  let resolve!: Deferred["resolve"];
  let reject!: Deferred["reject"];
  const promise = new Promise<string[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const NONE: string[] = [];
const OCT: Competence = { year: 2026, month: 10 };
const SEP: Competence = { year: 2026, month: 9 };

function setup(fetcher: (uid: string, c: Competence) => Promise<string[]>) {
  return renderHook(
    ({ competence }) =>
      useCompetenceResource("uid-1", competence, fetcher, "Falhou.", NONE),
    { initialProps: { competence: OCT } },
  );
}

describe("useCompetenceResource", () => {
  it("carrega os dados da competencia", async () => {
    const fetcher = vi.fn(async () => ["a"]);
    const { result } = setup(fetcher);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(["a"]);
    expect(fetcher).toHaveBeenCalledWith("uid-1", OCT);
  });

  it("regressao: descarta resposta fora de ordem ao trocar de mes rapidamente", async () => {
    const pending = new Map<number, Deferred>();
    const fetcher = vi.fn((_uid: string, competence: Competence) => {
      const next = deferred();
      pending.set(competence.month, next);
      return next.promise;
    });
    const { result, rerender } = setup(fetcher);

    rerender({ competence: SEP });
    await act(async () => pending.get(9)!.resolve(["setembro"]));
    await act(async () => pending.get(10)!.resolve(["outubro"]));

    expect(result.current.data).toEqual(["setembro"]);
    expect(result.current.isLoading).toBe(false);
  });

  it("regressao: reload de closure antiga nao sobrescreve o mes atual", async () => {
    const fetcher = vi.fn(async (_uid: string, competence: Competence) => [
      `mes-${competence.month}`,
    ]);
    const { result, rerender } = setup(fetcher);
    await waitFor(() => expect(result.current.data).toEqual(["mes-10"]));
    const staleReload = result.current.reload;

    rerender({ competence: SEP });
    await waitFor(() => expect(result.current.data).toEqual(["mes-9"]));

    let staleResult: string[] | null = ["x"];
    await act(async () => {
      staleResult = await staleReload();
    });

    expect(staleResult).toBeNull();
    expect(result.current.data).toEqual(["mes-9"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("limpa os dados ao trocar de competencia e expoe erro amigavel", async () => {
    const fetcher = vi
      .fn<(uid: string, c: Competence) => Promise<string[]>>()
      .mockResolvedValueOnce(["outubro"])
      .mockRejectedValueOnce(new Error("offline"));
    const { result, rerender } = setup(fetcher);
    await waitFor(() => expect(result.current.data).toEqual(["outubro"]));

    rerender({ competence: SEP });

    await waitFor(() => expect(result.current.error).toBe("Falhou."));
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
