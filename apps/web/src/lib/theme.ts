export const THEME_COOKIE_NAME = "hms-theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const THEME_STORAGE_KEY = "hms-theme";

export type Theme = "dark" | "light";

export function isTheme(value: string | undefined): value is Theme {
  return value === "dark" || value === "light";
}
