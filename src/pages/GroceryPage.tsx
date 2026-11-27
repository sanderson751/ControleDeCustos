import { CopyIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { PriceHistorySection } from "@/components/grocery/PriceHistorySection";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type GroceryList,
  MAX_LIST_NAME_LENGTH,
} from "@/domain/entities/grocery";
import {
  defaultListName,
  forecastList,
  reuseListItems,
  validateListName,
} from "@/domain/rules/groceryRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import { useGroceryData } from "@/hooks/useGroceryData";
import { formatCurrencyBRL } from "@/lib/currency";
import { formatDateBR } from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { ROUTES } from "@/routes/navigation";
import { createList, deleteList } from "@/services/groceryService";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export default function GroceryPage() {
  const { profile } = useSession();
  const userId = profile.userId;
  const canEdit = canMutateCosts(profile.role);
  const navigate = useNavigate();
  const { products, lists, isLoading, error } = useGroceryData(userId);
  const [name, setName] = useState(() => defaultListName());
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openLists = lists.filter((list) => list.status === "aberta");
  const doneLists = lists.filter((list) => list.status === "concluida");
  const pendingDelete = lists.find((list) => list.id === pendingDeleteId) ?? null;

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateListName(name);

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    setIsCreating(true);

    try {
      const { id, written } = createList(userId, { name: validation.value });
      written.catch((createError: unknown) =>
        notify("error", friendlyFirestoreErrorMessage(createError, "Falha ao criar a lista.")),
      );
      navigate(ROUTES.groceryList(id));
    } catch (createError) {
      notify("error", friendlyFirestoreErrorMessage(createError, "Falha ao criar a lista."));
      setIsCreating(false);
    }
  }

  function handleReuse(list: GroceryList) {
    setBusyId(list.id);

    try {
      const { id, written } = createList(userId, {
        name: defaultListName(),
        items: reuseListItems(list, () => crypto.randomUUID()),
      });
      written.catch((reuseError: unknown) =>
        notify("error", friendlyFirestoreErrorMessage(reuseError, "Falha ao criar a lista.")),
      );
      notify("success", `Nova lista criada a partir de "${list.name}".`);
      navigate(ROUTES.groceryList(id));
    } catch (reuseError) {
      notify("error", friendlyFirestoreErrorMessage(reuseError, "Falha ao criar a lista."));
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    const target = pendingDelete;
    setPendingDeleteId(null);
    if (!target) return;

    try {
      await deleteList(userId, target.id);
      notify("success", `Lista "${target.name}" excluída.`);
    } catch (deleteError) {
      notify("error", friendlyFirestoreErrorMessage(deleteError, "Falha ao excluir a lista."));
    }
  }

  return (
    <section className="space-y-10" data-testid="grocery-page-screen">
      <PageHeader
        eyebrow="Planejamento"
        title="Mercado"
        description="Monte a lista de compras e veja quanto deve gastar pelos preços que você pagou da última vez. Ao concluir, a compra vira um lançamento em Alimentação."
      />

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Nova lista</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreate}
              aria-label="Nova lista"
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              noValidate
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="grocery-list-name">Nome da lista</Label>
                <Input
                  id="grocery-list-name"
                  value={name}
                  maxLength={MAX_LIST_NAME_LENGTH}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isCreating}
                />
              </div>
              <LoadingButton
                type="submit"
                isLoading={isCreating}
                loadingText="Criando..."
                icon={<PlusIcon aria-hidden="true" />}
              >
                Criar lista
              </LoadingButton>
            </form>
          </CardContent>
        </Card>
      )}

      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : isLoading ? (
        <p className="text-muted-foreground" aria-live="polite">
          Carregando listas...
        </p>
      ) : (
        <>
          <section className="space-y-4" aria-labelledby="open-lists-title">
            <h2 id="open-lists-title" className="font-heading text-2xl">
              Listas abertas
            </h2>
            {openLists.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma lista aberta.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {openLists.map((list) => {
                  const forecast = forecastList(list.items, products);
                  return (
                    <Card key={list.id} role="region" aria-label={`Lista ${list.name}`}>
                      <CardHeader>
                        <CardTitle className="text-xl">{list.name}</CardTitle>
                        <CardDescription>
                          {`${plural(list.items.length, "item", "itens")} · previsto ${formatCurrencyBRL(forecast.total)}`}
                          {forecast.missingCount > 0 &&
                            ` · ${plural(forecast.missingCount, "sem histórico", "sem histórico")}`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex gap-2">
                        <Button asChild size="sm">
                          <Link to={ROUTES.groceryList(list.id)}>Abrir lista</Link>
                        </Button>
                        {canEdit && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Excluir ${list.name}`}
                            onClick={() => setPendingDeleteId(list.id)}
                          >
                            <Trash2Icon />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-4" aria-labelledby="done-lists-title">
            <h2 id="done-lists-title" className="font-heading text-2xl">
              Compras concluídas
            </h2>
            {doneLists.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma compra concluída ainda.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {doneLists.map((list) => (
                  <li key={list.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <Link
                        to={ROUTES.groceryList(list.id)}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {list.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {`${plural(list.items.length, "item", "itens")}${list.completedAt ? ` · concluída em ${formatDateBR(list.completedAt)}` : ""}${list.paidTotal !== null ? ` · total pago ${formatCurrencyBRL(list.paidTotal)}` : ""}`}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <LoadingButton
                          size="sm"
                          variant="outline"
                          isLoading={busyId === list.id}
                          loadingText="Criando..."
                          icon={<CopyIcon aria-hidden="true" />}
                          onClick={() => handleReuse(list)}
                          disabled={busyId !== null}
                          aria-label={`Usar novamente ${list.name}`}
                        >
                          Usar novamente
                        </LoadingButton>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Excluir ${list.name}`}
                          onClick={() => setPendingDeleteId(list.id)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <PriceHistorySection products={products} />
        </>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.name}" será removida. ${pendingDelete.status === "concluida" ? "O lançamento e o histórico de preços da compra continuam." : ""}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleConfirmDelete()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
