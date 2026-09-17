import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "vbs-theme";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function getStoredTheme(): Theme | null {
  try {
    return isTheme(localStorage.getItem(STORAGE_KEY))
      ? (localStorage.getItem(STORAGE_KEY) as Theme)
      : null;
  } catch {
    return null;
  }
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme: Theme | null) {
  if (theme) {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

/**
 * Tracks the active theme. A stored preference wins; otherwise the theme
 * follows `prefers-color-scheme` live, matching tokens.css's own fallback.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [stored, setStored] = useState<Theme | null>(() => getStoredTheme());
  const [system, setSystem] = useState<Theme>(() => getSystemTheme());

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystem(getSystemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const theme = stored ?? system;

  useEffect(() => {
    applyTheme(stored);
  }, [stored]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (e.g. private mode) — theme still applies for this session.
    }
    setStored(next);
  }, []);

  return [theme, setTheme];
}
