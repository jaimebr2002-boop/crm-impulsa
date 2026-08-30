"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Tema = "light" | "dark";

type ThemeContextValue = {
  tema: Tema;
  alternarTema: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "crm-impulsa:theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => {
    const actual = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTema(actual);
  }, []);

  const alternarTema = useCallback(() => {
    setTema((prev) => {
      const siguiente = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", siguiente === "dark");
      try {
        window.localStorage.setItem(STORAGE_KEY, siguiente);
      } catch {
        // localStorage puede fallar en modo privado; el tema simplemente no persiste.
      }
      return siguiente;
    });
  }, []);

  return <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
