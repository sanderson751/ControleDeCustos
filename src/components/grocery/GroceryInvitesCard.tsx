import { CheckIcon, MailCheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GroceryInvite } from "@/domain/entities/grocery";
import { friendlyAuthErrorMessage, friendlyFirestoreErrorMessage, getErrorCode } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { ROUTES } from "@/routes/navigation";
import { sendVerificationEmail } from "@/services/authService";
import { acceptInvite, declineInvite, type ShareActor } from "@/services/groceryShareService";

const OFFLINE_MESSAGE = "Sem conexão: conecte-se para responder ao convite.";

/** Aceite negado: a lista mudou depois do convite (concluida, excluida, cheia ou convite cancelado). */
function acceptErrorMessage(error: unknown): string {
  const code = getErrorCode(error);
  if (code === "permission-denied" || code === "not-found") {
    return "Não foi possível aceitar: a lista foi concluída, excluída, está cheia ou o convite foi cancelado. Você pode recusar o convite.";
  }
  return friendlyFirestoreErrorMessage(error, "Falha ao aceitar o convite.");
}

type Props = {
  actor: ShareActor;
  emailVerified: boolean;
  invites: readonly GroceryInvite[];
  onRecheckEmail: () => Promise<boolean>;
};

/**
 * Convites para listas de outras pessoas. Sem e-mail confirmado os convites
 * nao aparecem (as regras exigem): mostra como confirmar.
 */
export function GroceryInvitesCard({ actor, emailVerified, invites, onRecheckEmail }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<void>, needsConnection = true) {
    if (needsConnection && !navigator.onLine) {
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

  if (!emailVerified) {
    return (
      <Card role="region" aria-labelledby="invites-verify-title">
        <CardHeader>
          <CardTitle id="invites-verify-title" className="text-xl">
            Confirme seu e-mail para receber convites
          </CardTitle>
          <CardDescription>
            {`Listas compartilhadas com ${actor.email} aparecem aqui depois que você confirmar o e-mail.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <LoadingButton
            variant="outline"
            isLoading={busy === "send"}
            loadingText="Enviando..."
            icon={<MailCheckIcon aria-hidden="true" />}
            onClick={() =>
              void run("send", async () => {
                try {
                  await sendVerificationEmail();
                  notify("success", `Enviamos o link de confirmação para ${actor.email}.`);
                } catch (sendError) {
                  notify("error", friendlyAuthErrorMessage(sendError));
                }
              })
            }
          >
            Enviar e-mail de confirmação
          </LoadingButton>
          <LoadingButton
            variant="ghost"
            isLoading={busy === "check"}
            loadingText="Conferindo..."
            onClick={() =>
              void run("check", async () => {
                try {
                  const verified = await onRecheckEmail();
                  notify(
                    verified ? "success" : "warning",
                    verified ? "E-mail confirmado." : "O e-mail ainda não foi confirmado. Abra o link que enviamos.",
                  );
                } catch (checkError) {
                  notify("error", friendlyAuthErrorMessage(checkError));
                }
              })
            }
          >
            Já confirmei
          </LoadingButton>
        </CardContent>
      </Card>
    );
  }

  if (invites.length === 0) return null;

  return (
    <Card role="region" aria-labelledby="invites-title">
      <CardHeader>
        <CardTitle id="invites-title" className="text-xl">
          Convites para listas
        </CardTitle>
        <CardDescription>Ao aceitar, você vê a lista e pode montá-la junto. Só quem convidou conclui a compra.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
              <p className="min-w-0">
                <span className="font-medium">{invite.ownerName || "Alguém"}</span>
                {invite.ownerEmail && <span className="text-muted-foreground">{` (${invite.ownerEmail})`}</span>}
                {` convidou você para a lista `}
                <span className="font-medium">{`"${invite.listName}"`}</span>
              </p>
              <div className="flex gap-2">
                <LoadingButton
                  size="sm"
                  isLoading={busy === `accept-${invite.id}`}
                  loadingText="Entrando..."
                  disabled={busy !== null}
                  icon={<CheckIcon aria-hidden="true" />}
                  aria-label={`Aceitar convite para ${invite.listName}`}
                  onClick={() =>
                    void run(`accept-${invite.id}`, async () => {
                      try {
                        await acceptInvite(invite, actor);
                        notify("success", `Você agora participa da lista "${invite.listName}".`);
                        navigate(ROUTES.sharedGroceryList(invite.ownerId, invite.listId));
                      } catch (acceptError) {
                        notify("error", acceptErrorMessage(acceptError));
                      }
                    })
                  }
                >
                  Aceitar
                </LoadingButton>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  aria-label={`Recusar convite para ${invite.listName}`}
                  onClick={() =>
                    void run(`decline-${invite.id}`, async () => {
                      try {
                        await declineInvite(invite.id);
                        notify("success", "Convite recusado.");
                      } catch (declineError) {
                        notify("error", friendlyFirestoreErrorMessage(declineError, "Falha ao recusar o convite."));
                      }
                    })
                  }
                >
                  <XIcon aria-hidden="true" />
                  Recusar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
