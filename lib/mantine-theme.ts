import {
  Combobox,
  type CSSVariablesResolver,
  createTheme,
  Drawer,
  type MantineColorsTuple,
  Menu,
  Modal,
  NativeSelect,
  Popover,
  Select,
  Textarea,
  TextInput,
} from "@mantine/core";

/**
 * Brand → Mantine theme mapping.
 *
 * The shadcn theme uses a near-black `--primary` (carbon) for solid actions and
 * `voltage` (#dfff06) as the bright accent. We expose both as Mantine color
 * scales so components can opt into either. `colorScheme` is forced to light —
 * the app has no dark mode.
 */

export const brandColors = {
  photon: "#ffffff",
  voltage: "#dfff06",
  voltageHover: "#c7e600",
  carbon: "#1c1c1c",
  void: "#0f0f0f",
  posCanvas: "#0a0a0a",
  posPanel: "#111111",
  posSurface: "#151515",
  posMuted: "#6b6b6b",
} as const;

export const brandColorCssVars = {
  photon: "--mantine-color-white",
  voltage: "--mantine-color-voltage-5",
  voltageHover: "--mantine-color-voltage-6",
  carbon: "--mantine-color-carbon-8",
  void: "--mantine-color-carbon-9",
  posCanvas: "--zentro-color-pos-canvas",
  posPanel: "--zentro-color-pos-panel",
  posSurface: "--zentro-color-pos-surface",
  posMuted: "--zentro-color-pos-muted",
} as const;

// Bright lime/yellow-green brand accent.
const voltage: MantineColorsTuple = [
  "#fbffe4",
  "#f5ffcb",
  "#ecff99",
  "#e3ff61",
  "#dbff33",
  brandColors.voltage,
  brandColors.voltageHover,
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
  brandColors.carbon,
  brandColors.void,
];

const darkSurface = "var(--color-carbon)";
const zinc800 = "#27272a";
const textOnDark = "#fff";

const darkInputClassNames = {
  input:
    "[--zentro-mantine-input-bg:rgba(0,0,0,0.2)] [--zentro-mantine-input-border:#3f3f46] border-[var(--zentro-mantine-input-border)] bg-[var(--zentro-mantine-input-bg)] text-white",
  label: "text-zinc-200",
} as const;

const darkSelectClassNames = {
  ...darkInputClassNames,
  dropdown:
    "zentro-overlay [--zentro-mantine-select-bg:var(--color-carbon)] [--zentro-mantine-select-border:#27272a] border-[var(--zentro-mantine-select-border)] bg-[var(--zentro-mantine-select-bg)] text-white",
  option: "text-white",
} as const;

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
  components: {
    TextInput: TextInput.extend({ classNames: darkInputClassNames }),
    Textarea: Textarea.extend({ classNames: darkInputClassNames }),
    Select: Select.extend({ classNames: darkSelectClassNames }),
    NativeSelect: NativeSelect.extend({ classNames: darkSelectClassNames }),
    Modal: Modal.extend({
      classNames: { content: "zentro-overlay" },
      defaultProps: {
        closeButtonProps: { "aria-label": "Cerrar diálogo" },
      },
      styles: {
        content: { backgroundColor: darkSurface, color: textOnDark },
        header: { backgroundColor: darkSurface, color: textOnDark },
      },
    }),
    Drawer: Drawer.extend({
      classNames: { content: "zentro-overlay" },
      defaultProps: {
        closeButtonProps: { "aria-label": "Cerrar panel" },
      },
      styles: {
        content: {
          backgroundColor: darkSurface,
          color: textOnDark,
          display: "flex",
          flexDirection: "column",
        },
        header: {
          backgroundColor: darkSurface,
          color: textOnDark,
          borderBottom: `1px solid ${zinc800}`,
        },
        body: { padding: 0, flex: 1, minHeight: 0, overflow: "hidden" },
        title: { fontSize: "1.5rem", fontWeight: 700 },
      },
    }),
    Popover: Popover.extend({
      classNames: { dropdown: "zentro-overlay" },
      styles: {
        dropdown: {
          backgroundColor: darkSurface,
          borderColor: zinc800,
          color: textOnDark,
        },
      },
    }),
    Menu: Menu.extend({
      classNames: { dropdown: "zentro-overlay" },
      styles: {
        dropdown: {
          backgroundColor: darkSurface,
          borderColor: zinc800,
          color: textOnDark,
        },
        item: { color: textOnDark },
      },
    }),
    Combobox: Combobox.extend({
      classNames: { dropdown: "zentro-overlay" },
    }),
  },
});

export const mantineCssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    [brandColorCssVars.posCanvas]: brandColors.posCanvas,
    [brandColorCssVars.posPanel]: brandColors.posPanel,
    [brandColorCssVars.posSurface]: brandColors.posSurface,
    [brandColorCssVars.posMuted]: brandColors.posMuted,
  },
  light: {},
  dark: {},
});
