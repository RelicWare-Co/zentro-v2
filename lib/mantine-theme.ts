import {
  ActionIcon,
  Badge,
  Checkbox,
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
  Switch,
  Tabs,
  Textarea,
  TextInput,
} from "@mantine/core";

/**
 * Brand → Mantine theme mapping.
 *
 * The shadcn theme uses a near-black `--primary` (carbon) for solid actions
 * and `voltage` (#dfff06) as the bright accent. We expose both as Mantine
 * color scales so components can opt into either. `colorScheme` is forced
 * to `dark` because every app surface (including auth) is built on the
 * void/carbon dark canvas; Mantine's light scheme produced invisible
 * outline/subtle gray buttons and white-on-lime switch thumbs that do not
 * belong on those surfaces.
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
    "bg-black/20! border-[#3f3f46]! text-white! placeholder:text-zinc-500! focus-visible:border-[var(--color-voltage)]",
  label: "text-zinc-200!",
} as const;

const darkSelectClassNames = {
  ...darkInputClassNames,
  dropdown:
    "zentro-overlay border-[#27272a]! bg-[var(--color-carbon)]! text-white!",
  option: "text-white!",
} as const;

export const mantineTheme = createTheme({
  colors: {
    voltage,
    carbon,
  },
  primaryColor: "carbon",
  // Solid buttons use the near-black carbon shade (any scheme).
  primaryShade: 9,
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
        header: {
          backgroundColor: darkSurface,
          borderBottom: `1px solid ${zinc800}`,
          color: textOnDark,
        },
        title: {
          fontSize: "1.25rem",
          fontWeight: 700,
          letterSpacing: "-0.01em",
        },
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
    // Voltage-checked tracks use a dark thumb (lime is light) so the thumb
    // contrasts with the green surface — Mantine's default thumb is
    // `--mantine-color-white` regardless of colorScheme, which disappears on
    // the lime accent. We pin the thumb to black via the cascading CSS var
    // that Mantine's thumb background reads from.
    Switch: Switch.extend({
      classNames: {
        root: "[--switch-thumb-bg:var(--mantine-color-black)]",
        label: "text-zinc-200",
      },
    }),
    Checkbox: Checkbox.extend({
      classNames: {
        icon: "text-black!",
        label: "text-zinc-200",
      },
    }),
    // ActionIcon outline/subtle variants used for table row affordances must
    // read on dark surfaces — set a dark border + light text by default so
    // the gray variants the app uses everywhere stop disappearing.
    ActionIcon: ActionIcon.extend({
      classNames: {
        root: "[&[data-variant='outline']]:border-zinc-700! [&[data-variant='outline']]:text-zinc-300! [&[data-variant='outline']]:hover:bg-white/5 [&[data-variant='outline']]:hover:border-zinc-500 [&[data-variant='outline']]:hover:text-white! [&[data-variant='subtle']]:text-zinc-400 [&[data-variant='subtle']]:hover:bg-white/5 [&[data-variant='subtle']]:hover:text-white",
      },
    }),
    // Status/dot badges used inside dark cards need a translucent dark
    // backing so they read on dark surfaces. We scope that to the uncolored
    // default + outline variants; colored `light`/`filled` badges keep
    // their accent color (text-zinc-300 would mute them).
    Badge: Badge.extend({
      classNames: {
        root: "[&[data-variant='outline']]:bg-white/5 [&[data-variant='outline']]:border-zinc-700! [&[data-variant='outline']]:hover:bg-white/5 [&[data-variant='default']]:bg-zinc-800! [&[data-variant='default']]:border-zinc-700! [&[data-variant='default']]:text-zinc-200!",
      },
    }),
    // Tabs gain a "relief" segmented-control style: pill list inside a
    // rounded translucent dark panel; inactive tabs are zinc, hover is a
    // subtle light overlay, active is voltage-tinted with a voltage glow.
    Tabs: Tabs.extend({
      classNames: {
        list: "rounded-xl border border-zinc-800! bg-black/30 p-1 [--tabs-list-border-width:0px]",
        tab: "rounded-lg font-medium text-zinc-400! hover:text-white! hover:bg-white/5 data-[active]:text-[var(--color-voltage)]! data-[active]:bg-[var(--color-voltage)]/10 data-[active]:hover:bg-[var(--color-voltage)]/20",
      },
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
