import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeMoneyInput(value: string) {
	return value.replace(/[^\d]/g, "");
}

export function parseMoneyInput(value: string | number) {
	if (typeof value === "number") {
		return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
	}

	const sanitizedValue = sanitizeMoneyInput(value);
	if (!sanitizedValue) {
		return 0;
	}

	const parsedValue = Number(sanitizedValue);
	return Number.isFinite(parsedValue) ? Math.max(0, Math.round(parsedValue)) : 0;
}

export function formatMoneyInput(value: string | number) {
	const parsedValue = parseMoneyInput(value);
	return parsedValue === 0 ? "" : String(parsedValue);
}
