import { create } from "zustand";

export type ColorMode = "light" | "dark";

interface ThemeState {
  colorMode: ColorMode;
  initTheme: () => void;
  toggleColorMode: () => void;
}

const STORAGE_THEME_KEY = "singbox_gui_v0_theme_v2";

export const useThemeStore = create<ThemeState>((set, get) => ({
  colorMode: "light",
  initTheme: () => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY) as ColorMode | null;
      const mode: ColorMode = saved === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-color-mode", mode);
      set({ colorMode: mode });
    } catch {
      document.documentElement.setAttribute("data-color-mode", "light");
    }
  },
  toggleColorMode: () => {
    const next: ColorMode = get().colorMode === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-color-mode", next);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, next);
    } catch {
      // ignore storage errors
    }
    set({ colorMode: next });
  },
}));
