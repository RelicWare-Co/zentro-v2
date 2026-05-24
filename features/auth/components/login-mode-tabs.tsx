import type { LoginPageMode } from "@/features/auth/login-page.constants.shared";
import { useLoginPage } from "@/features/auth/login-page-context";

export function LoginModeTabs() {
  const { state, actions } = useLoginPage();

  return (
    <div className="mb-6 flex w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
      <LoginModeTab
        active={state.mode === "login"}
        label="Iniciar sesión"
        mode="login"
        onSelect={actions.setMode}
      />
      <LoginModeTab
        active={state.mode === "register"}
        label="Registrarse"
        mode="register"
        onSelect={actions.setMode}
      />
    </div>
  );
}

function LoginModeTab({
  active,
  label,
  mode,
  onSelect,
}: {
  active: boolean;
  label: string;
  mode: LoginPageMode;
  onSelect: (mode: LoginPageMode) => void;
}) {
  return (
    <button
      className={`flex-1 cursor-pointer rounded-lg py-2.5 font-medium text-sm transition-colors ${
        active
          ? "bg-[#dfff06] text-black shadow-sm"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
      }`}
      onClick={() => onSelect(mode)}
      type="button"
    >
      {label}
    </button>
  );
}
