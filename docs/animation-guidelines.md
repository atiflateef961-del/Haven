# Animation and Motion Plan (Phase 0)

Framer Motion (`framer-motion`) is the sole planned primary motion library. The required single source of truth will be `apps/web/src/lib/motion.ts`; components import named variants rather than scattering magic values. A provider consumes `useReducedMotion`; reduced motion sets durations to zero and disables transforms, permitting opacity-only fades <=120ms. CSS independently disables infinite animations. Do not move keyboard focus through animation; focus rings must remain stable.

## Tokens

```ts
ease = {
  standard: [0.4, 0, 0.2, 1],
  emphasized: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0.2, 1],
  accelerate: [0.3, 0, 1, 1],
  spring: [0.5, 1.6, 0.5, 1],
}
durationMs = { micro: 120, fast: 180, standard: 240, moderate: 320, slow: 420 }
```

## Required named variants and placement

| Name | Motion/timing | Placement |
|---|---|---|
| `fade-in` | opacity 0→1, 200ms decelerate | Content reveal/tooltips |
| `fade-in-up` | opacity + y 8→0, 240ms standard | Cards/sections |
| `fade-in-down` | opacity + y -8→0, 240ms standard | Dropdowns |
| `scale-in` | opacity + scale .96→1, 220ms emphasized | Dialogs/popovers |
| `slide-in-right` | x 24→0, opacity, 300ms standard | Mobile drawer/slideover |
| `slide-in-left` | x -24→0, opacity, 300ms standard | Detail panels |
| `stagger-container` | opacity; children .05s, delay .04s | KPI grids/table rows/nav groups |
| `stagger-item` | fade-in-up, 240ms | Staggered children |
| `lift-on-hover` | y 0→-2, shadow neu-out→neu-hover, 180ms | Cards/widgets |
| `press-down` | scale 1→.98, inset shadow, 120ms | Buttons (`whileTap`) |
| `shimmer` | CSS background position, 1500ms linear infinite | Skeletons |
| `count-up` | motion value 0→value, rounded, 900ms decelerate | KPI values |
| `toast-in` / `toast-out` | x 16→0 spring (~300ms) / x 0→16, 180ms accelerate | Toast lifecycle |
| `page-transition` | AnimatePresence wait; enter fade-up, exit fade | Route change, 240/180ms |
| `sidebar-expand` | width 72↔256, spring 260/30 (~300ms) | Sidebar |
| `drawer-overlay` | opacity 0→1, 200ms | Modal/drawer backdrop |
| `accordion-expand` | height 0→auto + opacity, 280ms | Settings/nested nav |
| `tab-indicator` | shared layoutId, spring 380/32 | Tabs/active nav pill |
| `checkbox-check` | SVG pathLength 0→1, 220ms | Checkbox/radio |
| `switch-toggle` | knob x 0→20 spring 500/30; track 180ms | Toggle |
| `status-pulse` | scale 1→1.25→1, opacity pulse, 1200ms infinite | Live status dot; disabled reduced motion |
| `row-enter` | opacity + y 6→0, 200ms | Table row |
| `skeleton-fade` | content crossfade, 220ms | Loading handoff |
| `bg-aurora-drift` | translate/scale, 24,000ms alternate | Background; paused reduced motion |
| `spinner-ring` | rotate 360°, 900ms linear infinite | Loaders |
| `progress-bar` | width/motion value 0→N, 600ms decelerate | Upload/jobs progress |
| `number-flash` | accent→text color, 600ms | Updated KPI |

Usage map: route/page entrance; sidebar collapse, active indicator, mobile drawer and nested accordion; card stagger/lift/skeleton; button press/hover/spinner; dialog overlay and scale entrance with focus trap/return; field focus and concise validation feedback; dashboard number/chart draw and progress; table row/loading/pagination; bed-tile selection and occupancy transition; toast enter/exit and notification row. Use status pulse sparingly and do not run it with an ambient loop.

## Accessibility, dependencies, budget

- Honor both Framer `useReducedMotion()` and CSS `prefers-reduced-motion`; disable ambient loops and status-pulse when requested.
- Animate primarily opacity and transforms. Never animate layout properties or box-shadow on scroll-triggered motion; short hover/press shadow transitions are allowed.
- Maximum two simultaneous blur layers; maximum one infinite ambient animation at a time. `will-change` only while an element is actively animating and remove afterward.
- Lazy-load below-fold animated sections and defer Lottie. Keep first-load JS attributable to motion under ~40 KB gzipped through tree-shaking.
- Optional only with a documented need: `@formkit/auto-animate` for list reorder; Lottie (`react-lottie`/`@lottiefiles/dotlottie-react`) only complex one-shot illustration, under 40 KB and `loop:false`; React Spring only where Framer physics cannot express the interaction; Motion One only rare non-React micro motion. Prefer not to mix motion systems.
- Reference motion principles: Material Design 3, Apple HIG, easings.net, restrained Linear/Raycast language; do not copy blindly.

Verification in Phase 2 and final QA must inspect reduced-motion behavior, keyboard/focus stability, animation overlap, smoothness on representative mobile hardware, and built JS budget. No performance claim is made in Phase 0.
