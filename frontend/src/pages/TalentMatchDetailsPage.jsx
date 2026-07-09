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

  // Derive values from parsed data if present, or use stubs
  const name = applicant.display_name || parsedData?.personal?.name || 'Unknown Candidate'
  const currentRole = parsedData?.personal?.current_role || parsedData?.work_experience?.[0]?.job_title || 'Software Professional'
  const company = parsedData?.work_experience?.[0]?.company || 'Independent Contractor'
  const email = applicant.email || parsedData?.personal?.email || 'candidate@careersync.ai'
  const github = parsedData?.personal?.github || 'github.com/candidate'
  const summary = parsedData?.personal?.summary || 'Detail-oriented professional with a proven track record scaling application architectures, improving system performance, and collaborating in high-impact product teams.'
  
  const experienceList = parsedData?.work_experience || [
    {
      job_title: 'Lead Software Engineer',
      company: 'TechCorp Solutions',
      duration: '2021 - Present',
      responsibilities: [
        'Designed and scaled robust product features using modern frontend web frameworks.',
        'Mentored junior engineers and spearheaded cross-team feature definition sprints.'
      ]
    }
  ]

  const skillsList = parsedData?.skills || ['React.js', 'TypeScript', 'Next.js', 'Go', 'Kubernetes']

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
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                  <Sparkles size={12} /> 98% MATCH
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {currentRole} • Applied for Lead React Developer
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
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {summary}
              </p>
              
              <div className="flex flex-wrap gap-4 mt-6 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} /> {applicant.location_city || 'Not specified'}, {applicant.location_state || ''}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail size={14} /> {email}
                </span>
                <span className="flex items-center gap-1.5">
                  <LinkIcon size={14} /> {github}
                </span>
              </div>
            </section>

            {/* Experience Timeline */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-6">Experience Timeline</h3>
              <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-8">
                {experienceList.map((exp, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full bg-primary-500 border-4 border-white dark:border-slate-900 shadow-sm" />
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{exp.job_title}</h4>
                        <p className="text-xs text-primary-600 dark:text-primary-400 font-semibold">{exp.company}</p>
                      </div>
                      <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded">
                        {exp.duration || '2021 - Present'}
                      </span>
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
            </section>

            {/* Skills Card */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-4">Technical Skills</h3>
              <div className="flex flex-wrap gap-2">
                {skillsList.map((skill, index) => (
                  <span key={index} className="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/40 dark:border-slate-700/40">
                    {typeof skill === 'string' ? skill : skill.name}
                  </span>
                ))}
              </div>
            </section>

          </div>

          {/* RIGHT: AI Verdict (30%) */}
          <div className="lg:col-span-4 space-y-6">
            
            <section className="bg-slate-900 text-white p-6 rounded-2xl relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-bl-full" />
              
              <h3 className="font-bold text-sm text-primary-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Sparkles size={16} /> AI Hiring Verdict
              </h3>
              
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <p className="text-xs leading-relaxed text-slate-300">
                  Sarah is an <strong className="text-white font-semibold">exceptional match</strong> for this role. Her background directly addresses technical parameters, while leadership characteristics align with core values.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { name: 'React & TypeScript Expertise', pct: 100, color: 'bg-emerald-500' },
                  { name: 'Team Leadership', pct: 90, color: 'bg-primary-500' },
                  { name: 'System Optimization', pct: 95, color: 'bg-emerald-500' }
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                      <span>{item.name}</span>
                      <span>{item.pct}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Potential Skill Gaps */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm border-t-4 border-t-amber-500">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                <Lightbulb className="text-amber-500" size={16} /> Potential Gaps
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Probing points for structured evaluation in interviews.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/50 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">AWS serverless experience</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Strong frontend deployment track record, but lacks direct details regarding cloud backend scale patterns.
                </p>
              </div>
            </section>

          </div>

        </div>

      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
