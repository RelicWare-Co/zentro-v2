import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * Brand → Mantine theme mapping.
 *
 * The shadcn theme uses a near-black `--primary` (carbon) for solid actions and
 * `voltage` (#dfff06) as the bright accent. We expose both as Mantine color
 * scales so components can opt into either. `colorScheme` is forced to light —
 * the app has no dark mode.
 */

// Bright lime/yellow-green brand accent, anchored at #dfff06.
const voltage: MantineColorsTuple = [
  "#fbffe4",
  "#f5ffcb",
  "#ecff99",
  "#e3ff61",
  "#dbff33",
  "#dfff06", // brand voltage
  "#c7e600",
  "#9eb800",
  "#7c9000",
  "#5a6900",
];

// Neutral dark scale used for the near-black solid primary (carbon/void).
const carbon: MantineColorsTuple = [
  "#f5f5f5",
  "#e7e7e7",
  "#cdcdcd",
  "#b2b2b2",
  "#9a9a9a",
  "#8b8b8b",
  "#848484",
  "#717171",
  "#1c1c1c", // carbon
  "#0f0f0f", // void
];

export const mantineTheme = createTheme({
  colors: {
    voltage,
    carbon,
  },
  primaryColor: "carbon",
  // Solid buttons use the near-black carbon shade in light mode.
  primaryShade: { light: 8, dark: 9 },
  // Mirror Tailwind `--radius: 0.625rem`.
  defaultRadius: "0.625rem",
  // Inherit the font stack defined by the global stylesheet / Tailwind.
  fontFamily: "inherit",
  headings: { fontFamily: "inherit" },
});
