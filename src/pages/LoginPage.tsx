import { ArrowRightIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyAuthErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import {
  loginWithEmailAndPassword,
  loginWithGoogle,
  registerWithEmailAndPassword,
} from "@/services/authService";

type AuthMode = "login" | "register";

const MODE_OPTIONS = [
  { value: "login", label: "Já tenho conta" },
  { value: "register", label: "Quero criar conta" },
] as const;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.42-1.66 4.17-5.35 4.17-3.22 0-5.85-2.67-5.85-5.95S8.78 6.35 12 6.35c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.79 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<"email" | "google" | null>(
    null,
  );
  const isRegister = mode === "register";
  const isBusy = pendingAction !== null;

  function handleError(error: unknown) {
    const message = friendlyAuthErrorMessage(error);
    setErrorMessage(message);
    notify("error", message);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!email.trim() || !password) {
      const message = "Informe email e senha.";
      setErrorMessage(message);
      notify("warning", message);
      return;
    }

    setPendingAction("email");

    try {
      if (isRegister) {
        await registerWithEmailAndPassword(name, email, password);
        notify("success", "Conta criada com sucesso.");
      } else {
        await loginWithEmailAndPassword(email, password);
      }
      // O redirecionamento acontece via PublicOnlyRoute quando a sessao fica ativa.
    } catch (error) {
      handleError(error);
      setPendingAction(null);
    }
  }

  async function handleGoogleLogin() {
    setErrorMessage("");
    setPendingAction("google");

    try {
      await loginWithGoogle();
    } catch (error) {
      handleError(error);
      setPendingAction(null);
    }
  }

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[1.1fr_1fr]">
      <section
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{
          background:
            "linear-gradient(rgb(15, 16, 17), rgb(19, 29, 39) 18%, rgb(26, 71, 136) 37%, rgb(64, 138, 193) 69%, rgb(64, 138, 193) 102%)",
        }}
        aria-hidden="true"
      >
        <p className="eyebrow text-white/80">Controle de Custos</p>
        <div className="space-y-6 text-white">
          <h2 className="font-display-light text-display text-white">
            Seu dinheiro, <em className="italic">com clareza</em>.
          </h2>
          <p className="max-w-md text-subheading font-light text-white/85">
            Registre custos fixos e variáveis, acompanhe o mês corrente e
            exporte relatórios em segundos.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-white/15 bg-white/12 px-6 py-2 font-mono text-[11px] font-medium tracking-[0.16em] text-[#fafafa] uppercase">
          Firebase · Firestore · React
        </span>
      </section>

      <main className="flex items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-3">
            <p className="eyebrow text-muted-foreground">
              {isRegister ? "Nova conta" : "Bem-vindo de volta"}
            </p>
            <h1 className="text-heading-lg">
              {isRegister ? "Criar conta" : "Entrar"}
            </h1>
          </div>

          <SegmentedControl
            ariaLabel="Modo de autenticação"
            value={mode}
            options={MODE_OPTIONS}
            onChange={(nextMode) => {
              setMode(nextMode);
              setErrorMessage("");
            }}
            disabled={isBusy}
            className="w-full [&>button]:flex-1"
          />

          {errorMessage && (
            <Alert variant="destructive" role="alert" aria-live="polite">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  disabled={isBusy}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                disabled={isBusy}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
                disabled={isBusy}
              />
            </div>

            <div className="space-y-3 pt-2">
              <LoadingButton
                type="submit"
                size="lg"
                className="w-full"
                isLoading={pendingAction === "email"}
                loadingText={isRegister ? "Criando conta..." : "Entrando..."}
                disabled={isBusy}
              >
                {isRegister ? "Criar conta" : "Entrar"}
                <ArrowRightIcon aria-hidden="true" />
              </LoadingButton>

              <LoadingButton
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => void handleGoogleLogin()}
                isLoading={pendingAction === "google"}
                loadingText="Conectando com Google..."
                icon={<GoogleIcon />}
                disabled={isBusy}
              >
                Entrar com Google
              </LoadingButton>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
