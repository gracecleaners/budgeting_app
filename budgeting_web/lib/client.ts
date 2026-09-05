export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type Theme = "light" | "dark" | "system";

/** Applies the theme class to <html> and persists it in localStorage. */
export function applyTheme(theme: Theme): void {
  localStorage.setItem("fin_theme", theme);
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/** Restores the saved theme (call once in the app shell on mount). */
export function restoreTheme(): void {
  const saved = (localStorage.getItem("fin_theme") as Theme | null) ?? "system";
  applyTheme(saved);
}
