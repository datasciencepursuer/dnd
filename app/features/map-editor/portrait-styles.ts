export type PortraitArtStyle = "jrpg" | "classic" | "pixel";

export interface PortraitStyleOption {
  value: PortraitArtStyle;
  label: string;
  tooltip: string;
}

export const PORTRAIT_STYLE_OPTIONS: readonly PortraitStyleOption[] = [
  { value: "jrpg",    label: "JRPG",    tooltip: "Best for short characters (Cute)" },
  { value: "pixel",   label: "HD-2D",   tooltip: "Best for medium characters (Standard)" },
  { value: "classic", label: "Classic", tooltip: "Best for tall characters (Cool)" },
] as const;

export const DEFAULT_PORTRAIT_STYLE: PortraitArtStyle = "jrpg";
