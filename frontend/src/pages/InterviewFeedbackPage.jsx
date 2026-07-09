import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, CheckCircle2, ShieldCheck, User, Star, Briefcase, MapPin,
  ClipboardCheck, Send, Loader2, AlertCircle
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

export default function InterviewFeedbackPage() {
  const { id } = useParams() // applicant_id
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [applicant, setApplicant] = useState(null)
  
  // Feedback states
  const [scores, setScores] = useState({
    communication: 3,
    technical_depth: 3,
    problem_solving: 3,
    leadership: 3,
    culture_fit: 3
  })
  const [behavioralNotes, setBehavioralNotes] = useState('')
  const [justificationNotes, setJustificationNotes] = useState('')
  const [decision, setDecision] = useState('hold') // 'advance', 'hold', 'reject'

  useEffect(() => {
    fetchApplicant()
  }, [id])

  const fetchApplicant = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/api/applicant/${id}`)
      setApplicant(response.data.applicant)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load candidate details')
    } finally {
      setLoading(false)
    }
  }

  const handleScoreChange = (category, value) => {
    setScores(prev => ({
      ...prev,
      [category]: parseInt(value)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!justificationNotes.trim()) {
      toast.error('Please enter justification notes')
      return
    }

    setSubmitting(true)
    try {
      await api.post(`/api/employer/applicants/${applicant.id}/feedback`, {
        scores,
        behavioral_fit_notes: behavioralNotes,
        justification_notes: justificationNotes,
        decision
      })

      toast.success('Interview feedback submitted successfully!')
      setTimeout(() => {
        navigate(`/employer/talent/${id}`)
      }, 1500)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-4" />
        <p className="text-slate-500">Loading candidate details...</p>
      </div>
    )
  }

  if (!applicant) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
        <p className="font-semibold">Candidate profile not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <button
            onClick={() => navigate(`/employer/talent/${id}`)}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Interview Feedback Hub</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Submit structured evaluation for {applicant.display_name}
            </p>
          </div>
        </div>

        {/* Form Grid */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT Panel: Candidate Summary (35%) */}
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col items-center text-center p-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div className="w-20 h-20 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-black text-2xl uppercase mb-3 border border-primary-500/20 shadow-sm">
                  {applicant.display_name ? applicant.display_name[0] : 'U'}
                </div>
                <h3 className="font-extrabold text-lg">{applicant.display_name}</h3>
                <p className="text-xs text-slate-500 mt-1">Candidate Profile</p>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400 pt-2">
                <div className="flex items-center gap-2">
                  <Briefcase size={14} className="text-slate-400 shrink-0" />
                  <span>Lead React Developer</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-slate-400 shrink-0" />
                  <span>{applicant.location_city || 'Remote'}, {applicant.location_state || ''}</span>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT Panel: Feedback Form (65%) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Section 1: Scores */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
              <h2 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Star className="text-primary-500" size={18} /> Competency Evaluation
              </h2>

              <div className="space-y-4">
                {[
                  { id: 'communication', label: 'Communication Skill', desc: 'Clear, concise presentation of technical solutions.' },
                  { id: 'technical_depth', label: 'Technical Depth', desc: 'Command over framework APIs and language specs.' },
                  { id: 'problem_solving', label: 'Problem Solving', desc: 'Efficiency in analytical reasoning and code execution.' },
                  { id: 'leadership', label: 'Team Collaboration & Leadership', desc: 'Mentorship capability and peer review style.' },
                  { id: 'culture_fit', label: 'Culture & Value Fit', desc: 'Alignment with core company culture and ethics.' }
                ].map(comp => (
                  <div key={comp.id} className="space-y-2 border-b border-slate-100 dark:border-slate-800/60 pb-4 last:border-0 last:pb-0">
                    <div className="flex justify-between items-baseline">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{comp.label}</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">{comp.desc}</p>
                      </div>
                      <span className="text-xs font-black bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded">
                        {scores[comp.id]} / 5
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
                      value={scores[comp.id]}
                      onChange={(e) => handleScoreChange(comp.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Section 2: Written Feedbacks */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-md font-bold text-slate-800 dark:text-slate-200">Written Feedback Notes</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Behavioral Fit Observations</label>
                  <textarea
                    rows={3}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                    placeholder="Enter observation notes regarding culture alignment, teamwork, etc..."
                    value={behavioralNotes}
                    onChange={(e) => setBehavioralNotes(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Hiring Recommendation Justification (Required)</label>
                  <textarea
                    rows={4}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                    placeholder="Provide clear justification for the decision..."
                    value={justificationNotes}
                    onChange={(e) => setJustificationNotes(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Section 3: Final Decision */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-md font-bold text-slate-800 dark:text-slate-200">Overall Hiring Decision</h2>
              
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'advance', label: 'Advance', desc: 'Progress to next round', color: 'border-emerald-500 text-emerald-600 dark:text-emerald-400' },
                  { value: 'hold', label: 'Hold', desc: 'Keep on backup pool', color: 'border-amber-500 text-amber-600 dark:text-amber-400' },
                  { value: 'reject', label: 'Reject', desc: 'Decline application', color: 'border-rose-500 text-rose-600 dark:text-rose-400' }
                ].map(opt => {
                  const isSelected = decision === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDecision(opt.value)}
                      className={`p-3 border-2 rounded-xl text-center flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? `${opt.color} bg-slate-50 dark:bg-slate-950 shadow-sm`
                          : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-500'
                      }`}
                    >
                      <span className="text-xs font-black uppercase tracking-wider">{opt.label}</span>
                      <span className="text-[9px] mt-0.5 opacity-80">{opt.desc}</span>
                    </button>
                  )
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-opacity disabled:opacity-50"
                >
                  <Send size={14} />
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </section>
          </div>

        </form>

      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
