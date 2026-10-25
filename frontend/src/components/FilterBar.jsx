import { motion } from 'framer-motion'
import {
  Search,
  FilterX
} from 'lucide-react'

// Compact single-row filter toolbar for the jobs listing.
// Controlled entirely via props; owns no state.
//
// Layout: ONE flex-wrap row — keyword search (grows) + location input +
// work-type select + sort select + reset icon-button. At desktop widths
// everything fits on one line; on narrow mobile the search takes its own
// full-width line (basis-full) and the compact controls wrap below it.
// The former Skills field is merged into the keyword input: a keyword
// matches when EITHER the old title/company/description check OR the old
// skills check would have matched (union — see JobsPage.matchesFilters
// and GET /api/jobs `q`), so no separate skills param is sent anymore.
// The Learning Paths link lived here before; it is navigation, not a
// filter, so it now lives in the JobsPage header row next to Refresh.
export default function FilterBar({
  filters,
  updateFilter,
  resetFilters,
  activeFilterCount,
  showApplicantFeatures
}) {
  return (
    // Sticky "curtain" wrapper: this outer div is the ONLY sticky element. It
    // docks flush under the header (DashboardLayout keeps the header OUTSIDE
    // the scrollport, a sibling above main.flex-1.overflow-y-auto). main
    // carries top padding (16px mobile / 32px desktop), so plain top-0
    // would dock 32px BELOW the header and leave a strip where scrolled
    // cards stay visible. The negative offset (-top-4 mobile / md:-top-8
    // desktop) exactly cancels that padding: when stuck, the curtain's
    // padded opaque region slides under the header (z-30 covers it) and
    // its visible edge lands flush at the header bottom. Fully opaque page-
    // background fill (bg-background light / dark:bg-inverse-surface, both
    // solid #FAF7F2 / #0a0e14) plus top padding mirroring main's own top
    // padding (p-margin-mobile / md:p-margin-desktop) and bottom padding:
    // scrolling cards slide UNDER this opaque band and vanish before ever
    // reaching the inner toolbar's rounded edge, so no sliced titles/icons
    // peek through between the header and the bar at any scroll position,
    // light or dark mode, at any width. z-20 stays under the header (z-30);
    // modals/toasts (z-50) still float above.
    <div
      data-testid="jobs-filter-toolbar"
      className="sticky -top-4 md:-top-8 z-20 bg-canvas pt-margin-mobile md:pt-margin-desktop pb-lg"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface-card rounded-panel px-3 py-2 flex flex-wrap items-center gap-2"
      >
        {/* Keyword search: covers titles, companies, descriptions AND skills
            (merged union of the old `q` + `skills` fields). Full-width on
            its own line on narrow mobile, grows to fill the row on desktop. */}
        <div className="relative basis-full sm:basis-0 sm:flex-1 sm:min-w-[180px] min-w-0">
          <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Keyword search"
            placeholder="Keyword, title, company, or skills"
            value={filters.q}
            onChange={(e) => updateFilter('q', e.target.value)}
            className="app-input-sm pl-9 pr-3"
          />
        </div>

        {/* Location filter — full row on narrow mobile so it never collapses
            to a one-letter field beside the selects. */}
        <div className="relative basis-full min-w-0 sm:basis-auto sm:flex-none">
          <input
            type="text"
            aria-label="Location filter"
            placeholder="Location"
            value={filters.location}
            onChange={(e) => updateFilter('location', e.target.value)}
            className="app-input-sm w-full sm:w-32"
          />
        </div>

        {/* Work Type Selection */}
        <div className="relative min-w-0">
          <select
            aria-label="Work type filter"
            value={filters.work_type}
            onChange={(e) => updateFilter('work_type', e.target.value)}
            className="app-input-sm w-auto max-w-[8.5rem] !px-2 sm:max-w-none sm:!px-3"
          >
            <option value="">All Work Types</option>
            <option value="remote">Remote</option>
            <option value="on-site">On-site</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>

        {/* Sorting */}
        <div className="relative min-w-0">
          <select
            aria-label="Sort jobs"
            value={filters.sort}
            onChange={(e) => updateFilter('sort', e.target.value)}
            className="app-input-sm w-auto max-w-[8.5rem] !px-2 sm:max-w-none sm:!px-3"
          >
            {showApplicantFeatures ? (
              <option value="relevance">Sort: Relevance</option>
            ) : (
              <option value="popular">Sort: Popular</option>
            )}
            <option value="recent">Sort: Recent</option>
            <option value="title">Sort: A-Z</option>
          </select>
        </div>

        {/* Reset: icon-button, always visible; disabled with no active
            filters. The count badge is the compact active-filter indication
            (replaces the old per-filter pills + "Reset Filters" button row). */}
        <button
          type="button"
          onClick={resetFilters}
          disabled={activeFilterCount === 0}
          title={activeFilterCount > 0 ? `Reset ${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : 'No active filters'}
          aria-label="Reset filters"
          className="relative inline-flex items-center justify-center p-2 rounded-card border border-hairline bg-surface-raised text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <FilterX className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span
              data-testid="filter-count-badge"
              className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-pill bg-primary-600 text-white text-[10px] font-bold inline-flex items-center justify-center"
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </motion.div>
    </div>
  )
}
