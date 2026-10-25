# Dark Theme Audit — frontend

Date: 2026-10-24. Scope: `frontend/src/pages/*` + `frontend/src/components/*` (+ `src/App.jsx`). Read-only audit; no source file was changed.

## 0. Theme scheme (how dark mode works here)

- `frontend/tailwind.config.js:2` — `darkMode: "class"`. The `dark` class on the root enables all `dark:` variants.
- `frontend/src/index.css:7-27` — CSS variables re-mapped under `.dark` (`--color-primary`, `--color-inverse-surface`, etc.).
- `frontend/src/index.css:29-32` — `body` uses `bg-surface-muted dark:bg-inverse-surface text-on-surface dark:text-inverse-on-surface`.
- `frontend/src/index.css:220-590` — **global `.dark` override blanket** (all `!important`). Anything in this list is considered *already handled* and is NOT flagged below:
  - `bg-white`, `bg-white/95|90|80|70`, `bg-surface-container-*`, `dark:bg-inverse-surface` (+`/5|10|20|30` variants)
  - `text-slate-900|800|700|600|500|400` + `text-slate-300`, `text-gray-900|800|700|600|500|400`
  - `bg-slate-50|100` (+`/30|40|50`), `bg-gray-50|100|200`, `bg-slate-200`
  - `border-slate-100|200`, `border-gray-200|300`
  - violet/blue/primary/emerald/amber/indigo/rose/red/green/yellow `-50|-100` bgs, `border-*-100|-200` (plus `border-red|green-150`, `border-yellow-300`, `border-green-300`, `border-primary-100`), `text-*-600|-700` (plus `text-red|green-500|650`, `text-yellow-400`, `text-blue-600`, `text-primary-500`)
  - utilities `.card .input .select .input-field .btn-primary(-sm) .btn-secondary(-sm) .nav-button .glass-panel`, body, scrollbar, disabled states.
- **What the blanket does NOT cover** (the hunting ground for this audit): `*-950` shades, `slate|gray-300|400` fills/borders, non-standard scales (`*-150|350|450|550|650|750|850`, `bg-slate-105`, `bg-indigo-55`), `orange|purple|teal|pink` families, `via-white/from-white` gradients, `bg-white/50|60`, `bg-*-50/60|70` opacities, inline `style`/hex, hardcoded SVG `stroke/fill`, `shadow-*` (no dark shadows anywhere), `hover:`/`focus:`/`placeholder:` states without `dark:` counterparts, native `<select><option>` dropdowns.

Severity: **High** = unreadable/invisible · **Medium** = ugly but usable / degraded control · **Low** = subtle mismatch (usually shadow/border-only).

## 1. Pages — `src/pages/`

### AskPage.jsx — clean
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| A1 | `src/pages/AskPage.jsx:181` | `border-gray-250 dark:border-gray-800` | `gray-250` is not a Tailwind shade → no rule; light header loses its bottom border | Low |
| A2 | `src/pages/AskPage.jsx:235` | `<input> … shadow-sm hover:shadow-md` (has `dark:bg-gray-900`) | shadows have no `dark:` → input looks flat in dark | Low |

### CandidateIntelligencePage.jsx — most Highs in batch
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C1 | `src/pages/CandidateIntelligencePage.jsx:240,255` | `text-slate-950` on "Technical Core Strengths" / "Key Improvement Areas" | `slate-950` not in blanket → near-black on dark card | High ×2 |
| C2 | `src/pages/CandidateIntelligencePage.jsx:283` | `text-slate-950` "Role Tier Readiness" | same | High |
| C3 | `src/pages/CandidateIntelligencePage.jsx:346` | `text-slate-950` "Skill Trajectories" | same | High |
| C4 | `src/pages/CandidateIntelligencePage.jsx:139` | `border border-indigo-50` (quote box; `bg-white/70` covered) | `border-indigo-50` not in blanket → border vanishes; `shadow-inner` no dark equiv | Low |
| C5 | `src/pages/CandidateIntelligencePage.jsx:360` | `border-b border-slate-50` | `border-slate-50` not in blanket → divider disappears | Low |
| C6 | `src/pages/CandidateIntelligencePage.jsx:166,183,200,217,239,254,281,344` | `shadow-sm hover:shadow-md` / `shadow-inner` on 8 cards/panels | shadows never render on dark; cards flat (bg/border survive via blanket) | Low |
| C7 | `src/pages/CandidateIntelligencePage.jsx:42-51` | skeleton `bg-slate-200 animate-pulse` + `<SkeletonStats/>`/`<SkeletonCard/>` | zero `dark:` in `SkeletonLoader.jsx`; correct today only via blanket | Low |

### DashboardRouter.jsx — clean, no findings.

### EmailVerificationPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| E1 | `src/pages/EmailVerificationPage.jsx:84` | `text-gray-600 hover:text-gray-900` (`/verify-code` link) | base covered, hover has no `dark:hover:` → near-black on hover in dark | Medium |

### ForgotPasswordPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| F1 | `src/pages/ForgotPasswordPage.jsx:54` | `bg-white rounded-2xl shadow-2xl border border-gray-200` | `shadow-2xl` no `dark:` → glows/flat in dark | Low |
| F2 | `src/pages/ForgotPasswordPage.jsx:90-92` | input `bg-white border-gray-300 text-gray-900 placeholder-gray-500`, zero `dark:` | works only via blanket; placeholder has no `dark:placeholder-*` | Low |
| F3 | `src/pages/ForgotPasswordPage.jsx:104` | `focus:ring-offset-dark-800` | not a Tailwind color → generates nothing; ring offset stays light | Low |

### InterviewPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| I1 | `src/pages/InterviewPage.jsx:134` | `bg-rose-50 border-rose-200 text-rose-800` ("Resume Profile Required") | bg/border covered, `text-rose-800` not (blanket only 600/700) → maroon on dark tint | Medium |
| I2 | `src/pages/InterviewPage.jsx:139` | `text-rose-900` Dashboard link | near-black-red on dark rose tint | Medium |
| I3 | `src/pages/InterviewPage.jsx:287` | `text-slate-400 hover:text-slate-650` (question-count buttons) | `slate-650` non-standard, no `dark:hover:` → dark-on-dark hover | Low |

### InterviewResultsPage.jsx — largest light-only surface
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| R1 | `src/pages/InterviewResultsPage.jsx:79` | `<circle … stroke="#f1f5f9">` ScoreRing track | near-white track, no dark alternate; glows on dark card | Low |
| R2 | `src/pages/InterviewResultsPage.jsx:30,37` | markdown `h1`/`strong` `text-slate-950`, `strong` also `bg-slate-100/70 border-slate-200/50` | `slate-950` unreadable; `/70` opacity not in blanket (only /30/40/50) → chip stays light | High |
| R3 | `src/pages/InterviewResultsPage.jsx:34,35,63` | markdown `ul/ol/blockquote` `text-slate-650` | non-standard, no `dark:` → washed-out body | Medium |
| R4 | `src/pages/InterviewResultsPage.jsx:278,336` | `text-gray-950` ("Analyzing Responses" / score hero) | not in blanket → near-black on dark-remapped cards | High ×2 |
| R5 | `src/pages/InterviewResultsPage.jsx:205` | `text-green-800` "Key Strengths" | blanket only green 500/600/650/700 → dark-green on dark tint | Medium |
| R6 | `src/pages/InterviewResultsPage.jsx:192,226` | `border-t border-gray-100` dividers | `border-gray-100` not in blanket → dividers vanish | Low ×2 |
| R7 | `src/pages/InterviewResultsPage.jsx:310` | `text-slate-500 hover:text-slate-900` ("Back to Setup") | hover has no `dark:hover:` → unreadable on hover | Medium |
| R8 | `src/pages/InterviewResultsPage.jsx:443` | `border-gray-300 text-gray-700 bg-white hover:bg-gray-50` ("Start New Practice") | hover flashes light gray in dark | Low |
| R9 | `src/pages/InterviewResultsPage.jsx:456` → `SkillGapModal.jsx` | modal custom tokens `border-slate-150 text-slate-750/650/450 bg-slate-105 bg-indigo-55 text-indigo-650 …`, zero `dark:` (backdrop `bg-slate-900/60` OK) | mixed light/dark render; custom labels near-unreadable | Medium (High for custom-shade labels) |
| R10 | `src/pages/InterviewResultsPage.jsx:19,168` | `SCORE_COLORS` Good tier `border-primary-200` | not in blanket (only `border-primary-100`) → badge border vanishes | Low |

Shadows (`shadow-sm`, `shadow-[0_4px_20px…]`, `shadow-xl` on L256/276/331/362/403/412) have no `dark:` anywhere on this page — uniformly Low, not listed individually. L380 skill-gap panel (`to-slate-900`, `text-slate-100/400`) is intentionally dark in both modes — not flagged.

### InterviewSessionPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| S1 | `src/pages/InterviewSessionPage.jsx:263,343,579,619` | `text-gray-950` ("Session Complete!", live question text, "Leave practice session?", "Finish Interview Early?") | not in blanket → near-black on dark cards; L343 is the critical path | High ×4 |
| S2 | `src/pages/InterviewSessionPage.jsx:389-392` | `bg-amber-50 border-amber-200 text-amber-900` + `text-amber-800` + `text-amber-950` (hint box) | blanket only amber 600/700 → dark-brown/near-black on dark tint | Medium (`950` borders High) |
| S3 | `src/pages/InterviewSessionPage.jsx:583-585` | `bg-red-50 border-red-100 text-red-800` + `text-red-950` (exit warning) | blanket only red 500/600/650/700 | Medium (`950` borders High) |
| S4 | `src/pages/InterviewSessionPage.jsx:267,312,465,616` | `text-primary-700` pills + `text-primary-650` icon; L465 has `dark:text-primary-600` but base + `border-primary-200` unmapped | blanket only primary 500/600 → dim text, missing border | Medium |
| S5 | `src/pages/InterviewSessionPage.jsx:482` | `text-red-650 bg-red-50/50 border-red-100` (mic error) | `text-red-650` not in blanket; `bg-red-50/50` opacity unlisted | Medium |
| S6 | `src/pages/InterviewSessionPage.jsx:523` | `bg-slate-900 hover:bg-slate-800 text-white` ("Finish Practice Early") | dark button on dark page → loses shape, white text only | Medium |
| S7 | `src/pages/InterviewSessionPage.jsx:500,512` | Prev/Next `border-slate-300` | not in blanket → outline vanishes | Low |
| S8 | `src/pages/InterviewSessionPage.jsx:421,431,450` | `border-gray-100` (char counter), `bg-slate-300` (mic dot), `border-slate-200/50` (transcribing box) | none in blanket → vanish/untuned | Low ×3 |

### JobDetailsPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| J-D1 | `src/pages/JobDetailsPage.jsx:17-24,41` | markdown `text-primary-700` (inline `code`), `border-primary-200` (blockquote accent) | neither in blanket; quote/code accents un-remapped | Low |
| J-D2 | `src/pages/JobDetailsPage.jsx:269` | `text-slate-650 … bg-slate-50/50 border-slate-100/80` (description body) | `slate-650` non-standard, no `dark:` → washed-out copy on darkened bg | Medium |
| J-D3 | `src/pages/JobDetailsPage.jsx:407` | `bg-emerald-100 text-emerald-800 border-emerald-200` (apply CTA) | `text-emerald-800` not covered → near-invisible label | High |
| J-D4 | `src/pages/JobDetailsPage.jsx:323,407` | `shadow-sm` on emerald panels | no `dark:shadow-*`; shadow vanishes | Low |

### JobsPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| J1 | `src/pages/JobsPage.jsx:377` | `bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 … border-amber-400 text-white shadow-amber-500/20` (bypass btn) | solids un-dimmed glare + light-only colored shadow | Medium |
| J2 | `src/pages/JobsPage.jsx:460,474` | `border-gray-300 bg-white text-gray-700 hover:bg-gray-50 shadow-sm` ("See more"/"Clear filters") | hover flashes light; shadow vanishes | Low |
| J3 | `src/pages/JobsPage.jsx:469` | `text-gray-300` empty-state `Briefcase` icon | `gray-300` text not in blanket | Low |
| J4 | `src/pages/JobsPage.jsx:498,510,692,702,710` | modal `bg-white/95` + `via-white/90` gradient wash + `rgba(15,23,42,*)` arbitrary shadows | `via-white/90` stays white over dark modal header | Medium (gradient); Low (shadows) |
| J5 | `src/pages/JobsPage.jsx:515` | modal close `text-slate-500 hover:text-slate-900 hover:bg-slate-100` | hover turns icon near-black on dark-remapped white | High |
| J6 | `src/pages/JobsPage.jsx:598` | `bg-yellow-100 border-yellow-200` ("Re-run Recommendations") | `border-yellow-200` not covered (only 100/300) → border vanishes | Low |
| J7 | `src/pages/JobsPage.jsx:663-670` | `bg-purple-50 border-purple-200` + `text-purple-500` stat box | purple family entirely outside blanket → glowing box | Medium |
| J8 | `src/pages/JobsPage.jsx:737` | `border-slate-200 text-slate-700 hover:bg-slate-50 bg-white shadow-sm` (modal "Close") | hover flashes light; shadow vanishes | Low |

Backdrop L490 `bg-black/50` correct — not flagged.

### LearningPathPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| L-P1 | `src/pages/LearningPathPage.jsx:53-57,186-187` | `bg-purple-50/text-purple-700`, `bg-teal-50/text-teal-700`, `bg-pink-50/text-pink-700` phase cards | three families outside blanket → pastel glare, no dimming | Medium |
| L-P2 | `src/pages/LearningPathPage.jsx:117` | `bg-gradient-to-br from-gray-50 to-gray-100` page bg | gradient not blanket-covered → whole page stays light in dark | High |
| L-P3 | `src/pages/LearningPathPage.jsx:137,259` | `bg-white rounded-2xl shadow-lg`, no `dark:border` | shadow vanishes, flat edge | Low |
| L-P4 | `src/pages/LearningPathPage.jsx:142-166` | SVG `fill="#d1d5db"` `stroke="#e5e7eb"` journey line/arrowhead | hardcoded hex, no dark alternate | Low |
| L-P5 | `src/pages/LearningPathPage.jsx:245` | `bg-gray-50/70 border-dashed border-gray-200` empty state | `/70` opacity unlisted → relies on base remap only | Low |
| L-P6 | `src/pages/LearningPathPage.jsx:266-270` | `from-orange-50 to-red-50 border-orange-200 text-orange-700`; `from-green-50 to-emerald-50 … text-green-900` + `text-green-800` + `text-green-600` | orange family uncovered (glare); `green-800/900` not covered → dark-on-dark if bg remaps | High (`green-800/900`); Medium (orange) |

Lightbox L324-325 (`bg-slate-950/90`, `bg-slate-900 border-slate-800`) already dark-correct — not flagged.

### LoginPage.jsx — invalid-token cluster (dead classes = missing color in one/both modes)
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| L-G1 | `src/pages/LoginPage.jsx:200` | `dark:hover:bg-slate-850`, `dark:text-slate-405` (theme toggle) | `850`/`405` don't exist → dead; icon hover/color missing in dark | Medium (color); Low (hover) |
| L-G2 | `src/pages/LoginPage.jsx:203` | `text-amber-505` (Sun icon) | invalid → loses amber in dark | Low |
| L-G3 | `src/pages/LoginPage.jsx:235` | `text-rose-505` (`AlertTriangle`) | invalid → error icon color missing | Low |
| L-G4 | `src/pages/LoginPage.jsx:288` | `text-slate-605` ("Remember me") | invalid in light, falls back to inherited | Low |
| L-G5 | `src/pages/LoginPage.jsx:320` | `dark:text-slate-505` (role label) | invalid → no dark color | Medium |
| L-G6 | `src/pages/LoginPage.jsx:330,341` | `hover:border-slate-350`, `text-slate-650` (role cards) | `350` dead; `650` un-remapped in dark | Low |
| L-G7 | `src/pages/LoginPage.jsx:275` | `dark:hover:text-slate-350` (password eye) | invalid → hover dead in dark | Low |

### MyApplicationsPage.jsx — clean, no findings (explicit `dark:bg-gray-800/90`, `dark:border-gray-700`, `dark:divide-gray-700`, `dark:bg-gray-700` skeletons throughout).

### MyLearningPathsPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| M-L1 | `src/pages/MyLearningPathsPage.jsx:110,181` | `border-b/t border-gray-100` | not in blanket → hairlines disappear | Low |
| M-L2 | `src/pages/MyLearningPathsPage.jsx:113,131,159,212` | `text-indigo-650 bg-indigo-650 text-indigo-750 shadow-indigo-650/15` (icons, CTA, badges, progress) | non-standard scale, may render transparent/un-remapped | Medium |
| M-L3 | `src/pages/MyLearningPathsPage.jsx:142` | `shadow-sm hover:shadow-md` card | vanishes in dark (relies on blanket border only) | Low |
| M-L4 | `src/pages/MyLearningPathsPage.jsx:165` | `text-gray-450` ("Focus Skills") | invalid + uncovered → color missing | Medium |
| M-L5 | `src/pages/MyLearningPathsPage.jsx:168,173` | `border-slate-150` skill chips | not in blanket → chip borders disappear | Low |
| M-L6 | `src/pages/MyLearningPathsPage.jsx:203` | `text-red-550` (trash btn; bg/border covered) | `550` not covered (only 500/600/650/700) | Medium |
| M-L7 | `src/pages/MyLearningPathsPage.jsx:238` | `border-dashed border-slate-300` (trash card) | not covered → dashed border vanishes | Low |
| M-L8 | `src/pages/MyLearningPathsPage.jsx:250` | `border-indigo-150` (restore btn) | not covered (only 100/200) → border vanishes | Low |

### RegisterPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| R-G1 | `src/pages/RegisterPage.jsx:136` | `` `bg-${feat.color}-500/10 border-${feat.color}-500/20 text-${feat.color}-400` `` | JIT can't generate interpolated classes → icon chips lose bg/border/text incl. dark | Medium |

### ResendVerificationPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| R-V1 | `src/pages/ResendVerificationPage.jsx:91` | `text-gray-600 hover:text-gray-900` (/login link) | hover near-black `#111827` on dark-remapped `.card` → invisible on hover | High |

### ResetPasswordPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| R-P1 | `src/pages/ResetPasswordPage.jsx:88` | `bg-white rounded-2xl shadow-2xl border-gray-200` | `shadow-2xl` no `dark:` → flat edge | Low |
| R-P2 | `src/pages/ResetPasswordPage.jsx:133-136,163-165,195-197` | inputs `bg-white border-gray-300 text-gray-900 placeholder-gray-500`, no `dark:placeholder-*` | placeholder `#6b7280` low-contrast on dark input | Low |
| R-P3 | `src/pages/ResetPasswordPage.jsx:170,202` | password eye `text-gray-400 hover:text-gray-600` | hover goes dark-gray `#4b5563` on dark input → invisible on hover | Medium |

### ResultsPage.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| R-S1 | `src/pages/ResultsPage.jsx:185,212` | `text-primary-400` (Award icon, score number) | not in blanket (only 500/600) → un-remapped accent | Low |

### StudentDashboard.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| S-D1 | `src/pages/StudentDashboard.jsx:414-415` | rejected `dotColor = 'bg-slate-400'` | `bg-slate-400` explicitly out of blanket, no `dark:` | Low |
| S-D2 | `src/pages/StudentDashboard.jsx:459` | upload-modal close `text-slate-400 hover:text-slate-700 hover:bg-slate-100` | hover dark-slate + light wash inside `dark:bg-inverse-surface` modal | Medium |
| S-D3 | `src/pages/StudentDashboard.jsx:481` | `text-emerald-600 bg-emerald-50/50 border-emerald-100` (selected-file row) | `/50` opacity unlisted + no `dark:` → translucent row stays light | Low |

### StudentProfile.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| S-P1 | `src/pages/StudentProfile.jsx:431` | `bg-red-50 border-red-200 text-red-800` (error box) | `text-red-800` not covered → `#991b1b` on dark tint | High |
| S-P2 | `src/pages/StudentProfile.jsx:440,639,659,669,1045,1118,1137,1156` | shared `fieldClass = '… border-gray-300 bg-white …'`, zero `dark:` | 100% blanket-dependent; placeholder/focus-ring light-tuned | Medium |
| S-P3 | `src/pages/StudentProfile.jsx:537` | upload label `bg-white border-gray-300 text-gray-900 hover:bg-gray-50` | hover flashes light in dark | Low |
| S-P4 | `src/pages/StudentProfile.jsx:767` | `bg-gradient-to-br from-slate-50 to-blue-50/20 border-slate-200/80 shadow-sm` (ATS card) | light gradient glare; shadow vanishes | Medium (glare); Low (shadow) |
| S-P5 | `src/pages/StudentProfile.jsx:782` | `<select>` `bg-white border-slate-300 text-slate-800` | `border-slate-300` uncovered; OS dropdown list stays white | Medium |
| S-P6 | `src/pages/StudentProfile.jsx:828-832,874-881` | `style={{ stroke/backgroundColor: '#10b981'|'#f59e0b'|'#ef4444' }}` score bars | inline hex, no dark alternative (harsh but visible) | Low |
| S-P7 | `src/pages/StudentProfile.jsx:950,960` | `bg-blue-50 hover:bg-blue-100`, `bg-slate-100 hover:bg-slate-200` (preview/download) | hover states flash light, no `dark:hover:` | Low |
| S-P8 | `src/pages/StudentProfile.jsx:1012` | `bg-blue-100 text-blue-900 border-blue-300` (skill pills) | `text-blue-900` (`#1e3a8a`) + `border-blue-300` both uncovered → invisible pill text | High |

### TransactionHistoryPage.jsx — zero `dark:` on page, blanket-only
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| T1 | `src/pages/TransactionHistoryPage.jsx:52` | `text-yellow-600 bg-yellow-50 border-yellow-200` (bonus) | `border-yellow-200` not covered (only 100/300) → border vanishes | Low |
| T2 | `src/pages/TransactionHistoryPage.jsx:37` | `text-yellow-500` (Gift icon) | not in blanket (only 400/600/700) | Low |
| T3 | `src/pages/TransactionHistoryPage.jsx:75,95,118` | `bg-white rounded-lg shadow-md` cards | no `dark:shadow-*`/`dark:border` → definition loss | Medium |
| T4 | `src/pages/TransactionHistoryPage.jsx:107,126` | `bg-gray-100 hover:bg-gray-200`, row `hover:bg-gray-50` | hover flashes light in dark | Low |

### UpgradePage.jsx — mostly `dark:`-aware
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| U1 | `src/pages/UpgradePage.jsx:276` | `text-[#818cf8]` (Check icon) | hardcoded arbitrary hex, no `dark:` (readable, un-themed) | Low |
| U2 | `src/pages/UpgradePage.jsx:303` | modal shell `border-slate-150` + `dark:border-[#1c252e] dark:bg-[#1c252e]` | light `150` invalid → no border in light; dark OK | Low |

### VerifyCodePage.jsx — no findings (blanket-covered shell; `hover:text-white` correct in dark; dark-style `bg-red|green-900/20` alerts correct).

## 2. Shared components — `src/components/` (+ `src/App.jsx`)

### ApplicationTracker.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-A1 | `src/components/ApplicationTracker.jsx:69` | `text-yellow-700 bg-yellow-50 border-yellow-200` (default branch) | `border-yellow-200` uncovered | Medium |
| C-A2 | `src/components/ApplicationTracker.jsx:90,136` | `shadow-sm` / `shadow-xl` (trigger + modal) | no `dark:` | Low |

### BypassModal.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-B1 | `src/components/BypassModal.jsx:125` | `text-amber-900` on `bg-amber-50/50` | dark brown on dark-remapped amber ≈ invisible | High |
| C-B2 | `src/components/BypassModal.jsx:159` | disabled CTA `bg-slate-200 border-slate-200 text-slate-400 cursor-not-allowed` | no `dark:` disabled styling | Low |
| C-B3 | `src/components/BypassModal.jsx:74,81,121,157,160` | `shadow-2xl/sm/md`, `shadow-amber-500/10` | no `dark:` | Low |
| C-B4 | `src/components/BypassModal.jsx:91,150` | `hover:bg-slate-100`, `hover:text-slate-700` | no `dark:hover:` → hover feedback lost | Low |

### ConfirmDialog.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-C1 | `src/components/ConfirmDialog.jsx:25` | `bg-red-50 dark:bg-red-100` icon well | explicit `dark:` paints a *light* square in dark mode (likely typo for `red-950/40`) | High |
| C-C2 | `src/components/ConfirmDialog.jsx:42` | destructive btn `shadow-sm` | no `dark:` | Low |

### CreditWidget.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-W1 | `src/components/CreditWidget.jsx:63-64` | skeleton `bg-gray-200` > `bg-gray-300 animate-pulse` | `bg-gray-300` NOT in blanket, zero `dark:` → inner bar stays light-gray | High |
| C-W2 | `src/components/CreditWidget.jsx:89,139,180` | `shadow-[0_8px_30px…]` / `shadow-2xl` / `shadow-sm` | no `dark:` | Low |
| C-W3 | `src/components/CreditWidget.jsx:79` | `bg-rose-50/60` | `/60` opacity unlisted (only `/50` remapped) — borderline | Low |

### DashboardLayout.jsx — tokens correct; only interaction gaps
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-D1 | `src/components/DashboardLayout.jsx:504,507` | avatar `group-hover:ring-2 group-hover:ring-primary/20` | no `dark:` ring adjustment | Low |
| C-D2 | `src/components/DashboardLayout.jsx:626` | mobile logout `hover:bg-rose-50` (desktop L368 has `dark:hover:bg-rose-950/20`) | missing mobile `dark:hover:` | Low |
| C-D3 | `src/components/DashboardLayout.jsx:219,317-318,597-598` | `walletColor = 'bg-success'/'bg-warning'/'bg-error'` progress fill | custom utilities, no dark step verified | Low |

Tooltips (`bg-neutral-900 dark:bg-slate-800`), sidebar/header/notifications popover all explicit `dark:` — not flagged.

### ErrorBoundary.jsx — entire fallback page light-only
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-E1 | `src/components/ErrorBoundary.jsx:83-184` | **zero `dark:` classes in file**; `bg-gradient-to-br from-red-50 to-orange-50` backdrop (L83), `bg-white shadow-2xl` card (L87) | worst place to be light-only (renders when app already broken) | High (file-level) |
| C-E2 | `src/components/ErrorBoundary.jsx:106` | `text-red-900` ("Error Details:") | not in blanket → invisible on dark | High |
| C-E3 | `src/components/ErrorBoundary.jsx:114-115` | `bg-yellow-50 border-yellow-200 text-yellow-800` | border + `800` text both uncovered | High |
| C-E4 | `src/components/ErrorBoundary.jsx:137` | `bg-gray-600` "Go Home" | solid gray-600 uncovered, no `dark:` | High |
| C-E5 | `src/components/ErrorBoundary.jsx:147` | `bg-orange-600` "Report Bug" | orange family uncovered | Medium |
| C-E6 | `src/components/ErrorBoundary.jsx:128,138,148` | `shadow-md hover:shadow-lg` ×3 | no `dark:` | Low |

### FilterBar.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-F1 | `src/components/FilterBar.jsx:44,56,65,82,91` | inputs/selects `focus:ring-primary-500/20 focus:border-primary-500`, `placeholder:text-slate-400` | no `dark:focus:`/`dark:placeholder:`; base survives via blanket only | Low (each; systemic group) |
| C-F2 | `src/components/FilterBar.jsx:67-71,91-99` | native `<select>` + `<option>` | OS dropdown list stays white in dark; no `dark:[color-scheme]` | Medium |
| C-F3 | `src/components/FilterBar.jsx:142,151` | `hover:border-primary-400 hover:text-primary-700` / `hover:bg-gray-50` | no `dark:hover:` | Low |

### Footer.jsx — no findings (explicit `dark:` throughout).

### Hero.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-H1 | `src/components/Hero.jsx:148,401,408,431` | `dark:text-slate-250` / `dark:text-slate-350` / `text-slate-550` | non-standard shades, likely undefined → dark text may inherit/nothing | Medium |
| C-H2 | `src/components/Hero.jsx:127` | `fill-amber-400 text-amber-400` Star ×5 | hardcoded lucide fill, unthemable (readable, Low) | Low |
| C-H3 | `src/components/Hero.jsx:276-277` | inline SVG `stroke="#475569"` `fill="#4f46e5/#3b82f6/#8b5cf6"` | hardcoded hex, no dark adaptation (decorative, `dark:opacity-10`) | Low |

Line 84 headline has `dark:`; gauge `dark:stroke-slate-800` OK — not flagged.

### JobCard.jsx (High-visibility: used by Jobs + recommendations)
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-J1 | `src/components/JobCard.jsx:28` | markdown inline `code`: `bg-white text-primary-700 border-slate-200` | `text-primary-700` uncovered → unreadable code chips wherever JD has backticks | Medium |
| C-J2 | `src/components/JobCard.jsx:42` | markdown `blockquote` `border-primary-200` | uncovered → accent border vanishes | Medium |
| C-J3 | `src/components/JobCard.jsx:77` | `group-hover:text-primary-900` (job title) | `primary-900` uncovered, no `dark:group-hover:` | Medium |
| C-J4 | `src/components/JobCard.jsx:196` | Details btn `hover:border-slate-300` | `slate-300` uncovered, no `dark:hover:` | Medium |
| C-J5 | `src/components/JobCard.jsx:204` | Applied pill `bg-emerald-100 border-emerald-200 text-emerald-800` | `text-emerald-800` uncovered | Medium |
| C-J6 | `src/components/JobCard.jsx:66,73,213` | `hover:shadow-[…]` / `shadow-sm` | no `dark:` | Low |

`pre` block intentionally `bg-slate-950 text-slate-100` — by design, not flagged.

### LoadingTransition.jsx — no findings (`bg-white/80` blanket-listed; spinner/text covered).

### Modal.jsx (shared primitive)
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-M1 | `src/components/Modal.jsx:138` | close btn `hover:bg-gray-100 text-gray-600 hover:text-gray-900` | no `dark:hover:` → hover feedback missing/inverted | Low |

Overlay `bg-black/70`, card `border-gray-300 bg-white` (.card + blanket) — not flagged.

### Navbar.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-N1 | `src/components/Navbar.jsx:251` | mobile link `dark:text-slate-350` | non-standard (siblings use `dark:text-slate-300`) → may be undefined | Medium |
| C-N2 | `src/components/Navbar.jsx:260,273` | `dark:border-slate-850` dividers | non-standard but consistently applied | Low |

### ProtectedRoute.jsx, ScrollToTop.jsx (color), App.jsx shell
- `ProtectedRoute.jsx` — no color classes of its own; no findings.
- `src/components/ScrollToTop.jsx:37` + `src/App.jsx:190` — `focus:ring-offset-white` vs `focus:ring-offset-dark-900`, opposite offsets, neither with `dark:` — focus ring against wrong backdrop in one mode. Low.
- `src/App.jsx:175` `bg-surface-muted dark:bg-inverse-surface` correct; launcher `shadow-primary-600/25` no `dark:` — Low.

### SkeletonLoader.jsx — systemic primitive, zero `dark:`
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-S1 | `src/components/SkeletonLoader.jsx:16,45,84,105,122` | card/table/list/stats/profile shells `bg-white border-gray-200` | 100% blanket-dependent | Medium (systemic) |
| C-S2 | `src/components/SkeletonLoader.jsx:20-37,52,66,86-91,108-112,126-140` | ~25× `bg-gray-200 animate-pulse` shimmer bars | same; any blanket regression turns every loading state light-on-dark | Medium (systemic) |

### SkillGapModal.jsx — largest genuine-break surface in components
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-G1 | `src/components/SkillGapModal.jsx:249` | header `bg-gradient-to-r from-slate-900 to-slate-750 bg-clip-text text-transparent` | near-black gradient title, no `dark:` → invisible in dark | High |
| C-G2 | `src/components/SkillGapModal.jsx:245,357,426,602` | `text-indigo-650` (score icons, "Quick Win", priorities, chips) | uncovered (only 600/700), no `dark:` | Medium |
| C-G3 | `src/components/SkillGapModal.jsx:485` | `bg-indigo-55 text-indigo-750` (week badge) | non-standard, uncovered | Medium |
| C-G4 | `src/components/SkillGapModal.jsx:272,339,422,460,583,615,669` | `text-slate-450` section labels | non-standard, uncovered, no `dark:` | Medium |
| C-G5 | `src/components/SkillGapModal.jsx:306,415,494,392,425` | `text-slate-650` / `text-slate-750` body copy | uncovered, no `dark:` | Medium |
| C-G6 | `src/components/SkillGapModal.jsx:293` | progress track `bg-slate-105` | non-standard, no `dark:` → wrong/invisible track | Medium |
| C-G7 | `src/components/SkillGapModal.jsx:284,382,592,602,636` | `border-indigo-150` / `hover:border-indigo-150` | not in blanket (only 100/200) → borders vanish | Low |
| C-G8 | `src/components/SkillGapModal.jsx:624-628` | difficulty pill `text-amber-650` (Medium) | uncovered (red-650/green-650 ARE covered; amber-650 is not) | Medium |
| C-G9 | `src/components/SkillGapModal.jsx:550,553` | `bg-white/95 border-slate-200 text-slate-700` video pills over thumbnails | blanket darkens pills designed as white-on-photo overlays | Low |
| C-G10 | `src/components/SkillGapModal.jsx:328-330` | streaming shimmer `bg-slate-100 animate-pulse` ×3, no `dark:` | base covered; untuned shimmer | Low |

Shell L240 (`bg-white border-slate-200`) and footer L668 (`bg-slate-50`) blanket-covered — not flagged. (`getScoreColor` L218 `text-red-650`/`border-red-150` verified covered — not flagged.)

### StatusBadge.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-T1 | `src/components/StatusBadge.jsx:68,92` | `withdrawn`/`loading` `bg-gray-100 border-gray-300 text-gray-700`, no `dark:` | only two solid-light badges in a set where 8 others use dark-native `*/500/10 + */500/30 + *-400` — inconsistent path | Medium |
| C-T2 | `src/components/StatusBadge.jsx:147,171` | `NewBadge` shimmer `via-white/30` over `bg-primary-500` | by design (reads both modes) | Low |

### Toast.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-T3 | `src/components/Toast.jsx:13-16` | all variants `text-green|red|yellow|blue-400` on `bg-*/500/10 border-*/500/30`, no `dark:` | fine in dark; in LIGHT mode `*-400` on near-white ≈ 2:1 contrast — inverse readability bug in the shared primitive (ships via `useToast` + inside `SkillGapModal:225`) | Medium |

### VoiceWaveform.jsx
| # | Loc | Class / snippet | Break | Sev |
|---|---|---|---|---|
| C-V1 | `src/components/VoiceWaveform.jsx:133` | container `bg-slate-50 border-slate-200 shadow-inner` | tokens covered; shadow untuned | Low |
| C-V2 | `src/components/VoiceWaveform.jsx:58-62,109` | canvas strokes `rgba(79,70,229,0.6)/(99,102,241,0.4)/(165,180,252,0.25)` | hardcoded, no dark adaptation (indigo readable on dark) | Low |

Charts: no chart library (recharts/chart.js/visx) anywhere under `src/components/` — nothing to flag. Dropdowns: only native `<select>`s in `FilterBar.jsx` (C-F2) + `StudentProfile.jsx:782` (S-P5).

## 3. Counts

~156 discrete findings across 51 files audited (30 pages + 20 components + `App.jsx`).

| Severity | Count | Share |
|---|---|---|
| High (unreadable/invisible) | **33** | ~21% |
| Medium (ugly but usable / degraded control) | **62** | ~40% |
| Low (subtle mismatch) | **61** | ~39% |
| Total | **~156** | |

Counting rule: each `×N` occurrence counted individually; grouped shadow-only lines counted once per file. Highest-density files: `SkillGapModal.jsx` (10 groups), `InterviewSessionPage.jsx` (8 groups / 13 occurrences), `InterviewResultsPage.jsx` (10 groups), `StudentProfile.jsx` (8 groups), `ErrorBoundary.jsx` (6 groups, file-level High), `JobsPage.jsx` (8 groups), `MyLearningPathsPage.jsx` (8 groups), `LoginPage.jsx` (7 invalid-token groups).

Clean / no-action files (4): `DashboardRouter.jsx`, `MyApplicationsPage.jsx`, `VerifyCodePage.jsx`, `Footer.jsx`, `LoadingTransition.jsx`, `ProtectedRoute.jsx` (6 files fully clear).

## 4. Systemic root causes (fix the root → fix many pages)

1. **Non-standard shade palette — single highest-value fix.** `slate-150|250|350|450|550|650|750|850`, `indigo-150|650|750`, `bg-slate-105`, `bg-indigo-55`, `amber-650|900`, `emerald-800`, `red-900`, `yellow-800`, `gray-450|605`, `rose-505|amber-505|slate-505|605`, `text-red-550`, `border-blue-300`, `text-blue-900`, `text-primary-700|900`, `border-primary-200`, `*-950` (`slate|gray`), `bg-gray-300`, `bg-slate-300|400`. None are generated by default Tailwind or remapped by the blanket; most render as *nothing* (invalid) or near-invisible in dark. Scattered across `SkillGapModal`, `CandidateIntelligencePage`, `InterviewResultsPage`, `InterviewSessionPage`, `Hero`, `Navbar`, `FilterBar`, `JobCard`, `ErrorBoundary`, `BypassModal`, `CreditWidget`, `JobsPage`, `LearningPathPage`, `LoginPage`, `MyLearningPathsPage`, `StudentProfile`. Fix: standardize to blanket steps (e.g. `650→600`, `750→700`, `450→400`, `150→100`, `950→900`+`dark:`) or extend `index.css:220-590` with the missing tokens.
2. **`SkeletonLoader.jsx` — zero-`dark:` shared loading primitive.** All shells + ~25 shimmer bars lean 100% on the blanket; any blanket regression turns every loading state site-wide light-on-dark. Add explicit `dark:bg-…` to shells/bars once (closes C-S1/C-S2, C7, C-W1 pattern).
3. **Dialog path: `Modal.jsx` + `ConfirmDialog.jsx` + `SkillGapModal.jsx` + `BypassModal.jsx`.** Close-button `hover:` with no `dark:hover:` (C-M1, C-B4), inverted `dark:bg-red-100` typo painting a light square in dark (C-C1), header gradient `from-slate-900` invisible title (C-G1), custom-shade body tokens (C-G2–C-G8), `text-amber-900` label (C-B1). One `dark:` pass over the four dialog shells/headers/close controls fixes `InterviewResultsPage`, `InterviewSessionPage`, `JobsPage`, and all future dialogs.
4. **`ErrorBoundary.jsx` — zero-`dark:` fallback page.** Renders exactly when the app is already broken. Needs a file-wide dark treatment (gradient → `dark:from-*`, card `dark:bg-*`, `text-red-900`/`text-yellow-800` → `dark:text-*-300`, buttons → dark fills), not per-line tweaks.
5. **`Toast.jsx` 4-line color map + `StatusBadge.jsx` withdrawn/loading.** Toast `*-400`-on-translucent reads in dark but fails contrast in *light* (~2:1); needs mode-aware text/fill. Badges: align the two solid-light variants with the file's own dark-native `*/500/10` pattern.
6. **Missing `dark:hover:` / `dark:focus:` / `dark:placeholder:` on interactive states (Low individually, systemic as a group).** `hover:text-slate|gray-900` → invisible-on-hover (E1, R7, R-V1 High; C-J3, S-D2, R-P3 Medium); `hover:bg-gray|slate-50|100` light flash (J2, J8, S-P3, S-P7, T4, C-D2, C-M1); `placeholder-gray-500` untuned (F2, R-P2, C-F1); `focus:ring` no dark variant (F3, C-F1, C-D1, ScrollToTop/App ring-offset conflict); native `<select><option>` white dropdowns (C-F2, S-P5). A single `dark:hover:/dark:focus:/dark:placeholder:/color-scheme` pass over `components/` + auth pages closes them all.
7. **Whole-page light gradients + uncovered color families.** `LearningPathPage.jsx:117` page gradient (High), `from-orange-50`/purple/teal/pink phase cards, `JobsPage.jsx:377` amber bypass gradient, `StudentProfile.jsx:767` ATS card, `JobsPage.jsx:498+` modal `via-white/90` wash, `StudentProfile.jsx:828+` inline hex score bars, `LearningPathPage.jsx:142+` hardcoded SVG hex, `ScoreRing` `#f1f5f9` track, `VoiceWaveform` canvas strokes. Needs per-family `dark:from-*/dark:to-*` + dark canvas/stroke alternates.
8. **Shadows everywhere (Low, site-wide).** No `dark:shadow-*`/`dark:border` pairing on any `shadow-sm|md|lg|xl|2xl` or arbitrary `shadow-[…]` — they silently vanish on dark. Cheapest global mitigation: add `dark:border` definition to elevated cards (or a `.dark .shadow-*` softening rule next to the existing blanket) rather than editing ~60 call sites.
