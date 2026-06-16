/**
 * Shared Mantine style overrides for the customers feature.
 *
 * The customers screens render on a dark void/carbon surface with voltage
 * accents, so Mantine's default light components need explicit dark styling.
 * Centralizing the overrides here keeps the migrated components consistent
 * (Modalidad A — coexistencia: Mantine for structure, Tailwind for layout).
 */

const CARBON = "var(--color-carbon)";
const ZINC_700 = "#3f3f46";
const ZINC_800 = "#27272a";
const INPUT_BG = "rgba(0, 0, 0, 0.2)";

/** Dark text input / textarea look (black/20 bg, zinc-700 border). */
export const darkInputStyles = {
  input: {
    backgroundColor: INPUT_BG,
    borderColor: ZINC_700,
    color: "#fff",
  },
  label: { color: "#e4e4e7" },
} as const;

/** Dark Select (input + floating dropdown on carbon surface). */
export const darkSelectStyles = {
  input: {
    backgroundColor: INPUT_BG,
    borderColor: ZINC_700,
    color: "#fff",
  },
  dropdown: {
    backgroundColor: CARBON,
    borderColor: ZINC_800,
    color: "#fff",
  },
  option: { color: "#fff" },
} as const;

/** Dark Drawer (carbon content/header surface, zinc borders). */
export const darkDrawerStyles = {
  content: { backgroundColor: CARBON, color: "#fff" },
  header: {
    backgroundColor: CARBON,
    color: "#fff",
    borderBottom: `1px solid ${ZINC_800}`,
  },
  body: { padding: 0 },
  title: { fontSize: "1.5rem", fontWeight: 700 },
} as const;

/** Dark Modal (carbon content surface). */
export const darkModalStyles = {
  content: { backgroundColor: CARBON, color: "#fff" },
  header: { backgroundColor: CARBON, color: "#fff" },
} as const;
