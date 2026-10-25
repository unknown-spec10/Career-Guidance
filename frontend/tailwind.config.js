/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Original colors for backward compatibility
        primary: {
          DEFAULT: 'var(--color-primary)',
          50: '#e6f2ff',
          100: '#cce5ff',
          200: '#99ccff',
          300: '#66b3ff',
          400: '#3399ff',
          500: '#2557a7',
          600: '#1d4489',
          700: '#16346b',
          800: '#0e244d',
          900: '#07142f',
          950: '#030b1a', // deepest navy — dark-mode CTA/panel stop
        },
        dark: {
          50: '#f8f9fa',
          100: '#f1f3f5',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#6c757d',
          700: '#495057',
          800: '#343a40',
          900: '#212529',
        },
        // Non-standard shades used across src (single decision: interpolate
        // to nearest-step hex so every hardcoded *-150/350/450/650/750,
        // bg-slate-105, bg-indigo-55, etc. resolves instead of emitting nothing).
        // Light values below; dark remaps live in the index.css blanket.
        slate: {
          105: '#eef2f7',
          150: '#e8edf3',
          250: '#d7dfea',
          350: '#afbdd1',
          405: '#8da0b6',
          450: '#7d8fa8',
          505: '#5f748d',
          550: '#56677f',
          605: '#43566e',
          650: '#3d4f66',
          750: '#28394e',
          850: '#16263a',
          855: '#142437',
        },
        indigo: {
          55: '#e9efff',
          150: '#d3ddfd',
          650: '#4a3ed8',
          750: '#3d34b5',
        },
        amber: {
          150: '#fbe9b9',
          505: '#ef940a',
          650: '#c56607',
        },
        red: {
          150: '#fdd8d8',
          550: '#e63030',
          650: '#c81e1e',
        },
        green: {
          150: '#ccefd9',
          650: '#159040',
        },
        gray: {
          250: '#dbdee3',
          450: '#838b96',
          650: '#414b58',
        },
        rose: {
          505: '#f23458',
        },
        emerald: {
          150: '#c8ecd4',
        },
        // Premium landing language (phase 1). CSS-var backed so light/dark
        // roles are defined once in index.css. Additive only — existing
        // surface-*/primary tokens above are untouched so app pages keep
        // rendering exactly as before.
        "canvas": "var(--color-canvas)",
        "surface-raised": "var(--color-surface-raised)",
        "surface-overlay": "var(--color-surface-overlay)",
        "surface-sunken": "var(--color-surface-sunken)",
        "hairline": "var(--color-hairline)",
        "hairline-strong": "var(--color-hairline-strong)",
        "ink": "var(--color-ink)",
        "ink-muted": "var(--color-ink-muted)",
        "ink-subtle": "var(--color-ink-subtle)",
        // Academic Modern Design System Colors
        // Light surfaces are single off-white (#FAF7F2) — edit values here
        // to retheme the whole app. .dark values in index.css are frozen.
        "surface-muted": "#FAF7F2",
        "primary-fixed-dim": "var(--color-primary-fixed-dim)",
        "warning": "#f59e0b",
        "surface-container-low": "#FAF7F2",
        "surface-container-high": "#FAF7F2",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-primary": "#ffffff",
        "on-primary-fixed-variant": "#024493",
        "surface-container-highest": "#FAF7F2",
        "secondary-container": "#b8cbfe",
        "on-tertiary-container": "#bcd0ff",
        "interactive-purple": "#a855f7",
        "on-secondary-container": "#425581",
        "on-tertiary-fixed": "#001a42",
        "inverse-on-surface": "var(--color-inverse-on-surface)",
        "surface": "#FAF7F2",
        "tertiary-fixed-dim": "#adc6ff",
        "outline-variant": "var(--color-outline-variant)",
        "surface-variant": "var(--color-surface-variant)",
        "error": "#f43f5e",
        "on-primary-container": "var(--color-on-primary-container)",
        "secondary-fixed": "#d9e2ff",
        "inverse-surface": "var(--color-inverse-surface)",
        "on-surface": "#181c20",
        "surface-tint": "#2c5cad",
        "surface-bright": "#FAF7F2",
        "border-subtle": "#E5DDD0",
        "on-tertiary-fixed-variant": "#004395",
        "secondary-fixed-dim": "#b3c6f8",
        "surface-container": "#FAF7F2",
        "on-secondary-fixed": "#021a43",
        "inverse-primary": "#adc6ff",
        "primary-container": "var(--color-primary-container)",
        "on-secondary": "#ffffff",
        "on-error-container": "#93000a",
        "on-secondary-fixed-variant": "#334670",
        "on-surface-variant": "#4A4139",
        "outline": "#8A7F70",
        "surface-dim": "#FAF7F2",
        "tertiary-fixed": "#d8e2ff",
        "success": "#10b981",
        "secondary": "#4b5e8a",
        "on-background": "#181c20",
        "tertiary-container": "#0055b8",
        "on-primary-fixed": "#001a41",
        "background": "#FAF7F2",
        "surface-container-lowest": "#FAF7F2",
        "on-tertiary": "#ffffff",
        "tertiary": "#003f8b",
        "primary-fixed": "#d8e2ff"
      },
      borderRadius: {
        "sm": "0.25rem",
        "DEFAULT": "0.5rem",
        "md": "0.75rem",
        "lg": "1.0rem",
        "xl": "0.75rem", // Soft rounded-xl for bento grid cards (from design.md/mockups)
        // Premium additions — layout roles, not raw steps.
        "card": "1.25rem",
        "panel": "1.5rem",
        "hero": "2rem",
        "pill": "9999px",
        "full": "9999px"
      },
      spacing: {
        "xs": "4px",
        "sm": "8px",
        "md": "16px",
        "lg": "24px",
        "xl": "32px",
        "base": "4px",
        "gutter": "16px",
        "margin-mobile": "16px",
        "margin-desktop": "32px",
        "container-max": "1280px",
        // Section rhythm for the public landing experience.
        "section-xs": "3rem",
        "section-sm": "4.5rem",
        "section": "6.5rem",
        "section-lg": "8.5rem",
        "stack": "1.5rem"
      },
      fontFamily: {
        "body-bold": ["Inter", "sans-serif"],
        "label-caps": ["JetBrains Mono", "monospace"],
        "display-lg": ["Hanken Grotesk", "sans-serif"],
        "headline-md": ["Hanken Grotesk", "sans-serif"],
        "metadata": ["Inter", "sans-serif"],
        "display-lg-mobile": ["Hanken Grotesk", "sans-serif"],
        "body-base": ["Inter", "sans-serif"],
        // Role-based families for the landing page.
        "display": ["Hanken Grotesk", "Inter", "sans-serif"],
        "body": ["Inter", "sans-serif"]
      },
      fontSize: {
        "body-bold": ["16px", { "lineHeight": "24px", "fontWeight": "600" }],
        "label-caps": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700" }],
        "display-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        "headline-md": ["24px", { "lineHeight": "32px", "fontWeight": "700" }],
        "metadata": ["13px", { "lineHeight": "18px", "fontWeight": "500" }],
        "display-lg-mobile": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "700" }],
        "body-base": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
        // Tightened role scale: fluid display sizes, readable body sizes,
        // and a crisp caption/overline pair. Additive — legacy steps remain.
        "display-2xl": ["clamp(2.75rem, 5.4vw, 4.25rem)", { "lineHeight": "1.04", "letterSpacing": "-0.032em", "fontWeight": "800" }],
        "display-xl": ["clamp(2.125rem, 3.6vw, 3.25rem)", { "lineHeight": "1.06", "letterSpacing": "-0.028em", "fontWeight": "800" }],
        "title-lg": ["1.5rem", { "lineHeight": "1.2", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "title": ["1.25rem", { "lineHeight": "1.3", "letterSpacing": "-0.015em", "fontWeight": "700" }],
        "body-lg": ["1.125rem", { "lineHeight": "1.65", "letterSpacing": "-0.005em", "fontWeight": "400" }],
        "body": ["1rem", { "lineHeight": "1.65", "fontWeight": "400" }],
        "caption": ["0.8125rem", { "lineHeight": "1.5", "fontWeight": "500" }],
        "overline": ["0.6875rem", { "lineHeight": "1.2", "letterSpacing": "0.16em", "fontWeight": "700" }]
      },
      boxShadow: {
        // Var-backed so dark mode keeps a soft, intentional sense of depth
        // (the global dark blanket only neutralises the legacy shadow-* steps).
        "soft-xs": "var(--shadow-soft-xs)",
        "soft-sm": "var(--shadow-soft-sm)",
        "soft": "var(--shadow-soft)",
        "soft-lg": "var(--shadow-soft-lg)",
        "soft-xl": "var(--shadow-soft-xl)",
        "glow-primary": "var(--shadow-glow-primary)"
      },
    },
  },
  plugins: [],
}
