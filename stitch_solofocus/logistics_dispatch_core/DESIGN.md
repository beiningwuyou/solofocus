---
name: Logistics Dispatch Core
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf6'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dde9ff'
  surface-container-highest: '#d3e3ff'
  on-surface: '#0b1c30'
  on-surface-variant: '#4c4546'
  inverse-surface: '#213146'
  inverse-on-surface: '#ebf1ff'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#016d35'
  on-secondary: '#ffffff'
  secondary-container: '#9bf7af'
  on-secondary-container: '#0f743b'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001b3f'
  on-tertiary-container: '#4d83db'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#9bf7af'
  secondary-fixed-dim: '#7fda95'
  on-secondary-fixed: '#00210c'
  on-secondary-fixed-variant: '#005226'
  tertiary-fixed: '#d7e3ff'
  tertiary-fixed-dim: '#abc7ff'
  on-tertiary-fixed: '#001b3f'
  on-tertiary-fixed-variant: '#00458f'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e3ff'
typography:
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Manrope
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Manrope
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  title-sm:
    fontFamily: Manrope
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.5rem
  gutter-desktop: 1.25rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style
The design system reflects a high-density, mission-critical operational cockpit for modern supply chain orchestration and fleet intelligence. The aesthetic bridges the structural rigor of Material Design 3 with the precision-tooled utility of professional enterprise software. 

Targeting dispatch controllers, route planners, and supply chain analysts, the interface establishes an atmosphere of controlled speed, absolute clarity, and low cognitive fatigue under sustained monitoring. Rather than leaning on loud consumer accents, it employs cool slate-tinted structural surfaces, surgical micro-dividers, crisp geometric typography, and high-impact semantic indicators (such as live transit emeralds and alert ambers) to direct focus instantly toward critical variances.

## Colors
The palette utilizes layered tonal cool whites and soft slate blues to establish clean perceptual hierarchy across high-density layouts without relying on aggressive bounding borders.

- **Base Canvas & Surfaces**:
  - `surface-base`: `#f8f9ff` (Soft tinted cool canvas)
  - `surface-container-lowest`: `#ffffff` (Pure white for elevated actionable cards and modal dialogs)
  - `surface-container-low`: `#eff4ff` (Slightly recessed grouping bays and secondary toolbars)
  - `surface-container-mid`: `#e5efff` (Active states, table row hover, and structured panels)
  - `surface-container-high`: `#dce9ff` (Muted input backgrounds, segment rails, and tag tracks)
  - `surface-variant`: `#d3e4fe` (Structural fills and pressed state backgrounds)

- **Ink Hierarchy**:
  - `on-surface-strong`: `#000000` (Key metrics, primary button labels, and high-emphasis focal points)
  - `on-surface`: `#0b1c30` (Primary headers, tabular text, and active interface elements)
  - `on-surface-muted`: `#435269` (Secondary labels, metadata strings, and column headers)
  - `on-surface-subtle`: `#73839c` (Disabled states, placeholder values, and inactive icons)

- **Semantic & Accents**:
  - `action-primary`: `#000000` background with `#ffffff` text for definitive commitments.
  - `status-success`: `#006d35` (Text/icons) paired with `#8df9a8` (Badge background) or `#e7f9ee` (Micro-row tint).
  - `status-warning`: `#945300` paired with `#ffe8cc` (Triage states and customs holds).
  - `status-critical`: `#ba1a1a` paired with `#ffdad6` (Exceptions, breakdown alerts, missed SLAs).
  - `status-info`: `#195bb0` paired with `#d7e3ff` (In-route notices and normal telematics).

- **Dividers & Structural Rules**:
  - `border-hairline`: `rgba(11, 28, 48, 0.08)` for subtle data grids.
  - `border-subtle`: `rgba(11, 28, 48, 0.14)` for card perimeters and nested splitters.

## Typography
Typographic discipline is split strictly by function:

- **Manrope** is reserved for display headers, operational metrics, and card titles. Its modernist geometric structure delivers clarity at larger scale and ensures numerical KPIs (e.g., manifest totals, transit times, weight metrics) anchor the eye quickly.
- **Inter** handles all running data bodies, micro-labels, tabular data, and telemetry stream outputs. Its tall x-height and neutral grotesque forms prevent optical bleeding across crowded data matrices and multi-column manifests.

Tabular data cells containing weights, currencies, coordinate readings, and timestamps must always enable tabular figures (`font-variant-numeric: tabular-nums`) to preserve optical vertical alignment across dense ledger tables.

## Layout & Spacing
The layout model operates on a tight 4px baseline rhythm optimized for information-dense desktop and terminal environments while remaining responsive across field-tablet surfaces.

- **Grid Architecture**: 
  - Desktop: 12-column adaptive layout with a locked left rail navigation (64px collapsed, 240px expanded) and dynamic main pane.
  - Multi-pane Split: Center telemetry/table view occupies 8 columns, while contextual inspector/waybill trays snap to the remaining 4 columns.
  - Tablet (768px - 1024px): 8-column layout; secondary panels collapse into floating bottom sheets or overlay drawers.
  - Mobile (<768px): 4-column layout with fixed top dispatch app bar, single-column stacked cards, and sticky bottom critical actions.

- **Rhythm Rules**:
  - Operational metrics and table rows utilize tight horizontal and vertical padding (`space-xs` and `space-sm`) to maximize visible payload without sacrificing touch target accessibility.
  - Card gutters and modular pane divisions rely on `space-md` (12px) to `space-lg` (16px). Outer perimeter boundaries utilize responsive `margin` tokens.

## Elevation & Depth
Depth in this design system is primarily tonal rather than spatial. Instead of relying on heavy drop shadows that blur visual boundaries in high-density data views, hierarchy is communicated through precise chromatic transitions and surface nesting:

- **Level 0 (Canvas Base)**: `#f8f9ff` establishes the overall ambient ground plane.
- **Level 1 (Structural Containers)**: `#eff4ff` forms recessed side panels, persistent filters, and secondary grouping containers.
- **Level 2 (Raised Functional Cards & Work Surfaces)**: `#ffffff` provides the highest optical contrast against the cool tinted canvas. These surfaces receive a razor-thin structural line (`1px solid rgba(11, 28, 48, 0.08)`) accompanied by an ambient micro-shadow: `0 1px 2px rgba(11, 28, 48, 0.04), 0 2px 6px rgba(11, 28, 48, 0.02)`.
- **Level 3 (Interactive Floating Elements)**: Flyouts, typeahead results, and context menus maintain `#ffffff` fill with a firmer dual shadow: `0 4px 14px rgba(11, 28, 48, 0.08), 0 1px 3px rgba(11, 28, 48, 0.04)` paired with `border: 1px solid rgba(11, 28, 48, 0.12)`.
- **Level 4 (Modals & Hazard Overlays)**: Centered blocking modals sit over a semi-transparent slate wash (`rgba(11, 28, 48, 0.4)` with 4px backdrop blur), bounded by clean 1px borders.

## Shapes
The shape philosophy favors compact, engineered corner radii that maintain a structured, instrument-grade appearance. Expansive, oversized curves are avoided in favor of crisp, disciplined perimeters:

- `rounded-xs` (2px): Badges, telemetry indicators, status pips, and inner progress tracks.
- `rounded-sm` (4px): Form inputs, table action buttons, data chips, micro-toggles, and segmented controls.
- `rounded-md` (8px): Primary operational cards, alert callouts, data table containers, and flyout menus.
- `rounded-lg` (12px): Standalone modals and overlay dialogs only.
- Circles (`rounded-full`): Solely reserved for user avatars, radial status dots, and icon-only auxiliary actions.

## Components

### Buttons
- **Primary Action**: Solid high-contrast black (`#000000`) fill with white (`#ffffff`) text, 4px border radius, 36px height (desktop compact), 8px horizontal padding. Subtle hover state transitions to `#1e293b`. Focus rings use a 2px offset ring in `#195bb0`.
- **Secondary Action**: Background `#eff4ff`, text `#0b1c30`, border `1px solid #d3e4fe`. Hover shifts to `#dce9ff`.
- **Ghost / Table Inline Action**: Transparent background, text `#435269`, hover background `#eff4ff`, border radius 4px.

### Status Chips & Badges
- Compact height (20px to 24px) with uppercase `label-sm` tracking.
- **In Transit / Active**: Background `#8df9a8` at 30% opacity, solid `#006d35` label, featuring a 6px pulsing emerald indicator dot.
- **Exception / Delayed**: Background `#ffdad6`, solid `#ba1a1a` label.
- **Pending / Docked**: Background `#dce9ff`, text `#0b1c30`.

### Data Tables & Micro-Dividers
- Header rows utilize `#eff4ff` with uppercase `label-md` text tinted `#435269`, separated by a single hairline divider (`1px solid rgba(11, 28, 48, 0.08)`).
- Row height is locked to a dense 40px, transitioning on hover to `#e5efff`. 
- Vertical micro-dividers (`1px solid rgba(11, 28, 48, 0.04)`) separate pinned status columns and tracking identifiers.

### Form Inputs & Filters
- Compact inputs (32px to 36px height) using `#ffffff` or `#eff4ff` resting fill, wrapped in a 1px border (`rgba(11, 28, 48, 0.12)`), corner radius 4px.
- Active focus transitions the border to `#000000` or `#195bb0` with an instantaneous 1px glow, eliminating fuzzy outlines.
- Embedded leading icons (e.g., search, carrier tags) tint to `#73839c`.

### Checkboxes & Radios
- 16px × 16px geometric squares/circles with 2px corner radius for checkboxes.
- Unchecked: 1.5px border in `#73839c`, clean white fill.
- Checked: `#000000` fill with white check glyph.

### Cards & Telemetry Tiles
- Structural container with `#ffffff` fill, 8px radius, and a dual subtle border (`1px solid rgba(11, 28, 48, 0.08)`).
- Metric headers display a muted `title-sm` Inter label, paired with a dominant `headline-md` Manrope figure in pure `#000000`, accompanied by micro trend chips positioned in the top right corner.