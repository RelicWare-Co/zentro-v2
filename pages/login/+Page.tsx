import { useState, useId, useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { authClient } from "../../lib/auth-client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { orpcQuery } from "../../server/orpc/client/query";
import { queryClient } from "../../lib/query-client";
import { formatOrganizationRoleLabel } from "../../lib/organization-shared";
import {
	Building2,
	Eye,
	EyeOff,
	Lock,
	Mail,
	User,
} from "lucide-react";

function useJoinToken() {
	if (typeof window !== "undefined") {
		return new URLSearchParams(window.location.search).get("token");
	}
	return null;
}

const inputBase =
	"w-full pl-10 h-11 bg-[#1c1c1c] border-white/10 text-white placeholder:text-zinc-500 focus-visible:border-[var(--color-voltage)] focus-visible:ring-[var(--color-voltage)]/20 rounded-xl";

function getErrorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

export default function Page() {
	const pageContext = usePageContext();
	const joinToken = useJoinToken();
	const { data: sessionData, isPending: isSessionPending } =
		authClient.useSession();

	const [mode, setMode] = useState<"login" | "register">("login");
	const [joinError, setJoinError] = useState<string | null>(null);
	const [isCompletingJoin, setIsCompletingJoin] = useState(false);

	const previewQuery = useQuery({
		...orpcQuery.organization.joinLinkPreview.queryOptions({
			input: { token: joinToken ?? "" },
		}),
		enabled: !!joinToken,
	});

	const redeemMutation = useMutation({
		...orpcQuery.organization.joinLinkRedeem.mutationOptions(),
	});

	const finishJoinFlow = async (): Promise<boolean> => {
		if (!joinToken) {
			return true;
		}

		setJoinError(null);
		setIsCompletingJoin(true);

		try {
			const result = await redeemMutation.mutateAsync({ token: joinToken });
			await authClient.organization.setActive({
				organizationId: result.organizationId,
			});
			queryClient.clear();
			return true;
		} catch (error: unknown) {
			setJoinError(
				getErrorMessage(
					error,
					"No se pudo completar el acceso con este enlace.",
				),
			);
			return false;
		} finally {
			setIsCompletingJoin(false);
		}
	};

	const handleJoinWithCurrentAccount = async () => {
		const shouldContinue = await finishJoinFlow();
		if (shouldContinue) {
			window.location.href = "/dashboard";
		}
	};

	const joinPreview = previewQuery.data ?? null;

	useEffect(() => {
		const user = pageContext.user ?? sessionData?.user;
		if (user && !joinToken && typeof window !== "undefined") {
			window.location.href = "/dashboard";
		}
	}, [pageContext.user, sessionData, joinToken]);

	return (
		<div className="flex min-h-[100dvh] w-full bg-[#0f0f0f] text-white">
			<div className="relative hidden w-1/2 overflow-hidden bg-[#1c1c1c] lg:flex lg:flex-col lg:items-center lg:justify-center">
				<div className="relative z-10 flex flex-col items-center px-8 text-center">
					<h1 className="mb-6 text-6xl font-semibold tracking-tight text-[#dfff06]">
						Zentro
					</h1>
					<p className="max-w-md text-xl text-zinc-400">
						El sistema POS más inteligente para tu negocio
					</p>
				</div>
			</div>

			<div className="relative flex w-full flex-col items-center justify-center p-8 sm:p-12 md:p-16 lg:w-1/2 lg:p-24">
				<div className="w-full max-w-[460px] space-y-8">
					<div className="space-y-3 text-center">
						<h2 className="text-3xl font-semibold tracking-tight">
							{mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}{" "}
							<span className="text-[#dfff06]">Zentro™</span>
						</h2>
						<p className="text-sm text-zinc-400">
							{mode === "login"
								? "Ingresa tus credenciales para acceder."
								: "Regístrate para empezar a vender más."}
						</p>
					</div>

					{joinToken ? (
						<div className="space-y-3">
							<JoinContextCard joinPreview={joinPreview} />
							{joinError ? (
								<div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
									<p className="font-medium">No se pudo completar el acceso</p>
									<p className="text-red-200/90">{joinError}</p>
								</div>
							) : null}
						</div>
					) : null}

					{joinToken && sessionData ? (
						<CardForSignedInUser
							isSessionPending={isSessionPending}
							isCompletingJoin={isCompletingJoin}
							sessionName={sessionData.user.name}
							sessionEmail={sessionData.user.email}
							canJoin={Boolean(joinPreview?.canJoin)}
							onJoin={handleJoinWithCurrentAccount}
							onSwitchAccount={async () => {
								await authClient.signOut();
								window.location.reload();
							}}
						/>
					) : (
						<>
							<div className="mb-6 flex w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
								<button
									type="button"
									onClick={() => setMode("login")}
									className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors cursor-pointer ${
										mode === "login"
											? "bg-[#dfff06] text-black shadow-sm"
											: "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
									}`}
								>
									Iniciar sesión
								</button>
								<button
									type="button"
									onClick={() => setMode("register")}
									className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors cursor-pointer ${
										mode === "register"
											? "bg-[#dfff06] text-black shadow-sm"
											: "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
									}`}
								>
									Registrarse
								</button>
							</div>

							<div>
								{mode === "login" ? (
									<LoginForm
										isCompletingJoin={isCompletingJoin}
										onAuthenticated={finishJoinFlow}
									/>
								) : (
									<RegisterForm
										isCompletingJoin={isCompletingJoin}
										onAuthenticated={finishJoinFlow}
									/>
								)}
							</div>
						</>
					)}
				</div>

				<div className="absolute bottom-8 left-0 flex w-full flex-col items-center justify-center gap-2 text-xs text-zinc-500">
					<p>2026 Zentro POS System. Todos los derechos reservados.</p>
					<div className="flex gap-4">
						<a href="/" className="transition-colors hover:text-zinc-300">
							Privacidad
						</a>
						<a href="/" className="transition-colors hover:text-zinc-300">
							Términos
						</a>
					</div>
				</div>
			</div>
		</div>
	);
}

function LoginForm(props: {
	isCompletingJoin: boolean;
	onAuthenticated: () => Promise<boolean>;
}) {
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

		const shouldContinue = await props.onAuthenticated();
		setIsPending(false);

		if (shouldContinue) {
			window.location.href = "/dashboard";
		}
	};

	return (
		<form className="space-y-6" onSubmit={handleLogin}>
			<div className="space-y-2">
				<LabelWithRequired htmlFor={emailId}>
					Correo electrónico
				</LabelWithRequired>
				<div className="relative">
					<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
						<Mail className="size-4" />
					</div>
					<input
						id={emailId}
						name="email"
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						disabled={isPending || props.isCompletingJoin}
						placeholder="tu@negocio.com…"
						autoComplete="email"
						spellCheck={false}
						className={inputBase}
						required
					/>
				</div>
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<LabelWithRequired htmlFor={passwordId}>Contraseña</LabelWithRequired>
					<a
						href="/"
						className="text-xs text-[#dfff06] hover:underline"
					>
						¿Olvidaste tu contraseña?
					</a>
				</div>
				<div className="relative">
					<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
						<Lock className="size-4" />
					</div>
					<input
						id={passwordId}
						name="password"
						type={showPassword ? "text" : "password"}
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						disabled={isPending || props.isCompletingJoin}
						placeholder="••••••••"
						autoComplete="current-password"
						className={`${inputBase} pr-10`}
						required
					/>
					<button
						type="button"
						onClick={() => setShowPassword((currentValue) => !currentValue)}
						disabled={isPending || props.isCompletingJoin}
						className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
						aria-label={
							showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
						}
					>
						{showPassword ? (
							<EyeOff className="size-4" />
						) : (
							<Eye className="size-4" />
						)}
					</button>
				</div>
			</div>

			{errorMsg ? <InlineErrorMessage message={errorMsg} /> : null}

			<button
				type="submit"
				disabled={isPending || props.isCompletingJoin}
				className="h-11 w-full rounded-xl bg-[#dfff06] text-[15px] font-semibold text-black hover:bg-[#c9e605] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
			>
				{props.isCompletingJoin
					? "Completando acceso…"
					: isPending
						? "Ingresando…"
						: "Ingresar"}
			</button>
		</form>
	);
}

function RegisterForm(props: {
	isCompletingJoin: boolean;
	onAuthenticated: () => Promise<boolean>;
}) {
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

		const shouldContinue = await props.onAuthenticated();
		setIsPending(false);

		if (shouldContinue) {
			window.location.href = "/dashboard";
		}
	};

	return (
		<form className="space-y-6" onSubmit={handleRegister}>
			<div className="space-y-2">
				<label
					htmlFor={nameId}
					className="text-xs font-semibold text-zinc-200"
				>
					Nombre
				</label>
				<div className="relative">
					<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
						<User className="size-4" />
					</div>
					<input
						id={nameId}
						name="name"
						type="text"
						value={name}
						onChange={(event) => setName(event.target.value)}
						disabled={isPending || props.isCompletingJoin}
						placeholder="Tu nombre…"
						autoComplete="name"
						className={inputBase}
					/>
				</div>
			</div>

			<div className="space-y-2">
				<LabelWithRequired htmlFor={emailId}>
					Correo electrónico
				</LabelWithRequired>
				<div className="relative">
					<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
						<Mail className="size-4" />
					</div>
					<input
						id={emailId}
						name="email"
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						disabled={isPending || props.isCompletingJoin}
						placeholder="tu@negocio.com…"
						autoComplete="email"
						spellCheck={false}
						className={inputBase}
						required
					/>
				</div>
			</div>

			<div className="space-y-2">
				<LabelWithRequired htmlFor={passwordId}>Contraseña</LabelWithRequired>
				<p className="text-xs text-zinc-500">Mínimo 8 caracteres.</p>
				<div className="relative">
					<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
						<Lock className="size-4" />
					</div>
					<input
						id={passwordId}
						name="password"
						type={showPassword ? "text" : "password"}
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						disabled={isPending || props.isCompletingJoin}
						placeholder="••••••••"
						autoComplete="new-password"
						className={`${inputBase} pr-10`}
						required
						minLength={8}
					/>
					<button
						type="button"
						onClick={() => setShowPassword((currentValue) => !currentValue)}
						disabled={isPending || props.isCompletingJoin}
						className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
						aria-label={
							showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
						}
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
				<LabelWithRequired htmlFor={confirmId}>
					Confirmar contraseña
				</LabelWithRequired>
				<div className="relative">
					<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
						<Lock className="size-4" />
					</div>
					<input
						id={confirmId}
						name="confirmPassword"
						type={showConfirmPassword ? "text" : "password"}
						value={confirmPassword}
						onChange={(event) => setConfirmPassword(event.target.value)}
						disabled={isPending || props.isCompletingJoin}
						placeholder="••••••••"
						autoComplete="new-password"
						className={`${inputBase} pr-10`}
						required
						minLength={8}
					/>
					<button
						type="button"
						onClick={() =>
							setShowConfirmPassword((currentValue) => !currentValue)
						}
						disabled={isPending || props.isCompletingJoin}
						className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
						aria-label={
							showConfirmPassword
								? "Ocultar contraseña"
								: "Mostrar contraseña"
						}
					>
						{showConfirmPassword ? (
							<EyeOff className="size-4" />
						) : (
							<Eye className="size-4" />
						)}
					</button>
				</div>
			</div>

			{errorMsg ? <InlineErrorMessage message={errorMsg} /> : null}

			<button
				type="submit"
				disabled={isPending || props.isCompletingJoin}
				className="h-11 w-full rounded-xl bg-[#dfff06] text-[15px] font-semibold text-black hover:bg-[#c9e605] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
			>
				{props.isCompletingJoin
					? "Completando acceso…"
					: isPending
						? "Creando cuenta…"
						: "Crear cuenta"}
			</button>
		</form>
	);
}

function CardForSignedInUser(props: {
	isSessionPending: boolean;
	isCompletingJoin: boolean;
	sessionName: string;
	sessionEmail: string;
	canJoin: boolean;
	onJoin: () => Promise<void>;
	onSwitchAccount: () => Promise<void>;
}) {
	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
			<div className="space-y-2">
				<span className="inline-flex items-center rounded-full border border-[#dfff06]/20 bg-[#dfff06]/10 px-2 py-0.5 text-xs font-medium text-[#dfff06]">
					Ya Iniciaste Sesión
				</span>
				<p className="text-lg font-semibold text-white">{props.sessionName}</p>
				<p className="text-sm text-zinc-400">{props.sessionEmail}</p>
			</div>
			<div className="mt-5 flex flex-col gap-3">
				<button
					type="button"
					onClick={() => void props.onJoin()}
					disabled={
						props.isSessionPending || props.isCompletingJoin || !props.canJoin
					}
					className="inline-flex h-9 items-center justify-center rounded-lg bg-[#dfff06] px-3 text-sm font-medium text-black hover:bg-[#c9e605] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
				>
					{props.isCompletingJoin
						? "Entrando a la organización…"
						: "Continuar con esta cuenta"}
				</button>
				<button
					type="button"
					onClick={() => void props.onSwitchAccount()}
					className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-700 bg-transparent px-3 text-sm font-medium text-zinc-200 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
				>
					Usar otra cuenta
				</button>
			</div>
		</div>
	);
}

function JoinContextCard(props: {
	joinPreview: {
		status?: string;
		canJoin?: boolean;
		message?: string | null;
		organization?: {
			id?: string;
			name?: string;
			slug?: string;
		} | null;
		role?: string | null;
		label?: string | null;
	} | null;
}) {
	if (!props.joinPreview) {
		return null;
	}

	if (!props.joinPreview.organization) {
		return (
			<div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
				<p className="font-medium">Enlace no disponible</p>
				<p className="text-red-200/90">{props.joinPreview.message}</p>
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
			<div className="flex items-start gap-3">
				<div className="mt-0.5 rounded-xl bg-[#dfff06]/10 p-2 text-[#dfff06]">
					<Building2 className="size-4" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-semibold text-white">
						{props.joinPreview.organization.name}
					</p>
					<p className="text-sm text-zinc-400">
						/{props.joinPreview.organization.slug}
					</p>
					<div className="mt-3 flex flex-wrap gap-2">
						<span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-200">
							{formatOrganizationRoleLabel(props.joinPreview.role)}
						</span>
						{props.joinPreview.label ? (
							<span className="inline-flex items-center rounded-full border border-zinc-700 bg-transparent px-2 py-0.5 text-xs font-medium text-zinc-300">
								{props.joinPreview.label}
							</span>
						) : null}
					</div>
					<p className="mt-3 text-sm text-zinc-400">
						{props.joinPreview.canJoin
							? "Cuando termines de iniciar sesión o crear tu cuenta entrarás directo a esta organización."
							: props.joinPreview.message}
					</p>
				</div>
			</div>
		</div>
	);
}

function LabelWithRequired(props: {
	htmlFor: string;
	children: React.ReactNode;
}) {
	return (
		<label
			htmlFor={props.htmlFor}
			className="text-xs font-semibold text-zinc-200"
		>
			{props.children} <span className="text-red-500">*</span>
		</label>
	);
}

function InlineErrorMessage(props: { message: string }) {
	return (
		<div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200">
			{props.message}
		</div>
	);
}
