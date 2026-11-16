export const palette = {
  light: {
    ink: "#242521",
    muted: "#60635B",
    subtle: "#73766D",
    accent: "#FF8224",
    accentInk: "#242521",
    link: "#A63B08",
    cream: "#FFF3E7",
    background: "#FAFAF8",
    surface: "#FFFFFF",
    raised: "#F1F2ED",
    border: "#DFE2D8",
    green: "#216448",
    greenSoft: "#EAF3EC",
    danger: "#AF3038",
    dangerSoft: "#FBECEE",
    overlay: "#161C285C",
  },
  dark: {
    ink: "#ECEEE6",
    muted: "#B1B6A8",
    subtle: "#A0A698",
    accent: "#FF923F",
    accentInk: "#242521",
    link: "#FFAA6B",
    cream: "#30271E",
    background: "#171916",
    surface: "#20231E",
    raised: "#2A2E26",
    border: "#41463B",
    green: "#94D6AE",
    greenSoft: "#23382C",
    danger: "#FFB1B7",
    dangerSoft: "#43262D",
    overlay: "#00000099",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  section: 48,
} as const;
export const radius = { small: 6, control: 10, card: 16, sheet: 24 } as const;
export const motion = {
  easeOut: [0.23, 1, 0.32, 1] as const,
  easeInOut: [0.77, 0, 0.175, 1] as const,
  easeDrawer: [0.32, 0.72, 0, 1] as const,
  feedback: 120,
  enter: 200,
  exit: 160,
  drawer: 240,
} as const;

export type ThemeColors = { [K in keyof typeof palette.light]: string };
