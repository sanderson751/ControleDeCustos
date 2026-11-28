import { Share2Icon, UserMinusIcon, XIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type GroceryList, MAX_INVITE_EMAIL_LENGTH } from "@/domain/entities/grocery";
import { listMemberIds, validateInvite } from "@/domain/rules/groceryShareRules";
import { useListInvites } from "@/hooks/useSharedGrocery";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { ROUTES } from "@/routes/navigation";
import {
  cancelInvite,
  inviteToList,
  removeMember,
  type ShareActor,
} from "@/services/groceryShareService";

type Props = {
  owner: ShareActor;
  list: GroceryList;
  onClose: () => void;
};

const STATUS_LABEL = { pendente: "pendente", aceito: "aceito", recusado: "recusado" } as const;
const OFFLINE_MESSAGE = "Sem conexão: conecte-se para alterar quem participa da lista.";

/** Link enviado a quem foi convidado (nao ha envio automatico de e-mail). */
function inviteLink(): string {
  return `${window.location.origin}${ROUTES.groceryInvites}`;
}

async function shareInviteLink(owner: ShareActor, listName: string) {
  const url = inviteLink();
  const text = `${owner.name} (${owner.email}) convidou você para a lista de mercado "${listName}". Entre com o e-mail convidado:`;

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Lista de mercado", text, url });
      return;
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    notify("success", "Link do convite copiado.");
  } catch {
    notify("warning", `Não foi possível copiar. Envie este link: ${url}`);
  }
}

/**
 * Participantes e convites da lista. Lista concluida: so remover participantes
 * e cancelar convites (nao recebe convite novo).
 */
export function ShareListDialog({ owner, list, onClose }: Props) {
  const { invites, isLoading, error } = useListInvites(owner.uid, list.id, true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const isOpen = list.status === "aberta";
  const members = Object.entries(list.members ?? {}).filter(([uid]) => listMemberIds(list).includes(uid));
  // Aceitos aparecem como participantes.
  const openInvites = invites.filter((invite) => invite.status !== "aceito");

  /** Alteracoes de participantes exigem o servidor (o aceite e conferido por ele). */
  async function run(key: string, action: () => Promise<void>) {
    if (!navigator.onLine) {
      notify("warning", OFFLINE_MESSAGE);
      return;
    }
    setBusy(key);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateInvite({ email, ownerEmail: owner.email, list, invites });
    if (!validation.ok) {
      notify("warning", validation.message);
      return;
    }

    void run("invite", async () => {
      try {
        const previous = invites.find((invite) => invite.email === validation.value) ?? null;
        await inviteToList(owner, list, validation.value, previous);
        setEmail("");
        notify("success", `Convite criado para ${validation.value}. Envie o link para a pessoa entrar com esse e-mail.`);
      } catch (inviteError) {
        notify("error", friendlyFirestoreErrorMessage(inviteError, "Falha ao convidar."));
      }
    });
  }

  function handleRemove(uid: string, memberEmail: string, name: string) {
    void run(`remove-${uid}`, async () => {
      try {
        await removeMember(owner.uid, list.id, { uid, email: memberEmail });
        notify("success", `${name} não participa mais da lista.`);
      } catch (removeError) {
        notify("error", friendlyFirestoreErrorMessage(removeError, "Falha ao remover o participante."));
      }
    });
  }

  function handleCancel(inviteId: string, inviteEmail: string) {
    void run(`cancel-${inviteId}`, async () => {
      try {
        await cancelInvite(inviteId);
        notify("success", `Convite para ${inviteEmail} cancelado.`);
      } catch (cancelError) {
        notify("error", friendlyFirestoreErrorMessage(cancelError, "Falha ao cancelar o convite."));
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar lista</DialogTitle>
          <DialogDescription>
            {isOpen
              ? "Quem você convidar vê esta lista, inclui e marca itens. Só você conclui a compra. O convite aparece em Mercado quando a pessoa entrar com o e-mail convidado."
              : "Compra concluída: a lista não recebe convites novos. Você ainda pode remover participantes e cancelar convites."}
          </DialogDescription>
        </DialogHeader>

        {isOpen && (
          <form onSubmit={handleInvite} aria-label="Novo convite" className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
            <div className="flex-1 space-y-2">
              <Label htmlFor="share-email">E-mail</Label>
              <Input
                id="share-email"
                type="email"
                autoComplete="email"
                value={email}
                maxLength={MAX_INVITE_EMAIL_LENGTH}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy !== null}
              />
            </div>
            <LoadingButton
              type="submit"
              isLoading={busy === "invite"}
              loadingText="Convidando..."
              // Sem os convites carregados nao da para saber se o e-mail ja tem convite.
              disabled={isLoading || (busy !== null && busy !== "invite")}
            >
              Convidar
            </LoadingButton>
          </form>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <section className="space-y-2" aria-labelledby="share-members-title">
          <h3 id="share-members-title" className="text-sm font-medium">
            Participantes
          </h3>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém participa ainda.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {members.map(([uid, member]) => (
                <li key={uid} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <LoadingButton
                    size="sm"
                    variant="ghost"
                    isLoading={busy === `remove-${uid}`}
                    loadingText="Removendo..."
                    disabled={busy !== null}
                    icon={<UserMinusIcon aria-hidden="true" />}
                    aria-label={`Remover ${member.name} da lista`}
                    onClick={() => handleRemove(uid, member.email, member.name)}
                  >
                    Remover
                  </LoadingButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        {openInvites.length > 0 && (
          <section className="space-y-2" aria-labelledby="share-invites-title">
            <h3 id="share-invites-title" className="text-sm font-medium">
              Convites
            </h3>
            <ul className="divide-y rounded-lg border">
              {openInvites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{invite.email}</span>
                    <Badge variant={invite.status === "recusado" ? "outline" : "secondary"}>{STATUS_LABEL[invite.status]}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    aria-label={`Cancelar convite para ${invite.email}`}
                    onClick={() => handleCancel(invite.id, invite.email)}
                  >
                    <XIcon aria-hidden="true" />
                    {invite.status === "pendente" ? "Cancelar" : "Remover"}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isOpen && (
          <Button variant="outline" onClick={() => void shareInviteLink(owner, list.name)}>
            <Share2Icon aria-hidden="true" />
            Enviar link do convite
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
