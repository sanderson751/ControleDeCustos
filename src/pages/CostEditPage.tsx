import { Loader2Icon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { CostFormFields } from "@/components/costs/CostFormFields";
import {
  EMPTY_COST_FORM,
  fromCostEntry,
  toCostFormValues,
  type CostFormState,
} from "@/components/costs/costFormState";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { validateCostForm } from "@/domain/rules/costRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { useCategories } from "@/providers/CategoriesProvider";
import { ROUTES, withCompetence } from "@/routes/navigation";
import { getCostEntryById, updateCostEntry } from "@/services/costService";

export default function CostEditPage() {
  const { costId = "" } = useParams<{ costId: string }>();
  const { profile } = useSession();
  const navigate = useNavigate();
  const userId = profile.userId;
  const canMutate = canMutateCosts(profile.role);
  const categories = useCategories();

  const [form, setForm] = useState<CostFormState>(EMPTY_COST_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [backTarget, setBackTarget] = useState<string>(ROUTES.costs);

  useEffect(() => {
    if (!canMutate) {
      return;
    }

    let isActive = true;
    const goBack = () => navigate(ROUTES.costs, { replace: true });

    getCostEntryById(userId, costId)
      .then((entry) => {
        if (!isActive) {
          return;
        }

        if (!entry) {
          notify("warning", "Custo não encontrado para edição.");
          goBack();
          return;
        }

        setForm(fromCostEntry(entry));
        // Volta para a competencia do lancamento (preserva ?mes=).
        setBackTarget(
          withCompetence(ROUTES.costs, {
            year: entry.competenceYear,
            month: entry.competenceMonth,
          }),
        );
        setIsLoading(false);
      })
      .catch((loadError: unknown) => {
        if (!isActive) {
          return;
        }

        notify(
          "error",
          friendlyFirestoreErrorMessage(
            loadError,
            "Falha ao carregar custo para edição.",
          ),
        );
        goBack();
      });

    return () => {
      isActive = false;
    };
  }, [canMutate, costId, navigate, userId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Categoria inexistente no catalogo (ex.: legado) seria negada pelas regras.
    if (
      !categories.isLoading &&
      !categories.error &&
      form.category &&
      !categories.catalog.ids.includes(form.category)
    ) {
      setForm((current) => ({ ...current, category: "" }));
      notify(
        "warning",
        "A categoria deste lançamento não está mais disponível. Selecione outra.",
      );
      return;
    }

    const validation = validateCostForm(toCostFormValues(form));

    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    setIsSaving(true);

    try {
      await updateCostEntry(userId, costId, validation.values);
      notify("success", "Custo atualizado com sucesso.");
      navigate(backTarget);
    } catch (saveError) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(
          saveError,
          "Falha ao atualizar custo. Tente novamente.",
        ),
      );
      setIsSaving(false);
    }
  }

  const breadcrumb = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={backTarget}>Custos</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Editar custo</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  if (!canMutate) {
    return (
      <section className="space-y-6">
        {breadcrumb}
        <Alert>
          <AlertDescription>
            Você não possui permissão para editar custos.
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  return (
    <section className="space-y-8" data-testid="cost-edit-page-screen">
      {breadcrumb}
      <PageHeader eyebrow="Lançamento" title="Editar custo" />

      <Card>
        <CardContent>
          {isLoading ? (
            <p
              className="flex items-center gap-2 text-muted-foreground"
              aria-live="polite"
              aria-busy="true"
            >
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
              Carregando formulário de edição...
            </p>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-6"
              aria-label="Editar custo"
              noValidate
            >
              <div className="grid gap-5 md:grid-cols-2">
                <CostFormFields
                  idPrefix="edit-cost"
                  value={form}
                  onChange={setForm}
                  disabled={isSaving}
                  keepArchivedCategory
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <LoadingButton
                  type="submit"
                  isLoading={isSaving}
                  loadingText="Salvando..."
                >
                  Salvar alterações
                </LoadingButton>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(backTarget)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
