import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Calendar as CalendarIcon, Video, MapPin, Phone,
  Clock, CheckCircle, Send, Plus, Loader2, AlertCircle, Sparkles
} from 'lucide-react'
import api from '../config/api'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

export default function InterviewSchedulerPage() {
  const { id } = useParams() // candidate applicant id
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [applicant, setApplicant] = useState(null)

  // Form states
  const [interviewType, setInterviewType] = useState('technical')
  const [format, setFormat] = useState('video')
  const [duration, setDuration] = useState(60)
  const [agenda, setAgenda] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [interviewers, setInterviewers] = useState(['david@careersync.ai', 'maria@careersync.ai'])
  const [newInterviewer, setNewInterviewer] = useState('')

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

  const handleAddInterviewer = () => {
    if (!newInterviewer.trim()) return
    if (!newInterviewer.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    if (interviewers.includes(newInterviewer)) {
      toast.error('Interviewer already added')
      return
    }
    setInterviewers(prev => [...prev, newInterviewer.trim()])
    setNewInterviewer('')
    toast.success('Interviewer added to panel')
  }

  const handleRemoveInterviewer = (email) => {
    setInterviewers(prev => prev.filter(e => e !== email))
  }

  const handleConfirmSchedule = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error('Please select both a date and time slot')
      return
    }

    setSubmitting(true)
    try {
      const dateTimeStr = `${selectedDate}T${selectedTime}:00`
      await api.post('/api/interviews/schedule', {
        applicant_id: applicant.id,
        interview_type: interviewType,
        format,
        duration,
        date_time: dateTimeStr,
        interviewers,
        notes: agenda
      })

      toast.success('Interview scheduled successfully! Notification emails sent.')
      // Navigate back to talent profile
      setTimeout(() => {
        navigate(`/employer/talent/${id}`)
      }, 1500)
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.detail || 'Failed to schedule interview')
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

  // Generate simple day grids for calendar slot picker (next 5 weekdays)
  const getNextFiveWeekdays = () => {
    const dates = []
    let current = new Date()
    while (dates.length < 5) {
      current.setDate(current.getDate() + 1)
      const day = current.getDay()
      if (day !== 0 && day !== 6) { // skip weekends
        dates.push(new Date(current))
      }
    }
    return dates
  }

  const weekdays = getNextFiveWeekdays()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <button
            onClick={() => navigate(`/employer/talent/${id}`)}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Schedule Interview: {applicant.display_name}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Role: Lead React Developer • Location: {applicant.location_city || 'Remote'}
            </p>
          </div>
        </div>

        {/* 3-Column Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Settings */}
          <div className="space-y-6">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Clock className="text-primary-500" size={18} /> Interview Settings
              </h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Round Type</label>
                  <select
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-semibold"
                    value={interviewType}
                    onChange={(e) => setInterviewType(e.target.value)}
                  >
                    <option value="technical">Technical Round</option>
                    <option value="screening">Initial Screening</option>
                    <option value="system">System Design</option>
                    <option value="culture">Culture Fit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Format</label>
                  <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
                    {['video', 'in-person', 'phone'].map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setFormat(fmt)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                          format === fmt
                            ? 'bg-white dark:bg-slate-900 shadow-sm text-primary-500'
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50/50'
                        }`}
                      >
                        {fmt === 'video' ? 'Video' : fmt === 'in-person' ? 'In-Person' : 'Phone'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Duration</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[30, 45, 60, 90].map(dur => (
                      <button
                        key={dur}
                        onClick={() => setDuration(dur)}
                        className={`py-1.5 border rounded-xl text-xs font-bold transition-all ${
                          duration === dur
                            ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {dur} Min
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-3">
              <h2 className="text-md font-bold text-slate-800 dark:text-slate-200">Notes & Agenda</h2>
              <textarea
                rows={4}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                placeholder="Details of the focus area or tasks recruiters/interviewers should probe..."
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
              />
            </section>
          </div>

          {/* Column 2: Date & Time slot picker */}
          <div>
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 h-full">
              <h2 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <CalendarIcon className="text-primary-500" size={18} /> Select Date & Time
              </h2>
              
              <div className="bg-gradient-to-r from-primary-500/5 to-indigo-500/5 border border-primary-500/10 rounded-2xl p-4 flex gap-3 items-start">
                <Sparkles className="text-primary-500 shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-bold">AI Slot Suggestion</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Highest overlap with recruiter availability:
                  </p>
                  <button
                    onClick={() => {
                      const suggest = weekdays[0]
                      setSelectedDate(suggest.toISOString().split('T')[0])
                      setSelectedTime('14:00')
                    }}
                    className="mt-2 text-xs bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-primary-500/20 font-bold hover:bg-slate-50 text-primary-500"
                  >
                    Select Tomorrow at 2:00 PM
                  </button>
                </div>
              </div>

              {/* Day Grid */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Available Days</label>
                  <div className="grid grid-cols-5 gap-2">
                    {weekdays.map((dateObj, idx) => {
                      const dateStr = dateObj.toISOString().split('T')[0]
                      const isSelected = selectedDate === dateStr
                      const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                      const dayNum = dateObj.getDate()
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedDate(dateStr)}
                          className={`p-2 border rounded-xl flex flex-col items-center transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{dayLabel}</span>
                          <span className="text-sm font-black mt-1">{dayNum}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Available Time Slots</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'].map((time) => {
                      const isSelected = selectedTime === time
                      return (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all text-center ${
                            isSelected
                              ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          {time}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Column 3: Interviewers & Summary */}
          <div className="space-y-6">
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-md font-bold text-slate-800 dark:text-slate-200">Interview Panel</h2>
              
              <div className="space-y-2">
                {interviewers.map((email, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/80">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{email}</span>
                    <button
                      onClick={() => handleRemoveInterviewer(email)}
                      className="text-xs text-rose-500 hover:underline font-bold px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="interviewer@company.com"
                  className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none"
                  value={newInterviewer}
                  onChange={(e) => setNewInterviewer(e.target.value)}
                />
                <button
                  onClick={handleAddInterviewer}
                  className="px-3 py-2 bg-slate-900 text-white dark:bg-slate-800 dark:hover:bg-slate-750 text-xs font-bold rounded-xl flex items-center gap-1"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </section>

            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-md font-bold text-slate-800 dark:text-slate-200">Summary</h2>
              
              <div className="text-xs space-y-2 border-b border-slate-100 dark:border-slate-850 pb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Candidate:</span>
                  <span className="font-bold">{applicant.display_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Round:</span>
                  <span className="font-bold capitalize">{interviewType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Format:</span>
                  <span className="font-bold capitalize">{format}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Schedule:</span>
                  <span className="font-bold text-right">
                    {selectedDate ? `${selectedDate} at ${selectedTime}` : 'Not selected'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleConfirmSchedule}
                disabled={submitting}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-opacity disabled:opacity-50"
              >
                <Send size={14} />
                {submitting ? 'Scheduling...' : 'Confirm & Schedule'}
              </button>
            </section>
          </div>

        </div>

      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
