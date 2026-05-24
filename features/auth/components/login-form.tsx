import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useId, useState } from "react";
import {
  AuthInlineErrorMessage,
  AuthLabelWithRequired,
  AuthSubmitButton,
} from "@/features/auth/components/auth-ui-primitives";
import { AUTH_INPUT_BASE } from "@/features/auth/login-page.constants.shared";
import { useLoginPage } from "@/features/auth/login-page-context";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const { state, actions } = useLoginPage();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsPending(true);
    setErrorMsg(null);

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      setIsPending(false);
      setErrorMsg(error.message || "Credenciales inválidas.");
      return;
    }

    const shouldContinue = await actions.finishJoinFlow();
    setIsPending(false);

    if (shouldContinue) {
      window.location.href = "/dashboard";
    }
  };

  let submitLabel: string;
  if (state.isCompletingJoin) {
    submitLabel = "Completando acceso…";
  } else if (isPending) {
    submitLabel = "Ingresando…";
  } else {
    submitLabel = "Ingresar";
  }

  return (
    <form className="space-y-6" onSubmit={handleLogin}>
      <div className="space-y-2">
        <AuthLabelWithRequired htmlFor={emailId}>
          Correo electrónico
        </AuthLabelWithRequired>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
            <Mail className="size-4" />
          </div>
          <input
            autoComplete="email"
            className={AUTH_INPUT_BASE}
            disabled={isPending || state.isCompletingJoin}
            id={emailId}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@negocio.com…"
            required
            spellCheck={false}
            type="email"
            value={email}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <AuthLabelWithRequired htmlFor={passwordId}>
            Contraseña
          </AuthLabelWithRequired>
          <a className="text-[#dfff06] text-xs hover:underline" href="/">
            ¿Olvidaste tu contraseña?
          </a>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
            <Lock className="size-4" />
          </div>
          <input
            autoComplete="current-password"
            className={`${AUTH_INPUT_BASE} pr-10`}
            disabled={isPending || state.isCompletingJoin}
            id={passwordId}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={
              showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending || state.isCompletingJoin}
            onClick={() => setShowPassword((currentValue) => !currentValue)}
            type="button"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {errorMsg ? <AuthInlineErrorMessage message={errorMsg} /> : null}

      <AuthSubmitButton
        disabled={isPending || state.isCompletingJoin}
        label={submitLabel}
      />
    </form>
  );
}
