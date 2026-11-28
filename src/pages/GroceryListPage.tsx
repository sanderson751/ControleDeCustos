import {
  ArrowLeftIcon,
  CheckCheckIcon,
  CopyIcon,
  LogOutIcon,
  ShoppingCartIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AddItemForm } from "@/components/grocery/AddItemForm";
import { CompleteListDialog } from "@/components/grocery/CompleteListDialog";
import { ListBudgetCard } from "@/components/grocery/ListBudgetCard";
import { PriceTrendBadge } from "@/components/grocery/PriceTrendBadge";
import { RestockCard } from "@/components/grocery/RestockCard";
import { ShareListDialog } from "@/components/grocery/ShareListDialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GROCERY_UNIT_LABELS,
  type GroceryListItem,
  type GroceryProduct,
  type GroceryUnit,
} from "@/domain/entities/grocery";
import {
  addItemToList,
  defaultListName,
  forecastList,
  formatQuantity,
  parseQuantityInput,
  reuseListItems,
  validateQuantity,
} from "@/domain/rules/groceryRules";
import { restockSuggestions } from "@/domain/rules/groceryInsights";
import { listMemberIds } from "@/domain/rules/groceryShareRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import { useGroceryList } from "@/hooks/useGroceryList";
import { useOptimisticListItems } from "@/hooks/useOptimisticListItems";
import { useShareActor } from "@/hooks/useShareActor";
import { formatCurrencyBRL } from "@/lib/currency";
import { formatDateBR } from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { ROUTES } from "@/routes/navigation";
import { createList, createProduct } from "@/services/groceryService";
import { leaveList } from "@/services/groceryShareService";

function QuantityInput({
  item,
  unit,
  disabled,
  onCommit,
}: {
  item: GroceryListItem;
  unit: GroceryUnit;
  disabled: boolean;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseQuantityInput(draft, unit);
    const check = validateQuantity(parsed ?? Number.NaN, unit);
    setDraft(null);
    if (!check.ok) {
      notify("warning", check.message);
      return;
    }
    if (check.value !== item.quantity) {
      onCommit(check.value);
    }
  };

  return (
    <Input
      aria-label={`Quantidade de ${item.name}`}
      className="h-8 w-20 tabular-nums"
      inputMode="decimal"
      value={draft ?? formatQuantity(item.quantity)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
      disabled={disabled}
    />
  );
}

export default function GroceryListPage() {
  const { listId = "", ownerId: ownerParam } = useParams<{ listId: string; ownerId: string }>();
  const { profile } = useSession();
  const userId = profile.userId;
  // Lista compartilhada: os itens e o catalogo ficam no caminho do dono.
  const ownerId = ownerParam ?? userId;
  const canEdit = canMutateCosts(profile.role);
  const navigate = useNavigate();
  const { actor } = useShareActor();
  const { products, list, isShared, isLoading, error } = useGroceryList(userId, ownerId, listId);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isReusing, setIsReusing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Modo mercado costuma abrir ja sem sinal: baixa a tela enquanto ha conexao.
  useEffect(() => {
    void import("@/pages/GroceryShopPage").catch(() => undefined);
  }, []);

  const { items, update } = useOptimisticListItems(ownerId, list);
  const forecast = useMemo(() => forecastList(items, products), [items, products]);
  const editable = canEdit && list?.status === "aberta";
  const suggestions = useMemo(
    () => (editable ? restockSuggestions(products, items) : []),
    [editable, items, products],
  );

  const setItem = (itemId: string, patch: Partial<GroceryListItem>) =>
    update((current) => current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));

  /** Inclui o item na hora; o produto novo e a lista sao confirmados em segundo plano. */
  async function handleAdd(input: {
    product: GroceryProduct | null;
    newProduct: { name: string; unit: GroceryUnit } | null;
    quantity: number;
  }) {
    if (!list) return false;

    let product: Pick<GroceryProduct, "id" | "name"> | null = input.product;
    let created: Promise<void> | null = null;

    if (!product && input.newProduct) {
      try {
        const write = createProduct(ownerId, input.newProduct);
        product = { id: write.id, name: input.newProduct.name };
        created = write.written;
      } catch (createError) {
        notify("error", friendlyFirestoreErrorMessage(createError, "Falha ao adicionar o produto."));
        return false;
      }
    }

    if (!product) return false;

    let message: string | null = null;
    const next = update((current) => {
      const result = addItemToList(current, product, input.quantity, crypto.randomUUID());
      if (!result.ok) {
        message = result.message;
        return null;
      }
      return result.value;
    });

    created?.catch((createError: unknown) =>
      notify("error", friendlyFirestoreErrorMessage(createError, "Falha ao salvar o produto novo.")),
    );

    if (!next) {
      if (message) notify("warning", message);
      return false;
    }

    return true;
  }

  function handleReuse() {
    if (!list) return;
    setIsReusing(true);

    try {
      const { id, written } = createList(userId, {
        name: defaultListName(),
        items: reuseListItems({ items: [...items] }, () => crypto.randomUUID()),
      });
      written.catch((reuseError: unknown) =>
        notify("error", friendlyFirestoreErrorMessage(reuseError, "Falha ao criar a lista.")),
      );
      notify("success", `Nova lista criada a partir de "${list.name}".`);
      navigate(ROUTES.groceryList(id));
    } catch (reuseError) {
      notify("error", friendlyFirestoreErrorMessage(reuseError, "Falha ao criar a lista."));
    } finally {
      setIsReusing(false);
    }
  }

  async function handleLeave() {
    setConfirmLeave(false);
    if (!list) return;
    if (!navigator.onLine) {
      notify("warning", "Sem conexão: conecte-se para sair da lista.");
      return;
    }
    setIsLeaving(true);
    try {
      await leaveList(ownerId, list.id, actor);
      notify("success", `Você saiu da lista "${list.name}".`);
      navigate(ROUTES.grocery);
    } catch (leaveError) {
      notify("error", friendlyFirestoreErrorMessage(leaveError, "Falha ao sair da lista."));
      setIsLeaving(false);
    }
  }

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
      <Link to={ROUTES.grocery}>
        <ArrowLeftIcon aria-hidden="true" />
        Voltar para Mercado
      </Link>
    </Button>
  );

  if (error) {
    return (
      <section className="space-y-6">
        {backLink}
        <p className="text-destructive" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (isLoading) {
    return (
      <p className="text-muted-foreground" aria-live="polite">
        Carregando lista...
      </p>
    );
  }

  if (!list) {
    return (
      <section className="space-y-6">
        {backLink}
        <p className="text-muted-foreground">Lista não encontrada. Ela pode ter sido excluída.</p>
      </section>
    );
  }

  const checkedCount = items.filter((item) => item.checked).length;
  const memberCount = listMemberIds(list).length;
  const ownerName = list.ownerName || "o dono da lista";
  const shopPath = isShared ? ROUTES.sharedGroceryShop(ownerId, list.id) : ROUTES.groceryShop(list.id);

  return (
    <section className="space-y-8" data-testid="grocery-list-screen">
      {backLink}
      <PageHeader
        eyebrow={isShared ? `Lista de ${ownerName}` : "Lista de mercado"}
        title={list.name}
        description={
          isShared
            ? list.status === "concluida"
              ? `Compra concluída por ${ownerName}. A lista está somente para consulta.`
              : `Lista compartilhada: você inclui e marca itens; só ${ownerName} conclui a compra. Os valores previstos usam os preços da última compra de ${ownerName}.`
            : list.status === "concluida"
              ? `Compra concluída${list.completedAt ? ` em ${formatDateBR(list.completedAt)}` : ""}${list.paidTotal !== null ? ` · total pago ${formatCurrencyBRL(list.paidTotal)}` : ""}. Os valores abaixo são a previsão atual; use novamente para planejar a próxima compra.`
              : "Os valores previstos usam o preço que você pagou na última compra de cada produto."
        }
        actions={
          isShared ? (
            <div className="flex flex-wrap gap-2">
              {list.status === "aberta" && items.length > 0 && (
                <Button asChild variant="outline">
                  <Link to={shopPath}>
                    <ShoppingCartIcon aria-hidden="true" />
                    Modo mercado
                  </Link>
                </Button>
              )}
              <LoadingButton
                variant="ghost"
                isLoading={isLeaving}
                loadingText="Saindo..."
                icon={<LogOutIcon aria-hidden="true" />}
                onClick={() => setConfirmLeave(true)}
              >
                Sair da lista
              </LoadingButton>
            </div>
          ) : list.status === "concluida" ? (
            <div className="flex flex-wrap gap-2">
              {/* Concluida: o dono ainda remove quem participa e cancela convites. */}
              {(canEdit || memberCount > 0) && (
                <Button variant="outline" onClick={() => setIsSharing(true)}>
                  <UsersIcon aria-hidden="true" />
                  {memberCount > 0 ? `Compartilhada (${memberCount})` : "Participantes e convites"}
                </Button>
              )}
              {canEdit && (
                <LoadingButton
                  isLoading={isReusing}
                  loadingText="Criando..."
                  icon={<CopyIcon aria-hidden="true" />}
                  onClick={handleReuse}
                >
                  Usar novamente
                </LoadingButton>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Button variant="outline" onClick={() => setIsSharing(true)}>
                  <UsersIcon aria-hidden="true" />
                  {memberCount > 0 ? `Compartilhada (${memberCount})` : "Compartilhar"}
                </Button>
              )}
              {items.length > 0 && (
                <Button asChild variant="outline">
                  <Link to={shopPath}>
                    <ShoppingCartIcon aria-hidden="true" />
                    Modo mercado
                  </Link>
                </Button>
              )}
              {editable && !isShared && (
                <Button onClick={() => setIsCompleting(true)} disabled={items.length === 0}>
                  <CheckCheckIcon aria-hidden="true" />
                  Concluir compra
                </Button>
              )}
            </div>
          )
        }
      />

      {editable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Adicionar item</CardTitle>
          </CardHeader>
          <CardContent>
            <AddItemForm products={products} onAdd={handleAdd} />
          </CardContent>
        </Card>
      )}

      {editable && (
        <RestockCard
          suggestions={suggestions}
          onAdd={(product) =>
            void handleAdd({ product, newProduct: null, quantity: 1 }).then(
              (added) => added && notify("success", `${product.name} adicionado à lista.`),
            )
          }
        />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-xl">Itens</CardTitle>
          <Badge variant="secondary">{`${checkedCount} de ${items.length} no carrinho`}</Badge>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-4 text-muted-foreground">Nenhum item na lista ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">No carrinho</span>
                  </TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead className="text-right">Preço previsto</TableHead>
                  <TableHead className="text-right">Total previsto</TableHead>
                  {editable && (
                    <TableHead className="w-10">
                      <span className="sr-only">Remover</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecast.items.map((item) => {
                  const unit = item.product?.unit ?? "un";
                  return (
                    <TableRow key={item.id} data-state={item.checked ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          aria-label={`${item.name} no carrinho`}
                          checked={item.checked}
                          disabled={!editable}
                          onCheckedChange={(checked) => setItem(item.id, { checked: checked === true })}
                        />
                      </TableCell>
                      <TableCell className={item.checked ? "font-medium line-through" : "font-medium"}>
                        {item.product?.name ?? item.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {editable ? (
                            <QuantityInput
                              item={item}
                              unit={unit}
                              disabled={false}
                              onCommit={(quantity) => setItem(item.id, { quantity })}
                            />
                          ) : (
                            <span className="tabular-nums">{formatQuantity(item.quantity)}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{GROCERY_UNIT_LABELS[unit]}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.unitPrice !== null ? (
                          <span className="inline-flex items-center justify-end gap-2">
                            <PriceTrendBadge product={item.product} />
                            {formatCurrencyBRL(item.unitPrice)}
                          </span>
                        ) : (
                          <Badge variant="outline">sem histórico</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.total !== null ? formatCurrencyBRL(item.total) : "—"}
                      </TableCell>
                      {editable && (
                        <TableCell>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Remover ${item.name}`}
                            onClick={() =>
                              update((current) => current.filter((entry) => entry.id !== item.id))
                            }
                          >
                            <Trash2Icon />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">
                    Total previsto
                    {forecast.missingCount > 0 && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {`(${forecast.missingCount} ${forecast.missingCount === 1 ? "item" : "itens"} sem histórico)`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrencyBRL(forecast.total)}
                  </TableCell>
                  {editable && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Orçamento e conclusão são do dono. */}
      {!isShared && list.status === "aberta" && <ListBudgetCard userId={userId} forecast={forecast.total} />}

      {isSharing && !isShared && <ShareListDialog owner={actor} list={list} onClose={() => setIsSharing(false)} />}

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair da lista?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Você deixa de ver "${list.name}". Para voltar, ${ownerName} precisa convidar você de novo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleLeave()}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isCompleting && !isShared && (
        <CompleteListDialog
          userId={userId}
          list={{ ...list, items: [...items] }}
          products={products}
          forecast={forecast.total}
          onClose={() => setIsCompleting(false)}
        />
      )}
    </section>
  );
}
