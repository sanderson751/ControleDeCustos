import { type FormEvent, useState } from "react";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  USER_ROLES,
  type UserProfile,
  type UserRole,
} from "@/domain/entities/user";
import { getRoleDescription, getRoleLabel } from "@/domain/rules/permissions";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import {
  updateOwnDisplayName,
  updateUserByAdmin,
} from "@/services/userService";

type UserProfileEditDialogProps = {
  user: UserProfile;
  currentUserId: string;
  onSaved: (user: UserProfile) => void;
  onClose: () => void;
};

/** Edicao de nome e nivel de acesso. O admin nao altera o proprio papel (evita perda de acesso). */
export function UserProfileEditDialog({
  user,
  currentUserId,
  onSaved,
  onClose,
}: UserProfileEditDialogProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<UserRole>(user.role);
  const [isSaving, setIsSaving] = useState(false);
  const isSelf = user.userId === currentUserId;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = displayName.trim();

    if (!normalizedName) {
      notify("warning", "Nome completo é obrigatório.");
      return;
    }

    setIsSaving(true);

    try {
      if (isSelf) {
        await updateOwnDisplayName(user.userId, normalizedName);
      } else {
        await updateUserByAdmin(user.userId, {
          displayName: normalizedName,
          role,
        });
      }

      notify("success", "Usuário atualizado com sucesso.");
      onSaved({
        ...user,
        displayName: normalizedName,
        role: isSelf ? user.role : role,
        updatedAt: new Date(),
      });
    } catch (error) {
      notify(
        "error",
        friendlyFirestoreErrorMessage(error, "Erro ao salvar perfil."),
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
          <DialogTitle>
            Editar perfil de usuário
          </DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <form
          id="user-profile-edit-form"
          onSubmit={handleSubmit}
          className="space-y-6"
          aria-busy={isSaving || undefined}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="displayName">Nome completo</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Digite o nome completo"
              disabled={isSaving}
            />
          </div>

          <fieldset className="space-y-3" disabled={isSaving || isSelf}>
            <legend className="mb-3 text-sm font-medium">Nível de acesso</legend>
            {isSelf && (
              <p className="text-sm text-muted-foreground">
                Você não pode alterar o seu próprio nível de acesso.
              </p>
            )}
            <RadioGroup
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
              className="gap-2"
            >
              {USER_ROLES.map((roleOption) => (
                <Label
                  key={roleOption}
                  htmlFor={`role-${roleOption}`}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-ring has-[[data-state=checked]]:bg-accent/40"
                >
                  <RadioGroupItem
                    id={`role-${roleOption}`}
                    value={roleOption}
                    className="mt-0.5"
                  />
                  <span className="space-y-1">
                    <span className="block font-medium">
                      {getRoleLabel(roleOption)}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {getRoleDescription(roleOption)}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <LoadingButton
            type="submit"
            form="user-profile-edit-form"
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
