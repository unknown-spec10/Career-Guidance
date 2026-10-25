# Theme Progress (context checkpoint — resume from here if context > 80%)

Baseline: frontend vitest 20 files / 103 tests pass. Backend pytest pending (end).

## Phase 1 — Centralize color into semantic tokens (DONE)
Decision: EXTEND-ONCE (tailwind.config.js defines non-standard shades; index.css
.dark blanket remaps them). No per-usage standardization.

- `tailwind.config.js`: added `slate.{105,150,250,350,405,450,505,550,605,650,750,850,855}`,
  `indigo.{55,150,650,750}`, `amber.{150,505,650}`, `red.{150,550,650}`,
  `green.{150,650}`, `gray.{250,450,650}`, `rose.{505}`, `emerald.{150}`
  (interpolated hex, light values; dark remaps in blanket).
- `src/index.css`: component classes `.nav-button/.btn-secondary*/.card/.input*/.select`
  now use `bg-surface-container-lowest` + `border-border-subtle`; `.card:hover` →
  `border-outline-variant`; `.glass-panel*` warmed to beige rgba.
  Blanket extended with non-standard slate/indigo/amber/red/green/gray/rose/emerald
  text/bg/border + uncovered standards (slate/gray-950, *-800/900, primary-700/900,
  primary-400, border-primary-200/blue-300, gray-300/slate-300/400 fills,
  purple/teal/pink/orange families). NOTE: file has a duplicate
  `.dark .text-gray-950` rule (first #94a3b8, later #f1f5f9 wins — correct value wins;
  clean up if touching that block).
- Codemod (node script): `bg-white` → `bg-surface-container-lowest`,
  `bg-gray-50|bg-slate-50` → `bg-surface-muted`, prefix/opacity preserved.
  317 replacements / 39 files. `bg-neutral-900` untouched (not matched).
- `JobsPage.test.jsx:288-289` auto-updated to assert `bg-surface-container-lowest`.
- `.eslintrc.cjs`: added ONE rule `no-restricted-syntax` (2 selectors: Literal +
  TemplateElement) banning `bg-white|bg-gray-50|bg-slate-50` with token message.
- Verify: eslint clean, vitest 20/103 pass.

## Phase 2 — Dark fixes (DONE)
Systemic (index.css blanket, one place): non-standard shades + uncovered
standards (Phase 1); opacity variants (/60,/70,red-50/50,white/50|60,
token /95→/50 + muted mixes); hover/focus/placeholder states;
group-hover primary-900; global shadow→border softening; color-scheme for
native selects; token fills (surface-muted/surface/dim/border-subtle);
border opacity variants; border-yellow-200/text-yellow-500/primary-650.
Per-file: SkeletonLoader explicit dark: (37 spots); ConfirmDialog red-100 typo;
Modal/Bypass close hovers (blanket); ErrorBoundary dark gradient stops;
CreditWidget skeleton; SkillGapModal header gradient; JobsPage via-white wash;
LearningPath page gradient/go-back hover/orange+green panels/SVG hex;
InterviewSession dark-button; ScoreRing stroke→class; LoginPage invalid cluster
(→standard steps); Navbar/Hero invalid dark: shades; RegisterPage static
color map; Toast mode-aware text; StatusBadge withdrawn/loading → 500/10
pattern; StudentProfile fieldClass/ATS gradient/blue hover; FilterBar
dark:hover text; ForgotPassword ring-offset; TransactionHistory dark borders;
StudentDashboard slate-400 dot; ScrollToTop/App ring-offsets.
.eslintrc fixed: boundary-aware ban (bg-slate-500 no longer flagged) via
\x2f (esquery can't parse literal /); probe-verified both directions.
Skipped 6 clean files per audit. Verified: eslint clean, vitest 20/103 pass.
Accepted residual (all Low, readable): solid brand gradients (JobsPage bypass,
BypassModal glow, ErrorBoundary header), hard SVG/canvas strokes
(Hero deco, VoiceWaveform, score bars), colored shadows, InterviewPage
slate-650 hover (no-op in dark), DashboardLayout ring/wallet tints,
UpgradePage hex icon, mic-dot slate-300, gray borders outside Phase-3 files.

## Phase 3 — Light palette (DONE)
- `tailwind.config.js`: 10 hex values remapped (lowest/surface/bright/
  background→#FAF7F2; muted→#F3EDE3; low→#EFE7D9; container→#E8DFD3;
  high→#DED2BE; highest→#D5C7B0; dim→#CBBFA9; border-subtle→#D9CDB8).
  Var-backed tokens (surface-variant, outline-variant) remapped via :root.
- `index.css :root`: `--color-surface-variant`→#E8DFD3,
  `--color-outline-variant`→#C4B49A. `.dark` block untouched.
  `--color-inverse-surface` left alone: no light-mode usage exists
  (all usages are `dark:`-prefixed), per audit §229.
- Hand-adapted 4 heaviest files onto beige border tokens (70 spots):
  base `border-slate-200/100` + `border-gray-200/300` → `border-border-subtle`,
  `border-slate-150` → `border-outline-variant`. Accent/dark:/opacity borders
  untouched. Hero 16, SkillGapModal 18, StudentProfile 17, InterviewSession 19.
- Verify: eslint clean, vitest 20/103 pass.
- Docs: `docs_wiki/workflows/DESIGN.md` — new "Light Theme Token System"
  section (scale, ban, non-standard policy), button/nav-pill entries updated.
- Backend pytest: 223 passed, 1 skipped (no backend changes, as expected).
- Residual (documented, not regressions): gray borders outside the 4 files
  stay cold-gray on cream (~80 sites, audit §2c item 4 — follow-up);
  `bg-white/5–/20` dark-side translucencies now token-backed (warm slightly).
Remap 13 tokens + `--color-surface-variant/--color-outline-variant` per
LIGHT_THEME_AUDIT §3a (surface-container-lowest/surface/surface-bright/
background→#FAF7F2; surface-muted→#F3EDE3; low→#EFE7D9; container→#E8DFD3;
high→#DED2BE; highest→#D5C7B0; dim→#CBBFA9; variant→#E8DFD3;
border-subtle→#D9CDB8; outline-variant→#C4B49A). Do NOT touch .dark values.
Hand-adapt Hero, SkillGapModal, StudentProfile, InterviewSessionPage.
