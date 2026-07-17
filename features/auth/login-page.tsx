import { MessageCircle } from "lucide-react";
import { JoinContextCard } from "@/features/auth/components/join-context-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginModeTabs } from "@/features/auth/components/login-mode-tabs";
import {
  LoginPageContent,
  LoginPageShell,
} from "@/features/auth/components/login-page-shell";
import { RegisterForm } from "@/features/auth/components/register-form";
import { SignedInJoinCard } from "@/features/auth/components/signed-in-join-card";
import {
  LoginPageProvider,
  useLoginPage,
} from "@/features/auth/login-page-context";
import { ZENTRO_WHATSAPP_SUPPORT_URL } from "@/lib/support.shared";

function LoginPageHeader() {
  const { state } = useLoginPage();

  return (
    <div className="space-y-3 text-center">
      <h2 className="font-semibold text-3xl tracking-tight">
        {state.mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}{" "}
        <span className="text-[#dfff06]">Zentro™</span>
      </h2>
      <p className="text-sm text-zinc-400">
        {state.mode === "login"
          ? "Ingresa tus credenciales para acceder."
          : "Regístrate para empezar a vender más."}
      </p>
    </div>
  );
}

function LoginJoinSection() {
  const { state } = useLoginPage();

  if (!state.joinToken) {
    return null;
  }

  return (
    <div className="space-y-3">
      <JoinContextCard joinPreview={state.joinPreview} />
      {state.joinError ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-100 text-sm">
          <p className="font-medium">No se pudo completar el acceso</p>
          <p className="text-red-200/90">{state.joinError}</p>
        </div>
      ) : null}
    </div>
  );
}

function LoginAuthSection() {
  const { state } = useLoginPage();

  if (state.joinToken && state.hasSession) {
    return <SignedInJoinCard />;
  }

  return (
    <>
      <LoginModeTabs />
      <div>{state.mode === "login" ? <LoginForm /> : <RegisterForm />}</div>
    </>
  );
}

function LoginSupportButton() {
  return (
    <a
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 font-semibold text-[15px] text-zinc-200 transition-colors hover:border-[#dfff06]/60 hover:text-white"
      href={ZENTRO_WHATSAPP_SUPPORT_URL}
      rel="noreferrer"
      target="_blank"
    >
      <MessageCircle className="size-4 text-[#dfff06]" />
      Soporte por WhatsApp
    </a>
  );
}

function LoginPageLayout() {
  return (
    <LoginPageShell>
      <LoginPageContent>
        <LoginPageHeader />
        <LoginJoinSection />
        <LoginAuthSection />
        <LoginSupportButton />
      </LoginPageContent>
    </LoginPageShell>
  );
}

export function LoginPage() {
  return (
    <LoginPageProvider>
      <LoginPageLayout />
    </LoginPageProvider>
  );
}
