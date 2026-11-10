import { create } from "zustand";
import { setSystemTrayIconStyle } from "../services/tauriGateway";

export type ColorMode = "light" | "dark";
export type TopbarIconStyle = "real" | "monochrome";

interface ThemeState {
  colorMode: ColorMode;
  topbarIconStyle: TopbarIconStyle;
  advancedMode: boolean;
  initTheme: () => void;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
  setTopbarIconStyle: (style: TopbarIconStyle) => void;
  setAdvancedMode: (enabled: boolean) => void;
  toggleAdvancedMode: () => void;
}

export const STORAGE_THEME_KEY = "singbox_gui_v0_theme_v2";
export const STORAGE_ICON_STYLE_KEY = "singbox_gui_v0_tray_icon_style_v2";
export const STORAGE_ADVANCED_MODE_KEY = "singbox_gui_v0_advanced_mode_v1";

export const useThemeStore = create<ThemeState>((set, get) => ({
  colorMode: "light",
  topbarIconStyle: "monochrome",
  advancedMode: false,
  initTheme: () => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY) as ColorMode | null;
      const mode: ColorMode = saved === "dark" ? "dark" : "light";
      const savedIconStyle = localStorage.getItem(
        STORAGE_ICON_STYLE_KEY
      ) as TopbarIconStyle | null;
      const iconStyle: TopbarIconStyle =
        savedIconStyle === "real" ? "real" : "monochrome";
      const savedAdvanced = localStorage.getItem(STORAGE_ADVANCED_MODE_KEY);
      const advancedMode = savedAdvanced === "true";

      document.documentElement.setAttribute("data-color-mode", mode);
      set({ colorMode: mode, topbarIconStyle: iconStyle, advancedMode });
      void setSystemTrayIconStyle(iconStyle);
    } catch {
      document.documentElement.setAttribute("data-color-mode", "light");
      void setSystemTrayIconStyle("monochrome");
    }
  },
  toggleColorMode: () => {
    const next: ColorMode = get().colorMode === "dark" ? "light" : "dark";
    get().setColorMode(next);
  },
  setColorMode: (mode: ColorMode) => {
    document.documentElement.setAttribute("data-color-mode", mode);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, mode);
    } catch {
      // ignore
    }
    set({ colorMode: mode });
  },
  setTopbarIconStyle: (style: TopbarIconStyle) => {
    try {
      localStorage.setItem(STORAGE_ICON_STYLE_KEY, style);
    } catch {
      // ignore
    }
    set({ topbarIconStyle: style });
    void setSystemTrayIconStyle(style);
  },
  setAdvancedMode: (enabled: boolean) => {
    try {
      localStorage.setItem(STORAGE_ADVANCED_MODE_KEY, String(enabled));
    } catch {
      // ignore
    }
    set({ advancedMode: enabled });
  },
  toggleAdvancedMode: () => {
    get().setAdvancedMode(!get().advancedMode);
  },
}));
