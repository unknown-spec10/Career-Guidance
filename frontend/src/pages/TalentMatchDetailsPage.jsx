import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Verified, Briefcase, MapPin, Mail, Link as LinkIcon,
  Code, School, Sparkles, Lightbulb, Users,
  Bookmark, BookmarkCheck, Calendar, ShieldCheck, Loader2, Download
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

export default function TalentMatchDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  
  const [loading, setLoading] = useState(true)
  const [applicant, setApplicant] = useState(null)
  const [parsedData, setParsedData] = useState(null)
  const [intelligence, setIntelligence] = useState(null)
  const [shortlisted, setShortlisted] = useState(false)

  useEffect(() => {
    fetchApplicantDetails()
  }, [id])

  const fetchApplicantDetails = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/api/applicant/${id}`)
      // Response shape: { applicant: {...}, parsed_data: {...} }
      setApplicant(response.data.applicant)
      setParsedData(response.data.parsed_data)

      // Real longitudinal AI profile (may be unavailable — rendered honestly).
      const extId = response.data.applicant?.applicant_id
      if (extId) {
        try {
          const intelRes = await api.get(`/api/interview/candidate-intelligence/${extId}`)
          if (intelRes.data && !intelRes.data.status) setIntelligence(intelRes.data)
        } catch { /* no relationship or no profile yet — shown as unavailable */ }
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load candidate details')
    } finally {
      setLoading(false)
    }
  }

  const handleShortlist = () => {
    setShortlisted(prev => !prev)
    toast.success(shortlisted ? 'Candidate removed from shortlist' : 'Candidate shortlisted successfully')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-4" />
        <p className="text-slate-500 dark:text-slate-400">Loading candidate profile...</p>
      </div>
    )
  }

  if (!applicant) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <p className="text-rose-500 font-semibold text-lg">Candidate Not Found</p>
        <button
          onClick={() => navigate('/employer/talent-pool')}
          className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Back to Talent Pool
        </button>
      </div>
    )
  }

  // Derive values from parsed data — no fabricated fallbacks.
  const name = applicant.display_name || parsedData?.personal?.name || 'Unknown Candidate'
  const currentRole = parsedData?.personal?.current_role || parsedData?.work_experience?.[0]?.job_title || null
  const company = parsedData?.work_experience?.[0]?.company || null
  const email = applicant.email || parsedData?.personal?.email || null
  const github = parsedData?.personal?.github || parsedData?.personal?.links?.github || null
  const summary = parsedData?.personal?.summary || parsedData?.professional_summary || null

  const experienceList = parsedData?.work_experience || []
  const skillsList = parsedData?.skills || []

  // Real AI intelligence (from completed mock interviews) or honest absence.
  const intelSummary = intelligence?.summary || null
  const intelStrengths = intelligence?.strengths || []
  const intelWeaknesses = intelligence?.weaknesses || []
  const techSkillsTrajectory = intelligence?.technical_skills || {}

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation / Actions row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/employer/talent-pool')}
              className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight">{name}</h1>
                {intelligence?.role_readiness?.verdict && (
                  <span className="bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                    <Sparkles size={12} /> AI Analyzed
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {[currentRole, company].filter(Boolean).join(' • ') || 'Role information not provided'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleShortlist}
              className={`px-4 py-2 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm ${
                shortlisted
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {shortlisted ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              {shortlisted ? 'Shortlisted' : 'Shortlist Candidate'}
            </button>
            
            <button
              onClick={() => navigate(`/employer/applicants/${applicant.id}/schedule-interview`)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white dark:bg-primary-500 dark:hover:bg-primary-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Calendar size={14} />
              Schedule Interview
            </button>

            <button
              onClick={() => navigate(`/employer/applicants/${applicant.id}/interview-feedback`)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <ShieldCheck size={14} />
              Submit Feedback
            </button>
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: Candidate Profile (70%) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Professional Summary */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-3">Professional Summary</h3>
              {summary ? (
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{summary}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">No summary available in the parsed resume.</p>
              )}

              <div className="flex flex-wrap gap-4 mt-6 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} /> {applicant.location_city || 'Not specified'}{applicant.location_state ? `, ${applicant.location_state}` : ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail size={14} /> {email || 'Email not provided'}
                </span>
                {github && (
                  <span className="flex items-center gap-1.5">
                    <LinkIcon size={14} /> {github}
                  </span>
                )}
              </div>
            </section>

            {/* Experience Timeline */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-6">Experience Timeline</h3>
              {experienceList.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No work experience parsed from the resume.</p>
              ) : (
                <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-8">
                  {experienceList.map((exp, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full bg-primary-500 border-4 border-white dark:border-slate-900 shadow-sm" />
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{exp.job_title}</h4>
                          <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold">{exp.company}</p>
                        </div>
                        {(exp.duration || exp.dates) && (
                          <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded">
                            {exp.duration || exp.dates}
                          </span>
                        )}
                      </div>
                    {exp.responsibilities && (
                      <ul className="mt-2 text-xs text-slate-600 dark:text-slate-400 list-disc pl-4 space-y-1">
                        {exp.responsibilities.map((resp, rIdx) => (
                          <li key={rIdx}>{resp}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
                </div>
              )}
            </section>

            {/* Skills Card */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4">Technical Skills</h3>
              {skillsList.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No skills parsed from the resume.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skillsList.map((skill, index) => (
                    <span key={index} className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/40 dark:border-slate-700/40">
                      {typeof skill === 'string' ? skill : skill.name}
                    </span>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* RIGHT: AI Insights (30%) — real longitudinal analysis when available */}
          <div className="lg:col-span-4 space-y-6">

            <section className="bg-slate-900 text-white p-6 rounded-2xl relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-bl-full" />

              <h3 className="font-bold text-sm text-primary-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles size={16} /> AI Interview Analysis
              </h3>

              {intelligence ? (
                <>
                  {intelSummary && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                      <p className="text-xs leading-relaxed text-slate-300">{intelSummary}</p>
                    </div>
                  )}

                  {intelStrengths.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">Strengths</h4>
                      <ul className="space-y-1.5 text-xs text-slate-300 list-disc pl-4">
                        {intelStrengths.map((s, i) => <li key={i}>{typeof s === 'string' ? s : s?.description || ''}</li>)}
                      </ul>
                    </div>
                  )}

                  {Object.keys(techSkillsTrajectory).length > 0 && (
                    <div className="space-y-4">
                      {Object.entries(techSkillsTrajectory).map(([skillName, data]) => {
                        const hist = data?.score_history || []
                        const latest = hist.length ? hist[hist.length - 1] : null
                        const pct = latest !== null ? Math.round(latest * 100) : null
                        return (
                          <div key={skillName}>
                            <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                              <span>{skillName}</span>
                              <span>{pct !== null ? `${pct}%` : data?.level || ''}</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${pct !== null && pct >= 70 ? 'bg-emerald-500' : pct !== null && pct >= 50 ? 'bg-primary-500' : 'bg-amber-500'}`}
                                style={{ width: `${pct ?? 0}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {!intelSummary && intelStrengths.length === 0 && Object.keys(techSkillsTrajectory).length === 0 && (
                    <p className="text-xs text-slate-400">Analysis available but contains no insights yet.</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400 leading-relaxed">
                  No AI interview analysis is available for this candidate yet. Insights appear here after the candidate completes mock interviews on the platform.
                </p>
              )}
            </section>

            {/* Potential Skill Gaps — derived from real AI weaknesses */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-t-4 border-t-amber-500">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                <Lightbulb className="text-amber-500" size={16} /> Potential Gaps
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Probing points for structured evaluation in interviews.
              </p>
              {intelWeaknesses.length > 0 ? (
                <div className="space-y-3">
                  {intelWeaknesses.map((w, i) => (
                    <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-800">
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {typeof w === 'string' ? w : w?.description || ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No gaps identified yet.</p>
              )}
            </section>

          </div>

        </div>

      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
