import type { ReactNode } from "react";

export function LoginPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] w-full bg-[#0f0f0f] text-white">
      <LoginPageBrandPanel />
      {children}
    </div>
  );
}

function LoginPageBrandPanel() {
  return (
    <div className="relative hidden w-1/2 overflow-hidden bg-[#1c1c1c] lg:flex lg:flex-col lg:items-center lg:justify-center">
      <div className="relative z-10 flex flex-col items-center px-8 text-center">
        <h1 className="mb-6 font-semibold text-6xl text-[#dfff06] tracking-tight">
          Zentro
        </h1>
        <p className="max-w-md text-xl text-zinc-400">
          El sistema POS más inteligente para tu negocio
        </p>
      </div>
    </div>
  );
}

export function LoginPageContent({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex w-full flex-col items-center justify-center p-8 sm:p-12 md:p-16 lg:w-1/2 lg:p-24">
      <div className="w-full max-w-[460px] space-y-8">{children}</div>
      <LoginPageFooter />
    </div>
  );
}

function LoginPageFooter() {
  return (
    <div className="absolute bottom-8 left-0 flex w-full flex-col items-center justify-center gap-2 text-xs text-zinc-500">
      <p>2026 Zentro POS System. Todos los derechos reservados.</p>
      <div className="flex gap-4">
        <a className="transition-colors hover:text-zinc-300" href="/">
          Privacidad
        </a>
        <a className="transition-colors hover:text-zinc-300" href="/">
          Términos
        </a>
      </div>
    </div>
  );
}
