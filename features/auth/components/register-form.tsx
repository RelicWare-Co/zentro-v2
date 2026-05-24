import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useId, useState } from "react";
import {
  AuthInlineErrorMessage,
  AuthLabelWithRequired,
  AuthSubmitButton,
} from "@/features/auth/components/auth-ui-primitives";
import { AUTH_INPUT_BASE } from "@/features/auth/login-page.constants.shared";
import { useLoginPage } from "@/features/auth/login-page-context";
import { authClient } from "@/lib/auth-client";

export function RegisterForm() {
  const { state, actions } = useLoginPage();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setIsPending(true);

    const { error } = await authClient.signUp.email({
      email,
      password,
      name: name.trim() || email.split("@")[0],
    });

    if (error) {
      setIsPending(false);
      setErrorMsg(error.message || "No se pudo crear la cuenta.");
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
    submitLabel = "Creando cuenta…";
  } else {
    submitLabel = "Crear cuenta";
  }

  return (
    <form className="space-y-6" onSubmit={handleRegister}>
      <div className="space-y-2">
        <label className="font-semibold text-xs text-zinc-200" htmlFor={nameId}>
          Nombre
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
            <User className="size-4" />
          </div>
          <input
            autoComplete="name"
            className={AUTH_INPUT_BASE}
            disabled={isPending || state.isCompletingJoin}
            id={nameId}
            name="name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Tu nombre…"
            type="text"
            value={name}
          />
        </div>
      </div>

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
        <AuthLabelWithRequired htmlFor={passwordId}>
          Contraseña
        </AuthLabelWithRequired>
        <p className="text-xs text-zinc-500">Mínimo 8 caracteres.</p>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
            <Lock className="size-4" />
          </div>
          <input
            autoComplete="new-password"
            className={`${AUTH_INPUT_BASE} pr-10`}
            disabled={isPending || state.isCompletingJoin}
            id={passwordId}
            minLength={8}
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

      <div className="space-y-2">
        <AuthLabelWithRequired htmlFor={confirmId}>
          Confirmar contraseña
        </AuthLabelWithRequired>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
            <Lock className="size-4" />
          </div>
          <input
            autoComplete="new-password"
            className={`${AUTH_INPUT_BASE} pr-10`}
            disabled={isPending || state.isCompletingJoin}
            id={confirmId}
            minLength={8}
            name="confirmPassword"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••"
            required
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
          />
          <button
            aria-label={
              showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending || state.isCompletingJoin}
            onClick={() =>
              setShowConfirmPassword((currentValue) => !currentValue)
            }
            type="button"
          >
            {showConfirmPassword ? (
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
