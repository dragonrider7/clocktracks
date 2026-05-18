import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "forest" | "sunset";

export const THEMES: { value: Theme; label: string; dot: string; preview: string }[] = [
  { value: "light",  label: "Light",  dot: "bg-blue-500",   preview: "bg-white border-blue-200" },
  { value: "dark",   label: "Dark",   dot: "bg-slate-700",  preview: "bg-slate-800 border-slate-600" },
  { value: "forest", label: "Forest", dot: "bg-emerald-600", preview: "bg-white border-emerald-200" },
  { value: "sunset", label: "Sunset", dot: "bg-orange-500",  preview: "bg-white border-orange-200" },
];

type ThemeContextType = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType>({ theme: "light", setTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = "timeclock-theme";
const VALID: Theme[] = ["light", "dark", "forest", "sunset"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && VALID.includes(stored)) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    VALID.forEach((t) => root.classList.remove(t));
    if (theme !== "light") root.classList.add(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}
