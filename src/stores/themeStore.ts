import { create } from "zustand";

export type ColorMode = "light" | "dark";
export type TopbarIconStyle = "real" | "monochrome";

interface ThemeState {
  colorMode: ColorMode;
  topbarIconStyle: TopbarIconStyle;
  initTheme: () => void;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
  setTopbarIconStyle: (style: TopbarIconStyle) => void;
}

const STORAGE_THEME_KEY = "singbox_gui_v0_theme_v2";
const STORAGE_ICON_STYLE_KEY = "singbox_gui_v0_topbar_icon_style_v1";

export const useThemeStore = create<ThemeState>((set, get) => ({
  colorMode: "light",
  topbarIconStyle: "real",
  initTheme: () => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY) as ColorMode | null;
      const mode: ColorMode = saved === "dark" ? "dark" : "light";
      const savedIconStyle = localStorage.getItem(
        STORAGE_ICON_STYLE_KEY
      ) as TopbarIconStyle | null;
      const iconStyle: TopbarIconStyle =
        savedIconStyle === "monochrome" ? "monochrome" : "real";
      document.documentElement.setAttribute("data-color-mode", mode);
      set({ colorMode: mode, topbarIconStyle: iconStyle });
    } catch {
      document.documentElement.setAttribute("data-color-mode", "light");
    }
  },
  toggleColorMode: () => {
    const next: ColorMode = get().colorMode === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-color-mode", next);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, next);
    } catch {}
    set({ colorMode: next });
  },
  setColorMode: (mode: ColorMode) => {
    document.documentElement.setAttribute("data-color-mode", mode);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, mode);
    } catch {}
    set({ colorMode: mode });
  },
  setTopbarIconStyle: (style: TopbarIconStyle) => {
    try {
      localStorage.setItem(STORAGE_ICON_STYLE_KEY, style);
    } catch {}
    set({ topbarIconStyle: style });
  },
}));
