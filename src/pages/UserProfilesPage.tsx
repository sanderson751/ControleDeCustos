import { PencilIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { UserProfileEditDialog } from "@/components/users/UserProfileEditDialog";
import type { UserProfile, UserRole } from "@/domain/entities/user";
import { getRoleLabel } from "@/domain/rules/permissions";
import { formatDateBR } from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { useSession } from "@/providers/AuthProvider";
import { listUsers } from "@/services/userService";

const ROLE_BADGE_VARIANT: Record<UserRole, "default" | "secondary" | "outline"> =
  {
    admin: "default",
    standard: "secondary",
    guest: "outline",
  };

export default function UserProfilesPage() {
  const { profile } = useSession();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isActive = true;

    listUsers()
      .then((loadedUsers) => {
        if (isActive) {
          setUsers(loadedUsers);
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        const message = friendlyFirestoreErrorMessage(
          error,
          "Erro ao carregar usuários.",
        );
        setLoadError(message);
        notify("error", message);
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  function handleSaved(updatedUser: UserProfile) {
    setUsers((current) =>
      current.map((user) =>
        user.userId === updatedUser.userId ? updatedUser : user,
      ),
    );
    setEditingUser(null);
  }

  return (
    <section className="space-y-10" data-testid="user-profiles-page-screen">
      <PageHeader
        eyebrow="Administração"
        title="Perfis de usuários"
        description="Gerencie nomes e níveis de acesso de todas as contas."
      />

      {loadError && users.length === 0 ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent>
            {isLoading ? (
              <p className="py-6 text-muted-foreground" aria-live="polite">
                Carregando usuários...
              </p>
            ) : users.length === 0 ? (
              <p className="py-6 text-muted-foreground">
                Nenhum usuário encontrado no sistema.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nome completo</TableHead>
                    <TableHead>Nível de acesso</TableHead>
                    <TableHead>Data de criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="font-medium">
                        {user.displayName}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_BADGE_VARIANT[user.role]}>
                          {getRoleLabel(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateBR(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar usuário ${user.email}`}
                              onClick={() => setEditingUser(user)}
                            >
                              <PencilIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar usuário</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {editingUser && (
        <UserProfileEditDialog
          user={editingUser}
          currentUserId={profile.userId}
          onSaved={handleSaved}
          onClose={() => setEditingUser(null)}
        />
      )}
    </section>
  );
}
