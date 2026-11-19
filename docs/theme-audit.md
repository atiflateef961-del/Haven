# Theme audit and verification record

## Theme system

- `apps/web/src/lib/theme.ts` defines the `hms-theme` local storage key and cookie name, with a one-year cookie lifetime.
- Before the fix, `apps/web/src/app/layout.tsx` hard-coded `data-theme="light"` and passed `initialTheme="light"` to the root `ThemeProvider`. The provider wraps the app root, so it includes `/login` as well as protected routes.
- `apps/web/src/components/theme/theme-provider.tsx` is the shared React context/hook. It reads `document.documentElement.dataset.theme`; the toggle updates both `data-theme` and the `dark` class. The app's CSS primarily selects with `html[data-theme="dark"]` / `html[data-theme="light"]`; Tailwind's custom `dark` variant in `globals.css` also recognizes `.dark`.
- `ThemeToggle` is rendered in `AuthPage` for login/register and in `ProtectedWorkspaceShell` for protected pages.
- The original provider did not read or write local storage or cookies. The declared preference keys were unused.

## First-paint diagnosis

Before the fix, the root HTML was explicitly light and there was no pre-hydration initialization. The provider only observed the DOM theme after React hydration, and its toggle changed the DOM only for the current page session. Therefore a fresh request started light on both local and Vercel origins. The origin distinction would matter for a persisted local-storage preference, but the original implementation did not persist one; it was not the underlying code-level cause.

The fix adds a nonce-bearing inline bootstrap in the root layout. It reads local storage, then the theme cookie, then `prefers-color-scheme`, and applies the HTML theme before hydration. The shared toggle now persists to both local storage and the cookie. The root layout reads the cookie for server HTML and keeps `suppressHydrationWarning` on the `<html>` element that receives the early theme.

Local production HTTP verification returned `/login` with the bootstrap script and a script nonce matching the response CSP nonce. A request with `Cookie: hms-theme=dark` returned server HTML with `data-theme="dark"`.

## Pre-fix light-surface inventory

| File and original line | Component/style | Pre-fix value | Dark token used after fix |
|---|---|---|---|
| `apps/web/src/app/globals.css:1788` | Neutral secondary buttons, including card actions and logout | `#FAF6F0` background, `#1F1D1B` text, `#D8D2C4` border | `--surface-elevated`, `--text-primary`, `--border-strong` |
| `apps/web/src/app/globals.css:1670-1722` | Inputs, selects, textareas | `rgb(253 251 247 / 85%)` background and light border overrides | `--bg-secondary`, `--text-primary`, `--border-strong` |
| `apps/web/src/app/globals.css:1836-1842` | Room-availability and bed filters | `rgb(253 251 247 / 85%)`, `#1F1D1B`, `#D8D2C4` | `--bg-secondary`, `--text-primary`, `--border-strong` |
| `apps/web/src/app/globals.css:1868-1885` | Staff KPI cards and table | `--card-ivory` / `--bg-cream-light` light fallbacks, including `#FAF6F0` and `#F5F0EA` | Dark aliases to `--surface-card`, `--bg-secondary`, `--border-subtle`, `--border-strong` |
| `apps/web/src/app/globals.css:1893-1912` | Staff dialog, error, success toast | `#FAF6F0`, `#1F1D1B`, `#D8D2C4` and light fallbacks | `--surface-card`, `--surface-elevated`, `--text-primary`, `--text-secondary`, `--border-strong`, `--destructive-soft` |
| `apps/web/src/app/globals.css:35-49` | Dark glass and neumorphic highlights | Low-opacity `rgb(255 255 255 / …)` highlights | Existing `--accent-champagne` (`#d0b184`) at the same opacities |
| `apps/web/src/app/globals.css:1083` | Destructive button text | `#fff` base declaration | Dark override uses `--text-primary`; existing terracotta button remains |
| `apps/web/src/app/globals.css:1090` | Primary button text | `#fff`, explicitly under light theme | Light-only rule; unchanged |
| `apps/web/src/app/globals.css:1522` | Print stylesheet | `#fff !important` page background | Print-only rule; unchanged |
| `apps/web/src/app/globals.css:82-126` | Light theme surface/glass/shadow tokens | White and near-white values | Explicitly under `html[data-theme="light"]`; unchanged |

The legacy sidebar declaration at original line 1563 had a light background and a `#fff8` highlight; the existing later dark sidebar rule already replaced its background and shadow in dark mode. Its light appearance is intentionally changed only for the Phase 5 typography request.

## Existing palette mapping

| Token | Value in existing dark palette | Source |
|---|---|---|
| `--bg-base` | `#111210` | `globals.css:9` |
| `--bg-secondary` | `#191a17` | `globals.css:10` |
| `--surface-card` | `#22231f` | `globals.css:11` |
| `--surface-elevated` | `#292923` | `globals.css:12` |
| `--accent-champagne` | `#d0b184` | `globals.css:15` |
| `--text-primary` | `#f3eee4` | `globals.css:20` |
| `--text-secondary` | `#aaa69b` | `globals.css:21` |
| `--border-strong` | `rgb(243 238 228 / 14%)` | `globals.css:23` |
| `--destructive-soft` | `rgb(181 103 94 / 14%)` | `globals.css:26` |

Dark aliases for legacy selectors are defined near the dark control overrides at the end of `globals.css`: `--card-ivory` maps to `--surface-card`; `--bg-cream-light` to `--bg-secondary`; `--border-warm` to `--border-strong`; `--border-soft` to `--border-subtle`; `--text-muted` to `--text-secondary`; and `--accent-dark` / `--accent-deep` to `--accent-champagne`.

## Sidebar weight source and change

The bold weight came from the sidebar-specific CSS at `globals.css:1565-1569`, not from the font family or a container. It explicitly set inactive links to 600 and active links to 700. Current styling sets inactive links to 400, active links to 600, and the section label to 11px/600. Hover no longer translates the link. Link minimum height is 2.75rem (44px), and the icon stroke is 1.7px. The font family is unchanged.

Contrast ratios calculated from the CSS color values are: inactive light 8.36:1, active light 5.68:1 on the 10% terracotta tint, light hover 5.53:1 on the 12% tint, inactive dark 7.19:1, and active/hover dark 6.54:1 on the 14% champagne tint.

## Grep counts

Counts compare `HEAD` source with current `apps/web/src` (`tsx`, `ts`, and `css`). These are literal-search counts, not a computed-style/runtime audit.

| Pattern | Before | After | Remaining context |
|---|---:|---:|---|
| `bg-white` | 0 | 0 | None |
| `text-white` | 0 | 0 | None |
| `border-white` | 0 | 0 | None |
| `hover:bg-white` | 0 | 0 | None |
| `#fff` / `#ffff` | 5 | 5 | Light-theme tokens, base destructive text overridden in dark, light primary text, print background |
| `rgb(255` | 13 | 8 | Remaining matches are in light-theme glass/shadow tokens |
| `rgba(255` | 0 | 0 | None |
| `#fff8` | 1 | 1 | Legacy light sidebar shadow; replaced by the dark sidebar shadow rule in dark mode |

## Verification limits

- Production build, lint, typecheck, and automated workspace tests pass (web: 11 tests; API: 276 tests).
- The production server HTML/CSP checks described above pass.
- The repo's browser QA script could not connect to `127.0.0.1:9222` (`ECONNREFUSED`). Chrome headless attempts failed before saving a screenshot, so first-paint visual behavior, console/hydration warnings, responsive screenshots, keyboard interaction, autofill/native controls, and runtime DOM surface audit remain unverified.
- Vercel deployment/live verification was not run: the Vercel CLI is not installed in this environment, and the connected web lookup could not access the deployment URL.
