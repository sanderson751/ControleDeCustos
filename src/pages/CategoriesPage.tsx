import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type CategoryOption,
  MAX_CATEGORY_NAME_LENGTH,
  MAX_CUSTOM_CATEGORIES,
} from "@/domain/entities/category";
import {
  canCreateCategory,
  validateCategoryName,
} from "@/domain/rules/categoryRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { useCategories } from "@/providers/CategoriesProvider";
import {
  createCategory,
  renameCategory,
  setCategoryArchived,
} from "@/services/categoryService";

function RenameDialog({
  userId,
  category,
  onClose,
}: {
  userId: string;
  category: CategoryOption;
  onClose: () => void;
}) {
  const { catalog } = useCategories();
  const [name, setName] = useState(category.label);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateCategoryName(name, catalog, {
      excludeId: category.id,
    });

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    if (validation.name === category.label) {
      onClose();
      return;
    }

    setIsSaving(true);

    try {
      await renameCategory(userId, category.id, validation.name);
      notify("success", "Categoria renomeada com sucesso.");
      onClose();
    } catch (error) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(error, "Falha ao renomear a categoria."),
      );
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear categoria</DialogTitle>
          <DialogDescription>
            O novo nome aparece em todos os lançamentos e orçamentos desta categoria.
          </DialogDescription>
        </DialogHeader>
        <form id="rename-category-form" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="rename-category-name">Nome</Label>
            <Input
              id="rename-category-name"
              value={name}
              maxLength={MAX_CATEGORY_NAME_LENGTH}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <LoadingButton
            type="submit"
            form="rename-category-form"
            isLoading={isSaving}
            loadingText="Salvando..."
          >
            Salvar
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CategoriesPage() {
  const { profile } = useSession();
  const userId = profile.userId;
  const canEdit = canMutateCosts(profile.role);
  const { catalog, customs, isLoading, error } = useCategories();
  // Sem o catalogo atual nao ha como garantir nome unico nem o limite.
  const isUnavailable = isLoading || error !== null;
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [renaming, setRenaming] = useState<CategoryOption | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const reachedLimit = !canCreateCategory(customs);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isUnavailable) {
      return;
    }

    if (reachedLimit) {
      notify(
        "warning",
        `Você atingiu o limite de ${MAX_CUSTOM_CATEGORIES} categorias personalizadas. Renomeie ou reative uma categoria arquivada.`,
      );
      return;
    }

    const validation = validateCategoryName(newName, catalog);

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    setIsCreating(true);

    try {
      await createCategory(userId, validation.name);
      setNewName("");
      notify("success", `Categoria "${validation.name}" criada com sucesso.`);
    } catch (error) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(error, "Falha ao criar a categoria."),
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleArchived(category: CategoryOption) {
    setTogglingId(category.id);

    try {
      await setCategoryArchived(userId, category.id, !category.archived);
      notify(
        "success",
        category.archived
          ? `Categoria "${category.label}" reativada.`
          : `Categoria "${category.label}" arquivada. Lançamentos existentes não são alterados.`,
      );
    } catch (error) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(error, "Falha ao atualizar a categoria."),
      );
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <section className="space-y-10" data-testid="categories-page-screen">
      <PageHeader
        eyebrow="Organização"
        title="Categorias"
        description="Crie categorias próprias para classificar seus custos. Categorias arquivadas deixam de aparecer em novos lançamentos, mas o histórico é preservado."
      />

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>Nova categoria</CardTitle>
            <CardDescription>
              {`${customs.length} de ${MAX_CUSTOM_CATEGORIES} categorias personalizadas em uso.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreate}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              aria-label="Nova categoria"
              noValidate
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="new-category-name">Nome</Label>
                <Input
                  id="new-category-name"
                  value={newName}
                  maxLength={MAX_CATEGORY_NAME_LENGTH}
                  placeholder="Ex.: Pets, Assinaturas, Filhos"
                  onChange={(event) => setNewName(event.target.value)}
                  disabled={isCreating || isUnavailable}
                />
              </div>
              <LoadingButton
                type="submit"
                isLoading={isCreating}
                loadingText="Criando..."
                disabled={isUnavailable}
                icon={<PlusIcon aria-hidden="true" />}
              >
                Adicionar categoria
              </LoadingButton>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Suas categorias</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="py-6 text-destructive" role="alert">
              {error}
            </p>
          ) : isLoading ? (
            <p className="py-6 text-muted-foreground" aria-live="polite">
              Carregando categorias...
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Situação</TableHead>
                  {canEdit && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalog.options.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.label}</TableCell>
                    <TableCell>
                      <Badge variant={category.isDefault ? "secondary" : "outline"}>
                        {category.isDefault ? "Padrão" : "Personalizada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {category.archived ? "Arquivada" : "Ativa"}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        {category.isDefault ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="inline-flex gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Renomear ${category.label}`}
                                  onClick={() => setRenaming(category)}
                                  disabled={togglingId !== null}
                                >
                                  <PencilIcon />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Renomear</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <LoadingButton
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`${category.archived ? "Reativar" : "Arquivar"} ${category.label}`}
                                  onClick={() => void handleToggleArchived(category)}
                                  isLoading={togglingId === category.id}
                                  icon={
                                    category.archived ? (
                                      <ArchiveRestoreIcon />
                                    ) : (
                                      <ArchiveIcon />
                                    )
                                  }
                                  disabled={togglingId !== null}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                {category.archived ? "Reativar" : "Arquivar"}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {renaming && (
        <RenameDialog
          userId={userId}
          category={renaming}
          onClose={() => setRenaming(null)}
        />
      )}
    </section>
  );
}
