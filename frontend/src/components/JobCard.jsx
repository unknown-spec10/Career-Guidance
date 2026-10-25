import React from 'react'
import { motion } from 'framer-motion'
import SafeMarkdown from './SafeMarkdown'
import {
  Briefcase,
  MapPin,
  Clock,
  Award,
  Sparkles,
  CheckCircle,
  Loader2,
  Send,
  Check
} from 'lucide-react'
import { checkSkillMatch } from '../utils/skillMatch'

// Markdown renderers shared by the card body and the job-details modal.
export const jobMarkdownComponents = {
  h1: ({ children }) => <h1 className="text-sm font-bold text-ink mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-ink mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-ink mb-1.5">{children}</h3>,
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-inherit">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 ml-4 space-y-1 list-disc text-inherit">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 space-y-1 list-decimal text-inherit">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  code: ({ inline, children }) => {
    if (inline) {
      return <code className="bg-surface-sunken text-primary-700 px-1.5 py-0.5 rounded-card border border-hairline font-mono text-[10px]">{children}</code>
    }

    return (
      <pre className="bg-slate-950 text-slate-100 p-3 rounded-card overflow-x-auto text-[10px] leading-relaxed border border-slate-800 mb-2">
        <code>{children}</code>
      </pre>
    )
  },
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline font-semibold">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="border-l-4 border-primary-200 pl-3 italic text-ink-muted mb-2">{children}</blockquote>,
}

const JobCard = React.memo(({
  job,
  rec,
  candidateCity,
  candidateSkills,
  isApplied,
  isApplying,
  showApplicantFeatures,
  onApply,
  onOpenDetails
}) => {
  const handleOpenDetails = () => {
    onOpenDetails(job)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="surface-card surface-card-interactive p-6 flex flex-col h-full relative overflow-hidden group"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-primary-500 group-hover:via-indigo-500 group-hover:to-purple-500 transition-all duration-300" />

      <div className="flex justify-between items-start mb-3 gap-4">
        <div className="flex-1 mr-2">
          <div className="flex items-start gap-3 mb-1.5">
            <div className="w-11 h-11 bg-primary-50 border border-primary-100 rounded-card flex items-center justify-center flex-shrink-0 shadow-soft-xs">
              <Briefcase className="w-5 h-5 text-primary-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-title leading-tight mb-1 text-ink group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">{job.title}</h3>
              <p className="text-caption font-semibold text-ink-muted">{job.company}</p>
            </div>
          </div>
        </div>
      </div>

      {(() => {
        const userCity = candidateCity || ''
        const jobCity = (job.location_city || '').toLowerCase().trim()
        const isCityMatched = userCity && jobCity && (userCity.includes(jobCity) || jobCity.includes(userCity))

        const showLocGreen = isCityMatched || (!job.location_city && job.work_type === 'remote')
        const showWorkTypeGreen = job.work_type === 'remote' || job.work_type === 'hybrid'
        const isExpMatched = (rec?.scoring_breakdown?.experience_fit ?? 0) >= 0.5
        const isCgpaMatched = (rec?.scoring_breakdown?.academic_score ?? 0) >= 0.5

        return (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-pill border font-medium transition-all ${
                showLocGreen
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-soft-xs'
                  : 'bg-surface-sunken border-hairline text-ink-muted'
              }`}>
                <MapPin className={`w-3.5 h-3.5 ${showLocGreen ? 'text-emerald-500' : 'text-ink-subtle'}`} />
                <span>{job.location_city || 'Remote'}{job.location_state ? `, ${job.location_state}` : ''}</span>
              </div>
              <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-pill border font-medium capitalize transition-all ${
                showWorkTypeGreen
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-soft-xs'
                  : 'bg-surface-sunken border-hairline text-ink-muted'
              }`}>
                <Clock className={`w-3.5 h-3.5 ${showWorkTypeGreen ? 'text-emerald-500' : 'text-ink-subtle'}`} />
                <span>{job.work_type || 'Full-time'}</span>
              </div>
              {job.min_experience_years !== null && job.min_experience_years !== undefined && (
                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-pill border font-medium transition-all ${
                  isExpMatched
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-soft-xs'
                    : 'bg-surface-sunken border-hairline text-ink-muted'
                }`}>
                  <Sparkles className={`w-3.5 h-3.5 ${isExpMatched ? 'text-emerald-500' : 'text-ink-subtle'}`} />
                  <span>{job.min_experience_years}+ years</span>
                </div>
              )}
              {job.min_cgpa && (
                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-pill border font-medium transition-all ${
                  isCgpaMatched
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-soft-xs'
                    : 'bg-surface-sunken border-hairline text-ink-muted'
                }`}>
                  <Award className={`w-3.5 h-3.5 ${isCgpaMatched ? 'text-emerald-500' : 'text-ink-subtle'}`} />
                  <span>CGPA {job.min_cgpa}+</span>
                </div>
              )}
            </div>

            {/* Job Skills Section directly inside the card */}
            {(() => {
              const explicit = Array.isArray(job.required_skills) && job.required_skills.length > 0
              const matched = rec?.scoring_breakdown?.skills_breakdown?.matched_skills || []
              const partial = rec?.scoring_breakdown?.skills_breakdown?.partial_matches || []
              const fallbackSkills = [...new Set([...matched, ...partial])]
              const skillsToRender = explicit ? job.required_skills.slice(0, 3) : fallbackSkills.slice(0, 3)

              if (!skillsToRender || skillsToRender.length === 0) return null

              return (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {skillsToRender.map((skill) => {
                    const skillName = typeof skill === 'string' ? skill : skill?.name || skill?.skill || 'Skill'
                    const reqName = skillName.toLowerCase().trim()
                    const isMatched = checkSkillMatch(candidateSkills, reqName) ||
                                      matched.some(m => checkSkillMatch([m], reqName)) ||
                                      partial.some(p => checkSkillMatch([p], reqName))
                    return (
                      <span
                        key={skillName}
                        className={`text-[10px] px-2 py-0.5 rounded-pill font-semibold border transition-all inline-flex items-center ${
                          isMatched
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-soft-xs'
                            : 'bg-surface-sunken border-hairline text-ink-muted'
                        }`}
                      >
                        {isMatched && <Check className="w-2.5 h-2.5 mr-0.5 text-emerald-600 flex-shrink-0" />}
                        {skillName}
                      </span>
                    )
                  })}
                </div>
              )
            })()}
          </>
        )
      })()}

      {job.description && (
        <div className="text-xs sm:text-sm text-ink-muted leading-relaxed mb-6 bg-surface-sunken rounded-card p-3 border border-hairline line-clamp-4 overflow-hidden">
          <SafeMarkdown components={jobMarkdownComponents}>
            {job.description}
          </SafeMarkdown>
        </div>
      )}

      {(job.min_salary || job.max_salary) && (
        <div className="mb-4">
          <p className="app-label mb-1">Salary Range</p>
          <p className="text-sm font-bold text-primary-600">
            {job.min_salary ? `INR ${(job.min_salary / 100000).toFixed(1)}L` : 'Competitive'}
            {job.max_salary ? ` - INR ${(job.max_salary / 100000).toFixed(1)}L` : ''}
          </p>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-hairline flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <button
            onClick={handleOpenDetails}
            className="app-btn-secondary app-btn-sm inline-flex flex-1 items-center justify-center gap-2 active:scale-95 duration-200"
          >
            <span>Details</span>
          </button>

          {isApplied ? (
            <button
              disabled
              className="inline-flex h-9 flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-card border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              Applied
            </button>
          ) : (
            <button
              onClick={() => onApply(job.id)}
              disabled={isApplying}
              aria-busy={isApplying}
              className="app-btn-primary app-btn-sm inline-flex flex-1 items-center justify-center gap-1.5 active:scale-95 duration-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isApplying
                ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                : <Send className="h-4 w-4 shrink-0" />}
              <span>Easy Apply</span>
            </button>
          )}
        </div>

        {!showApplicantFeatures && (
          <button
            onClick={handleOpenDetails}
            className="app-label text-primary-600 hover:underline self-center pt-0.5"
          >
            View full job details
          </button>
        )}
      </div>
    </motion.div>
  )
})
JobCard.displayName = 'JobCard'

export default JobCard
