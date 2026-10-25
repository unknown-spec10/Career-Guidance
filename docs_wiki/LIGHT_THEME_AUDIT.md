# Light Theme Accent Audit — off-white + beige migration

> Scope: `frontend/` light theme only. Read-only audit — no source files changed.
> Target palette: off-white `#FAF7F2`-ish + beige `#E8DFD3`-ish (softer than pure white).
> Dark-mode (`.dark`) overrides intentionally out of scope — do not retint.

Reproduce counts:

```bash
cd frontend
grep -rn -E "bg-white|bg-(gray|slate)-50|stone|neutral" src/pages src/components --include="*.jsx" | cut -d: -f1,2 | sort -u | wc -l
grep -rn -E "bg-white|bg-(gray|slate)-50|stone|neutral" src/pages src/components --include="*.jsx" | wc -l
```

---

## 1. Token / variable inventory (where the light surface system *is* defined)

### 1a. `tailwind.config.js` (lines 10–88)

Top-level `theme.extend.colors`:

- 2 scale groups: `primary` (DEFAULT + 50–900, lines 12–24), `dark` (50–900, lines 25–36)
- 51 singleton tokens (lines 38–88)
- Total color definitions: **53 top-level keys / 71 values** (51 singletons + 20 scale shades)
- Light-surface-relevant subset: **13 tokens**

| Token | Current | Line | Role in light theme |
|---|---|---|---|
| `surface-muted` | `#f8f9fa` | 38 | App/page shell (`App.jsx:175`, `DashboardLayout.jsx:222` via `bg-surface-muted`) |
| `surface-container-low` | `#f1f4f9` | 41 | Sidebar profile block, icon wells, scroll track (`DashboardLayout.jsx:250`, `StudentDashboard.jsx:188,211,373`) |
| `surface-container-high` | `#e5e8ee` | 42 | Hovers (`hover:bg-surface-container-high`), progress track (`DashboardLayout.jsx:317,597`) |
| `surface-container-highest` | `#e0e3e8` | 47 | Progress track fill base |
| `surface` | `#f7f9ff` | 54 | Base surface |
| `surface-bright` | `#f7f9ff` | 64 | Bright surface (same as `surface`) |
| `surface-dim` | `#d7dadf` | 77 | Dim surface |
| `surface-container` | `#ebeef3` | 68 | Sidebar `bg-surface-container` (`DashboardLayout.jsx:225,544`), mobile menu hovers |
| `surface-container-lowest` | `#ffffff` | 85 | Header `bg-surface-container-lowest` (`DashboardLayout.jsx:391`), purest white in token system |
| `background` | `#f7f9ff` | 84 | Generic background token (rarely used directly) |
| `surface-variant` | `var(--color-surface-variant)` → `#e0e3e8` light | 57 | Muted text containers, dark-mode-adjacent fills |
| `border-subtle` | `#e9ecef` | 65 | Standard light border (`border-border-subtle` in Dashboard/Interview/StudentDashboard/FilterBar) |
| `outline` / `outline-variant` | `#737783` / `var(--color-outline-variant)` → `#c3c6d3` | 56,76 | Borders, dividers |

Other singletons (`on-surface #181c20`, `on-surface-variant #434751`, `secondary-container`, `primary-container`, etc.) are ink/accent, not surfaces — leave alone.

### 1b. `src/index.css` variables + component classes

`:root` (lines 7–16) — **8 custom properties**:

| Var | Light value | Dark override (do not touch) |
|---|---|---|
| `--color-primary` | `#003f8b` | `#60a5fa` (line 19) |
| `--color-primary-fixed-dim` | `#adc6ff` | `#60a5fa` |
| `--color-inverse-on-surface` | `#eef1f6` | `#f1f5f9` |
| `--color-outline-variant` | `#c3c6d3` | `#1c252e` |
| `--color-surface-variant` | `#e0e3e8` | `#94a3b8` |
| `--color-on-primary-container` | `#bdd0ff` | `#ffffff` |
| `--color-inverse-surface` | `#2d3135` | `#0a0e14` |
| `--color-primary-container` | `#2557a7` | `#3b82f6` |

Surface-relevant vars: `--color-surface-variant`, `--color-outline-variant`, `--color-inverse-surface` (3).

Hardcoded-white **component classes** in `@layer components` (these bypass tokens — risky):

| Class | Line | Hardcoded string |
|---|---|---|
| `.nav-button` | 89 | `bg-white text-slate-700 border-slate-200 hover:bg-primary-50` |
| `.btn-secondary` / `.btn-secondary-sm` | 93, 97 | `bg-white hover:bg-gray-50 ... border-gray-300` |
| `.card` (+ `.card:hover`) | 101, 104–106 | `bg-white border-gray-200 hover:border-gray-300` |
| `.input-field` / `.input` / `.select` | 109, 113, 117 | `bg-white border-gray-300 text-gray-900 placeholder:text-gray-400` |
| `.glass-panel` | 157 | `background: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.3)` |
| `.glass-panel-light` | 171 | `background: rgba(255,255,255,0.65); border: 1px solid rgba(15,23,42,0.06)` |
| `body` base | 31 | `bg-surface-muted` (token — OK) |
| Scrollbar track | 56 | `bg-surface-container-low` (token — OK) |

Dark overrides (lines 221–588, e.g. `.dark .bg-white → #161c24`, `.dark .bg-surface-container-lowest → #0a0e14`) must be left untouched; they already remap light classes for dark mode.

### 1c. Hardcoded `bg-white` / `bg-gray-50` / `stone` / `neutral` across `src/pages` + `src/components`

- **306 distinct file:line hits across 39 files** matching `bg-white|bg-(gray|slate)-50|stone|neutral` (union, deduped on file+line).
- Breakdown (overlapping lines counted once in union): ~165 `bg-white` lines in pages/components (+13 in `index.css` + test assertions ≈ 185 `bg-white` grep matches repo-wide), ~143 `bg-(gray|slate)-50` lines, 7 `stone|neutral` lines (5× `bg-neutral-900` tooltip in `DashboardLayout.jsx:241,291,330,360,376` + 2× `J Esse` — no `stone-*` surface usage found; `neutral` hits are dark tooltips, not light surfaces).
- `src/pages`: 24 files with hits. `src/components`: 15 files with hits.

Per-file line lists (every hit; class strings sampled in §2):

- `src/components/ApplicationTracker.jsx`: 90, 104, 108, 112, 116, 136, 138, 151
- `src/components/BypassModal.jsx`: 74, 98, 105, 113, 150
- `src/components/CreditWidget.jsx`: 89, 139, 142, 180, 182, 197, 202, 213, 250
- `src/components/DashboardLayout.jsx`: 241, 291, 330, 360, 376 (`bg-neutral-900` tooltips — dark, ignore), 453 (`bg-white` notification dropdown — **risky**)
- `src/components/ErrorBoundary.jsx`: 87 (`bg-white` modal shell), 157 (`bg-gray-50` details)
- `src/components/FilterBar.jsx`: 25 (`bg-white` shell — **risky**, sits beside token border), 44, 56, 65, 82, 91 (`bg-slate-50/50` inputs), 151 (`hover:bg-gray-50` button)
- `src/components/Footer.jsx`: 6 (`bg-slate-50` footer band), 21, 24, 27 (`bg-white` social buttons)
- `src/components/Hero.jsx`: 36 (`bg-slate-50` page), 101, 139, 164, 165, 178, 179, 198, 208, 230, 249, 285, 296, 303, 316, 338, 353, 366, 400, 417, 426, 428, 439, 448, 460, 485 — largest offender (21 `bg-white` lines; marketing cards/sections)
- `src/components/JobCard.jsx`: 28 (`bg-white` code chip), 66 (`bg-white/90` card), 100, 108, 117, 127, 159 (`bg-slate-50` meta chips), 175 (`bg-slate-50/50` excerpt), 196 (`hover:bg-slate-50` button)
- `src/components/LoadingTransition.jsx`: 15 (`bg-white/80` overlay)
- `src/components/Modal.jsx`: 124 (`card ... bg-white` — inherits `.card` risk)
- `src/components/Navbar.jsx`: 109, 110 (`bg-white` bar states), 135, 162, 171, 219, 234, 251, 266, 276 (hover/menu `hover:bg-slate-50`, `hover:bg-gray-50`)
- `src/components/SkeletonLoader.jsx`: 16, 45, 47, 84, 105, 122 (`bg-white` skeleton cards + `bg-gray-50` header)
- `src/components/SkillGapModal.jsx`: 240 (`bg-white` shell), 243 (`bg-slate-50/80` header), 266 (`bg-slate-50/20` body), 284, 408, 478, 482, 499, 540, 550, 553, 582, 592, 614, 636, 668, 706
- `src/components/VoiceWaveform.jsx`: 133 (`bg-slate-50` waveform box)
- `src/pages/AskPage.jsx`: 81 (`bg-white` page), 181 (`bg-gray-50` th), 235 (`bg-white` input), 274 (`bg-gray-50` chip)
- `src/pages/CandidateIntelligencePage.jsx`: 44 (`bg-slate-50` page), 55 (`bg-slate-50/50`), 68, 87, 105, 139, 166, 183, 200, 217, 239, 254, 281, 344 (`bg-white*` cards), 177, 194, 211, 228, 332, 354 (`bg-slate-50*` wells + badge string at 354)
- `src/pages/DashboardRouter.jsx`: 30 (`bg-gray-50` splash)
- `src/pages/EmailVerificationPage.jsx`: 45 (`bg-gray-50` splash)
- `src/pages/ForgotPasswordPage.jsx`: 47 (`bg-gray-50` page), 54 (`bg-white` card), 90 (`bg-white` input)
- `src/pages/InterviewPage.jsx`: 168, 324, 343 (`bg-white` panels — beside token borders), 193, 271, 278, 359 (`bg-slate-50*` controls), 286 (`bg-white` segmented active), 309 (toggle knob `bg-white`)
- `src/pages/InterviewResultsPage.jsx`: 161, 164, 256, 276, 331, 362 (`bg-white` cards), 192, 345, 349 (`bg-slate-50*` wells), 255, 275 (`bg-slate-50` splash), 443 (`bg-white hover:bg-gray-50` button)
- `src/pages/InterviewSessionPage.jsx`: 224, 242, 256 (splashes `bg-slate-50`), 225, 260, 337, 428, 491, 574, 614 (`bg-white` cards/modals), 277 (`bg-slate-50` page), 352, 360, 450 (`bg-slate-50` toolbars), 419 (`bg-white` textarea + `disabled:bg-slate-50`), 421 (`bg-gray-50` counter), 499, 500, 511, 512 (`bg-white`/`bg-slate-50` button states), 590, 626 (`hover:bg-gray-50` buttons)
- `src/pages/JobDetailsPage.jsx`: 27 (`bg-white` code chip), 118, 141 (`bg-gray-50` page/splash), 269 (`bg-slate-50/50` prose well), 324 (`bg-gray-50` badge string)
- `src/pages/JobsPage.jsx`: 460, 468, 474, 737 (`bg-white hover:bg-gray-50` buttons), 498, 500, 515, 572, 692, 702, 710 (`bg-white*` modal/sheets), 521 (`bg-slate-50/30` modal body), 542 (`bg-slate-50` fallback card)
- `src/pages/JobsPage.test.jsx`: 288–289 (asserts `bg-white`, not shipped UI — ignore in migration)
- `src/pages/LearningPathPage.jsx`: 137, 259 (`bg-white` sections), 210 (`bg-white/90` thumb), 245 (`bg-gray-50/70` empty state)
- `src/pages/LoginPage.jsx`: 123 (`bg-slate-50` split), 194 (`bg-white` form column), 251, 268 (`bg-white` inputs), 286 (checkbox `bg-white`), 314, 371 (divider chip `bg-white`), 151, 161, 171 (`bg-white/5` dark feature cards — dark-side, ignore), 200, 353, 377 (`hover:bg-slate-50` buttons)
- `src/pages/MyApplicationsPage.jsx`: 19 (`bg-gray-400` dot — status, ignore), 72, 85, 129, 376, 433, 489 (`bg-white` cards), 306 (`bg-gray-50` page), 212, 402, 503 (`hover:bg-gray-50` rows), 529, 539 (`bg-white/20`, `bg-white/10` — overlay shimmer, ignore)
- `src/pages/MyLearningPathsPage.jsx`: 123, 142 (`bg-white` cards/empty), 168, 173 (`bg-slate-50` chips), 238 (`bg-slate-50` dashed creator)
- `src/pages/RegisterPage.jsx`: 87 (`bg-slate-50` split), 159 (`bg-white` form column), 229, 274, 290, 307, 331 (`bg-white` inputs), 121, 135 (`bg-white/5` dark cards — ignore), 165, 249 (`hover:bg-slate-50`)
- `src/pages/ResendVerificationPage.jsx`: 29 (`bg-gray-50` splash)
- `src/pages/ResetPasswordPage.jsx`: 81 (`bg-gray-50` page), 88 (`bg-white` card), 133, 163, 195 (`bg-white` inputs)
- `src/pages/ResultsPage.jsx`: 43, 54, 83 (all `bg-gray-50` splash/page)
- `src/pages/StudentDashboard.jsx`: 185, 251, 272, 340, 368, 396, 456 (`bg-white` cards/modal), 476, 487, 488 (`bg-slate-50` form wells)
- `src/pages/StudentProfile.jsx`: 415, 427 (`bg-white` splash), 440 (`bg-white` field base string), 537 (`bg-white` upload label + `hover:bg-gray-50`), 623, 676, 708, 741, 998, 1055, 1086 (`bg-white` sections), 648 (`bg-gray-50` disabled override), 695, 727 (`bg-gray-50` repeat blocks), 934 (`bg-slate-50` credit row), 782 (`bg-white` select), 1108 (`bg-gray-50` password form)
- `src/pages/TransactionHistoryPage.jsx`: 54 (`bg-gray-50` badge string), 75, 95, 118 (`bg-white` cards), 126 (`hover:bg-gray-50` row)
- `src/pages/UpgradePage.jsx`: 105, 118, 119, 180, 253, 303 (`bg-white*` pricing/modal), 336, 347, 358, 369 (`bg-slate-50` inputs)
- `src/pages/VerifyCodePage.jsx`: 46 (`bg-gray-50` splash)

Representative hardcoded class strings (all light-theme, all bypass tokens):

- `bg-white dark:bg-inverse-surface border border-border-subtle` — `FilterBar.jsx:25`, `InterviewPage.jsx:168,324,343`, `StudentDashboard.jsx:185,272,368,396`
- `bg-white border border-gray-200 rounded-3xl` — `InterviewSessionPage.jsx:225,260,337`, `InterviewResultsPage.jsx:331,362`, `StudentProfile.jsx:623–1086` sections
- `bg-white border border-slate-100 rounded-3xl` — `CandidateIntelligencePage.jsx:239,254,281,344`, `CreditWidget.jsx:139`
- `bg-white/90`, `bg-white/95` + `backdrop-blur` — `JobCard.jsx:66`, `JobsPage.jsx:498,500,692,702,710`, `BypassModal.jsx:74`, `CreditWidget.jsx:89,139`, `Hero.jsx:139`
- `bg-slate-50`, `bg-slate-50/50`, `bg-gray-50` wells/inputs/splashes — see per-file lists above
- `hover:bg-slate-50`, `hover:bg-gray-50` — buttons/rows in `JobsPage`, `Navbar`, `MyApplicationsPage`, `InterviewSessionPage`, `StudentProfile`

No `stone-*` surface usage found. `neutral-*` is only `bg-neutral-900` dark tooltips (`DashboardLayout.jsx`) — not a light-surface migration item.

---

## 2. What must change for off-white `#FAF7F2` + beige `#E8DFD3`

### 2a. Surfaces (page / shell)

| Area | Today | Change to |
|---|---|---|
| App shell `bg-surface-muted` (`App.jsx:175`, `DashboardLayout.jsx:222`, `index.css:31`) | `#f8f9fa` cool gray | Warm page wash — retint token to beige-tinted `#F3EDE3` (see §3) |
| Auth splits `bg-slate-50` (`LoginPage.jsx:123`, `RegisterPage.jsx:87`) | `#f8fafc` | Same page wash (hand-edit to new wash or new token) |
| Splash/empty pages `bg-gray-50` (`ResultsPage`, `VerifyCodePage`, `ResendVerificationPage`, `DashboardRouter`, `EmailVerificationPage`, `ForgotPasswordPage:47`, `ResetPasswordPage:81`) | `#f9fafb` | Page wash — hand-edit (10 one-line splash divs, low risk) |
| Marketing `bg-slate-50` (`Hero.jsx:36`, `Footer.jsx:6`) + `bg-white` sections (`Hero.jsx:208,353,417`) | mixed | Page wash + off-white sections — hand-edit; keep section contrast deliberate |

### 2b. Cards

| Area | Today | Change to |
|---|---|---|
| Token cards `bg-white + border-border-subtle` (`StudentDashboard`, `InterviewPage`, `FilterBar`) | `#fff` | Off-white `#FAF7F2` — **automatic** if hardcoded `bg-white` in those files is swapped to `bg-surface-container-lowest` first, else hand-edit |
| `.card` (`index.css:101`) + `Modal.jsx:124` | `bg-white` | Retint class to off-white (one place fixes all `.card` consumers) |
| Plain `bg-white` cards (`StudentProfile` sections, `InterviewSession/Results`, `TransactionHistory`, `SkeletonLoader`, `MyApplications`, `MyLearningPaths`, `LearningPathPage`, `CandidateIntelligencePage`, `Hero` bento) | `#fff` | Off-white `#FAF7F2` — hand-edit per file (largest bucket, ~80 lines) |
| Translucent `bg-white/90–95` (`JobCard`, `JobsPage` modal, `BypassModal`, `CreditWidget`, `Hero` preview) | white @ opacity | Warm equivalent `bg-[#FAF7F2]/90–95` — hand-edit; opacity over beige page will otherwise look gray |

### 2c. Borders

| Area | Today | Change to |
|---|---|---|
| Token border `border-border-subtle` | `#e9ecef` | Beige border `#D9CDB8` — automatic everywhere it is used |
| Hardcoded `border-gray-200/300`, `border-slate-100/200` (~150 co-occurrences with the cards above) | `#e5e7eb` / `#f1f5f9` family | Beige `#D9CDB8` / deep `#C4B49A` for dashed/emphasis — hand-edit alongside each card; **this is the highest-risk miss category** (a white→cream card left with a gray border looks dirty) |
| `.card:hover border-gray-300`, `hover:border-primary-200` (`JobCard.jsx:66`) | gray/blue | Keep blue hover or move to beige-deep; decide per component |

### 2d. Inputs

| Area | Today | Change to |
|---|---|---|
| `.input` / `.input-field` / `.select` (`index.css:109–117`) | `bg-white` | Off-white `#FAF7F2` or paper `#FFFDF9` for contrast against beige page — single-class fix |
| Inline `bg-white` inputs (`AskPage:235`, `ForgotPassword:90`, `ResetPassword:133,163,195`, `Login:251,268`, `Register:229–331`, `StudentProfile:440`) | `#fff` | Same as above — hand-edit or (better) swap to `.input` class |
| `bg-slate-50/50` filter/input wells (`FilterBar:44–91`, `InterviewPage:271,278`, `StudentDashboard:476–488`, `UpgradePage:336–369`, `VoiceWaveform:133`) | `#f8fafc@50%` | Beige wash `#E8DFD3@40–50%` or solid `#F3EDE3` — hand-edit; placeholders `placeholder:text-slate-400` still legible on beige |

### 2e. Modals / overlays

| Area | Today | Change to |
|---|---|---|
| `SkillGapModal.jsx:240`, `JobsPage.jsx:498`, `BypassModal.jsx:74`, `CreditWidget.jsx:139`, `StudentDashboard.jsx:456`, `UpgradePage.jsx:303`, `ApplicationTracker.jsx:136`, `InterviewSessionPage.jsx:574,614` | `bg-white*` shells + `bg-slate-50/80` headers (`SkillGapModal:243`) + `bg-slate-50/20` body (`:266`) | Shell → `#FAF7F2`; header → beige `#E8DFD3` at 60–80%; body → `#FAF7F2`; footer `bg-slate-50 border-slate-200` (`SkillGapModal:668`) → beige. Hand-edit each modal (8 shells + 3 header/body/footer treatments) |
| `LoadingTransition.jsx:15` `bg-white/80` | white veil | Warm veil `bg-[#FAF7F2]/80` |
| `glass-panel` / `glass-panel-light` (`index.css:156–175`, used in `DashboardLayout.jsx:302,588`) | `rgba(255,255,255,…)` | `rgba(250,247,242,…)` + beige border `rgba(232,223,211,…)` |

### 2f. Sidebars / headers

| Area | Today | Change to |
|---|---|---|
| Sidebar `bg-surface-container` (`DashboardLayout.jsx:225,544`) | `#ebeef3` | Beige `#E8DFD3` — automatic via token |
| Header `bg-surface-container-lowest` (`DashboardLayout.jsx:391`) | `#ffffff` | Off-white `#FAF7F2` — automatic via token |
| `Navbar.jsx:109–110` `bg-white` bar | `#fff` | Off-white — hand-edit (public nav, high visibility) |
| `Footer.jsx:6` `bg-slate-50` band | `#f8fafc` | Beige wash — hand-edit |

### 2g. Hovers

- `hover:bg-gray-50` / `hover:bg-slate-50` (≈40 lines: `ApplicationTracker:90`, `JobsPage:460,474,737`, `Navbar:162–276`, `MyApplicationsPage:212,402,503`, `InterviewSessionPage:500,512,590,626`, `StudentProfile:537`, `JobCard:196`, `BypassModal:150`, `FilterBar:151`, `TransactionHistory:126`, `InterviewResults:443`) — today invisible-on-white gray; on cream they must go one step deeper (beige `#EFE7D9` / `#E8DFD3`) or they disappear. Hand-edit each; consider a shared `hover:bg-surface-container` token swap where the base becomes a token.
- `hover:bg-surface-container-high` (token users: `DashboardLayout` nav items) — automatic via token retint.
- Colored hovers (`hover:bg-primary-50`, `hover:border-primary-300` in `.nav-button`, `Hero` CTAs) — keep; verify contrast on cream (blue-50 on cream is fine).

### Risky bypasses (hardcoded values that ignore the token system — must not be missed)

1. `src/index.css` component classes (`.card`, `.btn-secondary*`, `.nav-button`, `.input*`, `.select`, `.glass-panel*`) — 7 classes, every consumer inherits the old white silently.
2. `bg-white` + `border-border-subtle` hybrids (`FilterBar:25`, `InterviewPage:168,324,343`, `StudentDashboard:185,272,368,396`, `DashboardLayout:453`) — border will update via token but fill will not; partial migration looks broken.
3. `bg-white/90–95` translucent layers — opacity math changes against a beige backdrop; snapshot-test these (`JobCard`, `JobsPage` modal, `BypassModal`, `CreditWidget`, `Hero` preview).
4. `border-slate-*` / `border-gray-*` co-occurring with every hardcoded card (~150 sites) — no token to carry them; each needs a hand-edit or they will read as cold gray on warm cream.
5. `bg-slate-50/50`, `bg-slate-50/30`, `bg-gray-50/70` washes (`JobsPage:521,542`, `LearningPathPage:245`, `CandidateIntelligence:55`, `FilterBar` inputs) — same gray-on-cream problem at low opacity.
6. `JobsPage.test.jsx:288–289` asserts `bg-white` — update the assertion or the test fails post-migration (not a UI risk, a CI risk).

---

## 3. Proposed token mapping + hand-adaptation list

### 3a. Token mapping (old → proposed; light theme only, `.dark` overrides frozen)

| Token (tailwind.config.js) | Old | Proposed | Rationale |
|---|---|---|---|
| `surface-container-lowest` | `#ffffff` | `#FAF7F2` | Primary card/modal/header off-white |
| `surface` | `#f7f9ff` | `#FAF7F2` | Unify base surfaces on off-white |
| `surface-bright` | `#f7f9ff` | `#FAF7F2` | Same |
| `background` | `#f7f9ff` | `#FAF7F2` | Same |
| `surface-muted` | `#f8f9fa` | `#F3EDE3` | Warm page wash (light beige tint, keeps contrast vs `#FAF7F2` cards) |
| `surface-container-low` | `#f1f4f9` | `#EFE7D9` | Wells, icon chips, scroll track |
| `surface-container` | `#ebeef3` | `#E8DFD3` | Sidebar + beige main |
| `surface-container-high` | `#e5e8ee` | `#DED2BE` | Hovers, progress tracks |
| `surface-container-highest` | `#e0e3e8` | `#D5C7B0` | Deepest beige (tracks, emphasis fills) |
| `surface-dim` | `#d7dadf` | `#CBBFA9` | Dim beige |
| `surface-variant` (`--color-surface-variant`) | `#e0e3e8` | `#E8DFD3` | Muted containers follow beige |
| `border-subtle` | `#e9ecef` | `#D9CDB8` | Default beige border |
| `outline-variant` (`--color-outline-variant`) | `#c3c6d3` | `#C4B49A` | Stronger beige border / dashed emphasis |

CSS vars (`index.css:7–16`): update `--color-surface-variant: #E8DFD3` and `--color-outline-variant: #C4B49A`; leave the other six (primary/inverse/primary-container family) alone. Update `.glass-panel` → `rgba(250,247,242,0.7)` + `rgba(232,223,211,0.5)` border; `.glass-panel-light` → `rgba(250,247,242,0.65)` + `rgba(196,180,154,0.35)` border; `.card`/`.input*`/`.btn-secondary*`/`.nav-button` fills per §2 (off-white `#FAF7F2`, hovers beige).

Alternative if cards need more pop against the wash: page wash `#F5EFE6`, cards pure `#FAF7F2`, sidebar pure `#E8DFD3` — same tokens, just swap `surface-muted` ↔ `surface-container-low` assignments.

### 3b. Inherits automatically (change tokens only, ~5 files)

- `src/App.jsx:175` (shell), `src/components/DashboardLayout.jsx` sidebar/header/nav/hovers/credits (≈39 token usages, lines 222–607), `src/pages/InterviewPage.jsx` token panels/labels/dividers (≈26 usages), `src/pages/StudentDashboard.jsx` token borders/dividers/wells (lines 188–440), `src/components/FilterBar.jsx:25,32` shell text/border (fill itself is hardcoded — see below).
- `index.css:31,56` (`body`, scrollbar track).

### 3c. Needs hand-adaptation (hardcoded — every `bg-white` / `bg-slate-50` / `bg-gray-50` / gray-border site)

Priority order:

1. `src/index.css` — `.card`, `.btn-secondary*`, `.nav-button`, `.input-field/.input/.select`, `.glass-panel*` (7 classes; highest leverage).
2. High-visibility shells: `Navbar.jsx:109–110,219`, `Hero.jsx` (21 lines), `Footer.jsx:6,21,24,27`, `LoginPage.jsx:123,194,251,268,286,314,371`, `RegisterPage.jsx:87,159,229,274,290,307,331`.
3. Core app cards/panels: `StudentDashboard.jsx` (10 lines), `StudentProfile.jsx` (17 lines — 7 section shells + fields), `InterviewPage.jsx` (9 lines), `InterviewSessionPage.jsx` (22 lines), `InterviewResultsPage.jsx` (12 lines), `JobsPage.jsx` (14 lines incl. modal), `JobDetailsPage.jsx` (5 lines), `CandidateIntelligencePage.jsx` (20 lines), `AskPage.jsx` (4 lines).
4. Modals/overlays/dropdowns: `SkillGapModal.jsx` (18 lines), `BypassModal.jsx` (5), `CreditWidget.jsx` (9), `ApplicationTracker.jsx` (8), `FilterBar.jsx:25`, `DashboardLayout.jsx:453`, `Modal.jsx:124`, `ErrorBoundary.jsx:87`, `LoadingTransition.jsx:15`, `UpgradePage.jsx:303`.
5. Chips/wells/hovers/rows: `JobCard.jsx` (9), `FilterBar.jsx` inputs (5) + button (151), all `hover:bg-(gray|slate)-50` states (§2g, ~40 lines), `MyApplicationsPage.jsx` (13), `MyLearningPathsPage.jsx` (5), `TransactionHistoryPage.jsx` (5), `LearningPathPage.jsx` (4), `ForgotPassword/ResetPassword` inputs/cards (8), splash pages (7 files × 1 line), `SkeletonLoader.jsx` (6), `VoiceWaveform.jsx:133`.
6. Test: `JobsPage.test.jsx:288–289` — update assertion to new surface class.
7. Explicitly **skip**: `bg-neutral-900` tooltips (`DashboardLayout`), `bg-white/5–10` dark feature cards (`Login/Register/MyApplications` — dark-side translucency), all `.dark …` overrides in `index.css:221–588`.

Estimated hand-edit surface: ~300 lines across 38 shipped files (excl. test) + 7 CSS classes + 13 token values + 2 CSS vars.
