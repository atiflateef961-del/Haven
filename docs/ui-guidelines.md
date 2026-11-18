# UI Design System Plan (Phase 0)

Design direction: restrained premium glassmorphism over a warm dark/light neutral system, with subtle neumorphic depth, clear hierarchy, responsive layouts, and purposeful interaction. Dark is default; light is equally polished. Do not use purple, dark-blue headings, neon, excessive glow, generic marketing hero copy, or pill buttons.

## Color tokens

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg-base` | `#111210` | `#F5F1E9` | App canvas |
| `--bg-secondary` | `#191A17` | `#EDE7DC` | Secondary panels / alternating rows |
| `--surface-card` | `#22231F` | `#FFFFFF` | Card base |
| `--surface-elevated` | `#292923` | — | Dark elevated surface |
| `--soft-sand` | — | `#E8E0D3` | Light inset/divider |
| `--muted-bronze` | — | `#765A42` | Light secondary accent |
| `--accent-champagne` | `#D0B184` | — | Dark primary accent |
| `--accent-champagne-soft` | `rgba(208,177,132,0.14)` | — | Dark accent tint |
| `--accent-sage` | `#A7B39E` | `#5E6C56` | Positive state |
| `--accent` | — | `#A16E58` | Light primary accent |
| `--accent-soft` | — | `rgba(161,110,88,0.10)` | Light accent wash |
| `--text-primary` | `#F3EEE4` | `#282822` | Main text/headings |
| `--text-secondary` | `#AAA69B` | `#6B665D` | Supporting text; adjusted to maintain 4.5:1 contrast on light surfaces |
| `--border-subtle` | `rgba(243,238,228,0.08)` | `rgba(118,90,66,0.12)` | Hairline borders |
| `--border-strong` | `rgba(243,238,228,0.14)` | — | Emphasis/focus base |
| `--destructive` | `#B5675E` | `#A24B45` | Destructive state |
| `--destructive-soft` | `rgba(181,103,94,0.14)` | — | Destructive wash |

## Glass tokens and use

| Token | Dark | Light |
|---|---|---|
| `--glass-bg` | `rgba(34,35,31,0.55)` | `rgba(255,255,255,0.60)` |
| `--glass-bg-strong` | `rgba(41,41,35,0.72)` | `rgba(255,255,255,0.78)` |
| `--glass-bg-soft` | `rgba(34,35,31,0.35)` | `rgba(255,255,255,0.45)` |
| `--glass-blur` | `16px` | `14px` |
| `--glass-blur-strong` | `24px` | `22px` |
| `--glass-blur-soft` | `8px` | `7px` |
| `--glass-border` | `1px solid rgba(243,238,228,0.08)` | `1px solid rgba(118,90,66,0.12)` |
| `--glass-highlight` | `inset 0 1px 0 rgba(255,255,255,0.06)` | `inset 0 1px 0 rgba(255,255,255,0.65)` |
| `--glass-saturation` | `140%` | `130%` |

Use prefixed and standard `backdrop-filter: blur(...) saturate(...)`; pair glass with a neumorphic shadow. Use soft blur for chips, default for cards/sidebar, strong for dialogs. At most two glass layers may stack. Keep body text at contrast >= 4.5:1 against the actual composite background. Add `@supports not (backdrop-filter: blur(1px))` opaque surface fallback.

The light-theme secondary and positive-state tokens are contrast-tuned to meet 4.5:1 on the base and secondary surfaces. Keep field placeholder text at full opacity so it retains the token contrast.

## Neumorphic shadow tokens

| Token | Dark | Light |
|---|---|---|
| `--neu-out` | `-6px -6px 12px rgba(255,255,255,.025), 6px 6px 12px rgba(0,0,0,.55)` | `-6px -6px 12px rgba(255,255,255,.90), 6px 6px 12px rgba(118,90,66,.22)` |
| `--neu-in` | `inset -3px -3px 6px rgba(255,255,255,.025), inset 3px 3px 6px rgba(0,0,0,.55)` | `inset -3px -3px 6px rgba(255,255,255,.90), inset 3px 3px 6px rgba(118,90,66,.22)` |
| `--neu-hover` | `-6px -6px 14px rgba(255,255,255,.04), 8px 8px 18px rgba(0,0,0,.60), 0 0 0 1px rgba(208,177,132,.18)` | `-6px -6px 14px rgba(255,255,255,1), 8px 8px 18px rgba(118,90,66,.28), 0 0 0 1px rgba(161,110,88,.20)` |
| `--neu-disabled` | `-3px -3px 6px rgba(255,255,255,.015), 3px 3px 6px rgba(0,0,0,.30)` | `-3px -3px 6px rgba(255,255,255,.6), 3px 3px 6px rgba(118,90,66,.10)` |
| `--neu-focus` | `0 0 0 3px rgba(208,177,132,.45)` | `0 0 0 3px rgba(161,110,88,.40)` |

Apply restrained depth to buttons, cards, fields, toggles, tabs, filters, nav, room/bed tiles, dialogs and relevant tables. States: default `neu-out`; hover `neu-hover`; pressed `neu-in`; focus-visible combines `neu-out` plus `neu-focus`; disabled `neu-disabled`, opacity .55 and not-allowed cursor; loading `neu-in` with fixed-size spinner and disabled interaction. Never sacrifice control visibility for the effect.

## Buttons and typography

Geometry: 10px default radius, 12px large; heights 32/40/48px; medium padding 14px 20px; font 600 14px/1. Variants: primary champagne-to-`#C49A66` dark / `--accent` to `#8C5A47` light with dark/white text and soft accent glow; secondary elevated neutral with primary text; ghost transparent with secondary text and inset hover; destructive theme destructive with white text; icon square 40x40 with accessible `aria-label`. Hover lifts subtly; active presses inward; visible focus and disabled/loading state are mandatory. Icon+label gap 8px, icon 16px. No decorative inert controls.

Use Manrope/Inter/system sans, ideally self-hosted via `next/font` with swap: 12/16, 14/20, 16/24, 18/26, 20/28, 24/32 px. Headings use warm ivory/charcoal, h2/h3 weight 600 and page title 700. Avoid oversized type. Support persisted theme selection and system theme where appropriate. Every page has responsive layout, accessible keyboard behavior, explicit loading/error/empty/success states, and no unintended horizontal overflow.

The semantic heading scale maps h1 through h6 to the 24/32, 20/28, 18/26, 16/24, 14/20, and 12/16 tokens. Reusable `.ui-type-*` classes expose those same sizes for non-heading text without changing semantic roles.

## Ambient background surface

One global fixed layer sits above base background and behind app content: 2–3 large, soft champagne/sage radial aurora blobs at ~6–9% opacity; subtle edge vignette (`rgba(0,0,0,.18)` dark, `rgba(118,90,66,.06)` light); lightweight reusable SVG `feTurbulence` grain at 2–3% opacity with overlay blend. Blobs drift slowly only when motion is allowed. Under `prefers-reduced-motion`, keep static. Ambient motion stays behind content, never competes, and must not create more than one active ambient loop.
