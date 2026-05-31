import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  ArrowLeft, User, MapPin, GraduationCap, Briefcase, Target 
} from 'lucide-react'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

const getEmailTemplate = (type, name) => {
  const candidateName = name || 'Applicant'
  switch (type) {
    case 'interview':
      return `Hi ${candidateName},\n\nThank you for applying to our job posting. We are impressed with your profile and would like to schedule a 45-minute technical interview with our team.\n\nPlease let us know your availability over the next few business days.\n\nBest regards,\nRecruitment Team`
    case 'assignment':
      return `Hi ${candidateName},\n\nAs part of the evaluation process for this position, we would like you to complete a short take-home coding assignment. This helps us assess your practical technical skills.\n\nThe task details and specifications are attached. Please complete and submit it within 5 days.\n\nBest regards,\nRecruitment Team`
    case 'offer':
      return `Hi ${candidateName},\n\nWe are excited to offer you the position at our company! Our team was highly impressed by your qualifications and interview performance.\n\nAttached is the formal offer letter outlining the salary, benefits, and next steps for onboarding. Please sign and return it to finalize the offer.\n\nBest regards,\nRecruitment Team`
    default:
      return `Hi ${candidateName},\n\n[Write your custom message here]\n\nBest regards,\nRecruitment Team`
  }
}

export default function ApplicantDetailsPage() {
  const toast = useToast()
  const { applicantId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [emailBody, setEmailBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const userRole = currentUser?.role || secureStorage.getItem('user')?.role
  const getBackTarget = () => (userRole === 'student' ? '/dashboard' : '/admin/dashboard?tab=applicants')

  const fetchData = async () => {
    try {
      setLoading(true)
      setRecommendations(null)
      const apiUrl = `/api/applicant/${applicantId}`
      
      const detailsRes = await api.get(apiUrl)
      setData(detailsRes.data)
      
      const candidateName = detailsRes.data?.applicant?.display_name || 'Applicant'
      setEmailBody(getEmailTemplate('interview', candidateName))

      const dbId = detailsRes.data?.applicant?.id
      const storedUser = secureStorage.getItem('user')
      setCurrentUser(storedUser)

      if (dbId && storedUser?.role === 'student') {
        const recsRes = await api.get(`/api/recommendations/${dbId}`)
        setRecommendations(recsRes.data)
      } else {
        setRecommendations({ job_recommendations: [] })
      }
    } catch (error) {
      console.error('Error fetching applicant data:', error)
      setData(null)
      setRecommendations({ job_recommendations: [] })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTemplate = (type) => {
    const personalInfo = data?.parsed_data?.personal || data?.parsed_data?.personal_info || {}
    const candidateName = personalInfo.name || data?.applicant?.display_name || 'Applicant'
    setEmailBody(getEmailTemplate(type, candidateName))
  }

  const handleSendEmail = async () => {
    const personalInfo = data?.parsed_data?.personal || data?.parsed_data?.personal_info || {}
    setSendingEmail(true)
    setTimeout(() => {
      setSendingEmail(false)
      toast.success(`Confirmation email successfully sent to ${personalInfo.email || 'applicant'}!`)
    }, 1500)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicantId])

  const handleRecomputeRecommendations = async () => {
    if (!data?.applicant?.id) return
    try {
      setRecalcLoading(true)
      await api.post(`/api/applicant/${data.applicant.id}/generate-recommendations`)
      await fetchData()
    } catch (error) {
      console.error('Error recomputing recommendations:', error)
    } finally {
      setRecalcLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Add null check for data and applicant
  if (!data || !data.applicant) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 pb-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-2">Unable to load applicant data.</p>
            <p className="text-gray-500 text-sm">The applicant may not exist or there was an error fetching the data.</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 btn-primary"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const applicant = data.applicant
  const parsed = data.parsed_data || {}
  // Support both `personal` and `personal_info` keys from different parser outputs
  const personal = parsed.personal || parsed.personal_info || {}
  const education = parsed.education || []
  const skills = parsed.skills || []
  const experience = parsed.experience || []
  const projects = parsed.projects || parsed.project || []
  const certifications = parsed.certifications || parsed.certification || []
  const summary = parsed.summary || ''

  return (
    <div className="min-h-screen bg-slate-50/50 pt-24 pb-12 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute left-1/4 top-10 h-96 w-96 rounded-full bg-gradient-to-br from-primary-400/10 to-indigo-300/10 blur-[100px]" />
      <div className="pointer-events-none absolute right-1/4 top-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-400/10 to-emerald-300/10 blur-[100px]" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-slate-500 hover:text-slate-800 transition-colors duration-200 mb-4 font-bold text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          
          <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/70 p-6 md:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.04)] backdrop-blur-md">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/50 to-white/40 opacity-70" />
            <div className="relative">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                {applicant?.display_name || 'Applicant Details'}
              </h1>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Personal Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
            >
              <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-100">
                <User className="w-5 h-5 text-primary-500" />
                <h2 className="text-lg font-bold text-slate-800">Personal Info</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Name</p>
                  <p className="font-semibold text-slate-800 text-sm">{personal.name || applicant?.display_name}</p>
                </div>
                {personal.email && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</p>
                    <p className="font-semibold text-slate-800 text-sm">{personal.email}</p>
                  </div>
                )}
                {applicant?.location_city && (
                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-600">{applicant.location_city}, {applicant.country}</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Education */}
            {education.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
              >
                <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-100">
                  <GraduationCap className="w-5 h-5 text-primary-500" />
                  <h2 className="text-lg font-bold text-slate-800">Education</h2>
                </div>
                <div className="space-y-4">
                  {education.map((edu, idx) => (
                    <div key={idx} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                      <p className="font-bold text-slate-800 text-sm">{edu.institution}</p>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">{edu.degree}</p>
                      {(edu.cgpa || edu.grade) && (
                        <p className="text-xs font-bold text-primary-650 mt-1">
                          {edu.cgpa ? `CGPA: ${edu.cgpa}` : `Grade: ${edu.grade}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
              >
                <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-100">
                  <Target className="w-5 h-5 text-primary-500" />
                  <h2 className="text-lg font-bold text-slate-800">Skills</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-primary-50 border border-primary-100 rounded-xl text-xs font-bold text-primary-750 shadow-sm"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column - Recommendations for Student, parsed profile & email for Employer/Admin */}
          <div className="lg:col-span-2 space-y-6">
            {userRole === 'student' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-800">Recommendations</h2>
                  <button
                    onClick={handleRecomputeRecommendations}
                    disabled={recalcLoading}
                    className={`px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition-all active:scale-95 duration-200 ${recalcLoading ? 'bg-slate-350 cursor-not-allowed' : 'bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700'}`}
                  >
                    {recalcLoading ? 'Recomputing...' : 'Re-run Recommendations'}
                  </button>
                </div>
                {/* Job Recommendations */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
                >
                  <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-slate-100">
                    <Briefcase className="w-6 h-6 text-emerald-500" />
                    <h2 className="text-lg font-bold text-slate-800">Job Recommendations</h2>
                  </div>
                  <div className="space-y-4">
                    {recommendations?.job_recommendations?.map((rec) => (
                      <Link
                        key={rec.id}
                        to={`/job/${rec.job.id}`}
                        className="block p-4 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-500/50 transition-all duration-300 shadow-sm"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-bold text-base text-slate-900">{rec.job.title}</h3>
                            <p className="text-xs font-semibold text-slate-500 mt-0.5">{rec.job.company}</p>
                            <p className="text-xs font-bold text-slate-400 mt-1">
                              {rec.job.location_city} • {rec.job.work_type}
                            </p>
                          </div>
                        </div>
                        {(rec.explanation || rec.explain) && (
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            {rec.explanation || 
                              (typeof rec.explain === 'string' 
                                ? rec.explain 
                                : (rec.explain.reasons?.join(', ') || rec.explain.reasoning || rec.explain.match_details || 'Good match'))}
                          </p>
                        )}
                      </Link>
                    ))}
                    {recommendations?.job_recommendations?.length === 0 && (
                      <p className="text-slate-500 text-center py-4 font-semibold text-sm">No job recommendations yet</p>
                    )}
                  </div>
                </motion.div>
              </>
            )}

            {userRole !== 'student' && (
              <div className="space-y-6">
                {/* Professional Summary */}
                {summary && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
                  >
                    <h3 className="text-base font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">Professional Summary</h3>
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{summary}</p>
                  </motion.div>
                )}

                {/* Work Experience */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
                >
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                    <Briefcase className="w-5 h-5 text-primary-500" />
                    <h3 className="text-lg font-bold text-slate-800">Work Experience</h3>
                  </div>
                  {experience.length === 0 ? (
                    <p className="text-slate-500 text-sm font-semibold">No work experience listed.</p>
                  ) : (
                    <div className="space-y-6">
                      {experience.map((exp, idx) => (
                        <div key={idx} className="border-l-2 border-primary-200 pl-4 space-y-1">
                          <h4 className="font-bold text-slate-900 text-sm">{exp.role || exp.title || 'Job Role'}</h4>
                          <p className="text-xs font-semibold text-primary-650">{exp.company || 'Company'}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{exp.start_date || 'N/A'} - {exp.end_date || 'Present'}</p>
                          {exp.description && (
                            <p className="text-xs text-slate-650 mt-2 whitespace-pre-wrap leading-relaxed">{exp.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Projects */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
                >
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                    <Target className="w-5 h-5 text-primary-500" />
                    <h3 className="text-lg font-bold text-slate-800">Projects</h3>
                  </div>
                  {projects.length === 0 ? (
                    <p className="text-slate-500 text-sm font-semibold">No projects listed.</p>
                  ) : (
                    <div className="space-y-6">
                      {projects.map((proj, idx) => (
                        <div key={idx} className="space-y-1.5 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                          <h4 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                            <span>{proj.name || proj.title || 'Project'}</span>
                            {proj.link && (
                              <a href={proj.link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary-600 hover:underline">
                                View Project
                              </a>
                            )}
                          </h4>
                          {proj.technologies && (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tech: {Array.isArray(proj.technologies) ? proj.technologies.join(', ') : String(proj.technologies)}</p>
                          )}
                          {proj.description && (
                            <p className="text-xs text-slate-655 leading-relaxed whitespace-pre-wrap">{proj.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Certifications */}
                {certifications.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white/90 backdrop-blur-sm p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
                  >
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                      <GraduationCap className="w-5 h-5 text-primary-500" />
                      <h3 className="text-lg font-bold text-slate-800">Certifications</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {certifications.map((cert, idx) => (
                        <div key={idx} className="p-3.5 border border-slate-100 rounded-2xl bg-slate-50/50 shadow-inner">
                          <h4 className="font-bold text-slate-800 text-xs">{cert.name || cert.title}</h4>
                          {cert.authority && <p className="text-[10px] text-slate-405 font-bold mt-0.5">{cert.authority}</p>}
                          {cert.date && <p className="text-[10px] text-slate-400 mt-1">{cert.date}</p>}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Send Next Steps Email */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="relative overflow-hidden rounded-3xl border border-primary-100 bg-primary-50/30 backdrop-blur-sm p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
                >
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Send Next Steps Email</h3>
                  <p className="text-xs font-semibold text-slate-600 mb-4 leading-relaxed">
                    Send a customized email notification about the next steps of the application directly to <strong>{personal.name || applicant?.display_name}</strong>.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Template</label>
                      <select 
                        onChange={(e) => handleSelectTemplate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm font-semibold text-slate-700"
                      >
                        <option value="interview">Schedule Technical Interview</option>
                        <option value="assignment">Request Take-Home Assignment</option>
                        <option value="offer">Send Job Offer Letter</option>
                        <option value="custom">Custom Message</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Message Content</label>
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        rows={6}
                        className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-750 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all leading-relaxed"
                      />
                    </div>

                    <button
                      onClick={handleSendEmail}
                      disabled={sendingEmail}
                      className="w-full py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 duration-200 text-sm flex items-center justify-center gap-2"
                    >
                      {sendingEmail ? 'Sending Notification...' : 'Send Next Steps Email'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
