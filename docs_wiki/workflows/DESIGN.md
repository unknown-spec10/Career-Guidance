---
name: Career Guidance AI
colors:
  surface: '#f7f9ff'
  surface-dim: '#d7dadf'
  surface-bright: '#f7f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4f9'
  surface-container: '#ebeef3'
  surface-container-high: '#e5e8ee'
  surface-container-highest: '#e0e3e8'
  on-surface: '#181c20'
  on-surface-variant: '#434751'
  inverse-surface: '#2d3135'
  inverse-on-surface: '#eef1f6'
  outline: '#737783'
  outline-variant: '#c3c6d3'
  surface-tint: '#2c5cad'
  primary: '#003f8b'
  on-primary: '#ffffff'
  primary-container: '#2557a7'
  on-primary-container: '#bdd0ff'
  inverse-primary: '#adc6ff'
  secondary: '#4b5e8a'
  on-secondary: '#ffffff'
  secondary-container: '#b8cbfe'
  on-secondary-container: '#425581'
  tertiary: '#003f8b'
  on-tertiary: '#ffffff'
  tertiary-container: '#0055b8'
  on-tertiary-container: '#bcd0ff'
  error: '#f43f5e'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#024493'
  secondary-fixed: '#d9e2ff'
  secondary-fixed-dim: '#b3c6f8'
  on-secondary-fixed: '#021a43'
  on-secondary-fixed-variant: '#334670'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#f7f9ff'
  on-background: '#181c20'
  surface-variant: '#e0e3e8'
  success: '#10b981'
  warning: '#f59e0b'
  interactive-purple: '#a855f7'
  surface-muted: '#f8f9fa'
  border-subtle: '#e9ecef'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.01em
  display-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-base:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-bold:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  metadata:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1280px
---

## Brand & Style

The design system is rooted in the "Academic Modern" aesthetic—a blend of high-utility **Corporate Modernism** and **Minimalism**. It is designed to evoke a sense of stability, authority, and intelligent support. The target audience includes students and job seekers who require a focused environment for high-stakes decision-making.

The visual narrative relies on "Structured Clarity." This is achieved through generous whitespace, a strictly governed grid, and a technical layer of AI-centric details. While the foundation is solid and trustworthy, the interface features "active intelligence" through subtle glow effects, smooth state transitions, and high-precision data visualizations. The emotional response should be one of empowerment: the user feels they are using a sophisticated tool that is both powerful and easy to master.

**Style Guidelines:**
- **Professionalism:** Use clean, high-contrast surfaces (white canvas) paired with deep navy accents.
- **Intelligence:** Implement smooth shimmers for loading states and pulsing micro-animations for active AI processes (like resume parsing).
- **Accessibility:** Maintain high contrast ratios and clear focus states to support diverse user needs in stressful career-seeking contexts.

## Colors

The palette is anchored by **Academic Navy Blue**, chosen for its deep association with education and professional services. 

### Palette Roles
- **Primary (#2557a7):** Used for all high-intent actions, primary brand elements, and active navigation states.
- **Secondary (#0e244d):** Reserved for high-density headers and authoritative structural backgrounds to provide grounding.
- **Tertiary (#3b82f6):** Applied to AI-specific highlights and informational "Recommendation" states.
- **Neutral (#212529):** The standard for typography and deep structural borders, ensuring maximum legibility.

### Semantic States
Functional logic is mapped to specific hues to provide instant feedback:
- **Success/Approved:** Emerald green for positive terminal states.
- **Warning/Pending:** Amber yellow for items requiring attention or processing.
- **Error/Rejected:** Rose red for critical alerts or failed applications.
- **Interviewing:** A vibrant purple used to distinguish active engagement phases from standard administrative statuses.

## Typography

The typography system uses a tri-font approach to balance personality, readability, and technical precision.

1.  **Hanken Grotesk (Headlines):** A sharp, contemporary grotesque that provides a professional and modern "startup" edge to the academic navy brand colors.
2.  **Inter (Body):** The workhorse for high-density information. Its neutral character and high x-height ensure that long job descriptions and CV summaries remain legible across all devices.
3.  **JetBrains Mono (Labels/Technical):** Used sparingly for metadata, status chips, and "Confidence Scores." This adds a subtle "AI/Technical" layer to the design system, signaling the platform's algorithmic nature.

**Usage Notes:**
- **Headlines:** Always use tight letter-spacing for large titles.
- **Metadata:** Use `label-caps` for status tags and credit costs, always in uppercase.
- **Hierarchy:** Ensure a clear distinction between `body-base` for descriptions and `body-bold` for emphasized list items.

## Layout & Spacing

This design system employs a **Fixed-Fluid Hybrid Grid** based on a 4px baseline unit. 

- **Desktop:** A 12-column grid with a maximum container width of 1280px. Dashboards use a specific 70/30 split: a 70% width primary pane for main content (resumes, job lists) and a 30% sidebar for utilities (credit wallet, profile completion).
- **Mobile:** A fluid single-column layout with 16px side margins. Interactive elements like the "Credit Wallet" reflow to the top of the screen or into a dedicated bottom-sheet menu.
- **Spacing Philosophy:** Use `lg` (24px) for internal card padding and `xl` (32px) for section vertical spacing. This "roomy" approach prevents the information-dense data from feeling overwhelming.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Low-Contrast Outlines** rather than aggressive shadows.

- **The Canvas:** Backgrounds use `surface-muted` (#f8f9fa) to create a subtle separation from the primary content containers.
- **Cards:** White containers use a high-precision hairline border (`border-subtle`) paired with a "Soft Ambient" shadow. The shadow should be barely perceptible when static (4% opacity black) and transition to a more pronounced floating state (8% opacity) on hover.
- **Overlays:** Modals and dropdowns utilize a `backdrop-blur` (glassmorphism) effect behind them to maintain the "AI Atmosphere" while keeping the user focused on the immediate task.
- **Interactive Depth:** Buttons use a subtle inner-shadow when pressed to simulate a "physical click," reinforcing the tactile feel of the platform.

## Shapes

The shape language is **Rounded**, favoring 12px (rounded-xl) for main containers and 8px (rounded-lg) for buttons and inputs.

- **Containers:** Dashboard cards and upload zones use `rounded-xl` to soften the technical nature of the data.
- **Interactive Elements:** Buttons and form fields use `rounded-lg`.
- **Status Indicators:** Use `rounded-full` (pill-shaped) for all status chips (e.g., "Recommended", "Applied") to distinguish them clearly from interactive buttons.
- **Media:** Profile avatars and company logos should use `rounded-lg` rather than circles to maintain the architectural, grid-based aesthetic.

## Components

### Buttons
- **Primary:** Solid `#2557a7` with white text. High-intent, semibold, `rounded-lg`.
- **Secondary:** Off-white (`bg-surface-container-lowest`, `#FAF7F2`) background with `#2557a7` border and text.
- **Nav Pill:** `rounded-full`, off-white (`bg-surface-container-lowest`) background with a subtle beige border (`border-border-subtle`). Transitions to a primary blue wash on hover.

### Cards
- **Action Cards:** Feature a top-border accent matching the status color (e.g., a green top border for "Approved").
- **Metric Cards:** Use `jetbrainsMono` for large numeric values (like "Match %") to emphasize technical accuracy.

### Status Badges & Chips
- Use 10% opacity backgrounds of the semantic state color with 100% opacity text of the same hue (e.g., a "Recommended" chip has a light blue background with dark blue text).
- Include a small Lucide-style icon at the start of the chip for immediate visual recognition.

### Forms & Inputs
- **Inputs:** 48px height minimum for touch targets. Focus state uses a 2px ring of the primary brand color.
- **Upload Zone:** A dashed-border container with a large centered icon. Features a "shimmer" animation during the `processing` state.

### Credit Wallet
- A glassmorphic panel in the sidebar. It features a horizontal progress bar that changes color (Green → Amber → Red) based on the remaining credit percentage.

## Light Theme Token System

All light surfaces resolve through semantic tokens (`tailwind.config.js` +
`:root` vars in `index.css`). Hardcoded surface utilities are banned (see below).

### 1. Palette & Surface Elevations (light: off-white/beige scale)
- **Cards / modals / header (`bg-surface-container-lowest`, `#FAF7F2`)**: Primary off-white surface. Never use raw `bg-white` — it is banned by lint.
- **Page wash (`bg-surface-muted`, `#F3EDE3`)**: Warm beige page background. Never use raw `bg-gray-50` / `bg-slate-50` — banned by lint.
- **Wells / sidebar (`bg-surface-container-low` `#EFE7D9` / `bg-surface-container` `#E8DFD3`)**, **hovers (`bg-surface-container-high` `#DED2BE`)**, **emphasis (`bg-surface-container-highest` `#D5C7B0` / `bg-surface-dim` `#CBBFA9`)**.
- **Borders (`border-border-subtle` `#D9CDB8` / `border-outline-variant` `#C4B49A`)**: Beige borders; do not leave cold gray (`border-gray-*`/`border-slate-*`) on cream cards.
- **Non-standard shades** (`slate-150/350/450/650/750`, `indigo-150/650/750`, `bg-slate-105`, `bg-indigo-55`, …) are defined once in `tailwind.config.js` (interpolated hex) and remapped for dark mode by the `index.css` blanket — never redefine them per file.
- **Ban on hardcoded colors**: `.eslintrc.cjs` (`no-restricted-syntax`) rejects `bg-white`, `bg-gray-50`, `bg-slate-50` in `src` (including opacity/prefixed forms). Use the tokens above. `bg-slate-500`-style longer names are not flagged (boundary-aware).
## Dark Mode Implementation (values frozen — light remaps must not touch `.dark`)

The dark mode design strategy departs from pure black, utilizing a professional **Charcoal & Navy** palette derived from the primary brand color to deliver a sleek, premium experience.

### 1. Palette & Surface Elevations (dark)
- **Base Canvas Layer (`#0a0e14`)**: Main canvas background (`bg-surface-muted` in `.dark`).
- **Container Surfaces (`#161c24`)**: Default background for dashboard cards, list items, and sidebar components.
- **Elevated Surfaces (`#1c252e`)**: Used for modal dialogs, popovers, dropdown lists, and focus states.
- **Typography & Brand Accents**:
  - Primary text is rendered in high-emphasis off-white (`#f1f5f9`).
  - Secondary/metadata text uses comfortable slate-gray (`#94a3b8`).
  - Active brand buttons and key text accents use lightened brand blue (`#3b82f6` / `#60a5fa`) to guarantee accessibility and AA contrast ratios.

### 2. Implementation Infrastructure
- **Dynamic CSS Variables**: Root variables (`--color-primary`, `--color-inverse-surface`, etc.) are mapped under `:root` and `.dark` blocks inside [index.css](file:///d:/Career%20Guidence/frontend/src/index.css), enabling real-time CSS token switching.
- **Tailwind Opacity Bug Mitigation**: To bypass browser parsing errors when applying Tailwind opacity modifiers to CSS variables containing raw hex colors (e.g. `dark:bg-inverse-surface/5`), index.css implements explicit overrides for common opacity suffixes (`\/5`, `\/10` -> `#161c24` and `\/20`, `\/30` -> `#1c252e`).
- **Global Typography Inversion**: Text coloring classes (like `.text-slate-700` to `#f1f5f9` and `.text-slate-600` to `#94a3b8`) are mapped globally under `.dark` selectors to ensure excellent readability.
- **Theme Selection**: Managed in [DashboardLayout.jsx](file:///d:/Career%20Guidence/frontend/src/components/DashboardLayout.jsx). The toggle state appends the `.dark` class to `document.documentElement` (`<html>` element) for system-wide DOM styling, while preserving the original light mode as the default experience.