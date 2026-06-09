import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_KEY, nextTheme);
      applyTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, toggleTheme, setTheme };
}
