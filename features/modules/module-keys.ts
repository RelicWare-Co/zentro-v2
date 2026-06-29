export const MODULE_KEYS = ["restaurants"] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
