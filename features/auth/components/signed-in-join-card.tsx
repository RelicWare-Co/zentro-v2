import { useLoginPage } from "@/features/auth/login-page-context";

export function SignedInJoinCard() {
  const { state, actions, meta } = useLoginPage();

  if (!(state.sessionEmail && state.sessionName)) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="space-y-2">
        <span className="inline-flex items-center rounded-full border border-[#dfff06]/20 bg-[#dfff06]/10 px-2 py-0.5 font-medium text-[#dfff06] text-xs">
          Ya Iniciaste Sesión
        </span>
        <p className="font-semibold text-lg text-white">{state.sessionName}</p>
        <p className="text-sm text-zinc-400">{state.sessionEmail}</p>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <button
          className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg bg-[#dfff06] px-3 font-medium text-black text-sm transition-colors hover:bg-[#c9e605] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            state.isSessionPending || state.isCompletingJoin || !meta.canJoin
          }
          onClick={() => {
            actions.handleJoinWithCurrentAccount().catch(() => undefined);
          }}
          type="button"
        >
          {state.isCompletingJoin
            ? "Entrando a la organización…"
            : "Continuar con esta cuenta"}
        </button>
        <button
          className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 bg-transparent px-3 font-medium text-sm text-zinc-200 transition-colors hover:bg-white/5 hover:text-white"
          onClick={() => {
            actions.signOutAndReload().catch(() => undefined);
          }}
          type="button"
        >
          Usar otra cuenta
        </button>
      </div>
    </div>
  );
}
