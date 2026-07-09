import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Users, MessageSquare, Coffee, Bookmark, BookmarkCheck,
  Sparkles, CheckCircle2, ChevronRight, User, GraduationCap,
  Briefcase, Filter, RotateCcw, Send, AlertCircle
} from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

// Realistic Mock Mentor Data
const MOCK_MENTORS = [
  {
    id: 1,
    name: 'Dr. Sarah Jenkins',
    role: 'Senior Data Scientist',
    company: 'TechNova',
    alumniYear: "'15",
    avatar: 'https://ui-avatars.com/api/?name=Sarah+Jenkins&background=6366f1&color=fff&size=128&bold=true',
    matchScore: 98,
    status: 'Available for Coffee Chats',
    type: 'Alumni',
    skills: ['Machine Learning', 'Python', 'Career Transition'],
    bio: 'Sarah leads ML research at TechNova. She loves helping students bridge the gap between academic theory and industry engineering.'
  },
  {
    id: 2,
    name: 'Marcus Lin',
    role: 'Product Manager',
    company: 'FinStream',
    alumniYear: "'18",
    avatar: 'https://ui-avatars.com/api/?name=Marcus+Lin&background=10b981&color=fff&size=128&bold=true',
    matchScore: 92,
    status: 'Resume Reviews',
    type: 'Alumni',
    skills: ['Product Strategy', 'Agile Methodologies', 'User Research'],
    bio: 'Marcus transition from software developer to PM. Can help with resume polishing, interview prep, and product design fundamentals.'
  },
  {
    id: 3,
    name: 'Elena Rodriguez',
    role: 'UX Architect',
    company: 'DesignStudio',
    alumniYear: "'16",
    avatar: 'https://ui-avatars.com/api/?name=Elena+Rodriguez&background=ec4899&color=fff&size=128&bold=true',
    matchScore: 89,
    status: 'Portfolio Review',
    type: 'Industry Expert',
    skills: ['Figma', 'UI/UX Design', 'Design Systems'],
    bio: 'Passionate about human-centered design. Available for website critiques and design-career guidance.'
  },
  {
    id: 4,
    name: 'David Chen',
    role: 'Staff Engineer',
    company: 'CloudScale Corp',
    alumniYear: "'14",
    avatar: 'https://ui-avatars.com/api/?name=David+Chen&background=3b82f6&color=fff&size=128&bold=true',
    matchScore: 87,
    status: 'Available for Coffee Chats',
    type: 'Alumni',
    skills: ['Kubernetes', 'Go', 'Distributed Systems'],
    bio: '10+ years scaling cloud platforms. I can advise on system design interviews and backend architecture tracks.'
  },
  {
    id: 5,
    name: 'Aisha Rahman',
    role: 'Engineering Manager',
    company: 'Innovate AI',
    alumniYear: "'17",
    avatar: 'https://ui-avatars.com/api/?name=Aisha+Rahman&background=f59e0b&color=fff&size=128&bold=true',
    matchScore: 85,
    status: 'Mock Interviews',
    type: 'Industry Expert',
    skills: ['System Design', 'Leadership', 'Java'],
    bio: 'I manage a team of 12 engineers. I offer guidance on behavioural interviews and transitioning to leadership roles.'
  }
]

export default function NetworkHubPage() {
  const toast = useToast()
  const [mentors, setMentors] = useState(MOCK_MENTORS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('all')
  const [bookmarkedMentors, setBookmarkedMentors] = useState([])
  const [chatRequests, setChatRequests] = useState([])
  
  const handleToggleBookmark = (id) => {
    if (bookmarkedMentors.includes(id)) {
      setBookmarkedMentors(prev => prev.filter(mid => mid !== id))
      toast.success('Removed mentor from bookmarks')
    } else {
      setBookmarkedMentors(prev => [...prev, id])
      toast.success('Saved mentor to bookmarks')
    }
  }

  const handleRequestChat = (mentor) => {
    if (chatRequests.includes(mentor.id)) {
      toast.error(`Already requested a chat with ${mentor.name}`)
      return
    }
    setChatRequests(prev => [...prev, mentor.id])
    toast.success(`Request sent to ${mentor.name}! We will notify you when they confirm.`)
  }

  // Filtering Logic
  const filteredMentors = mentors.filter(mentor => {
    const matchesSearch = 
      mentor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mentor.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mentor.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mentor.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesFilter = 
      selectedIndustry === 'all' || 
      mentor.skills.some(skill => skill.toLowerCase().includes(selectedIndustry.toLowerCase())) ||
      mentor.company.toLowerCase() === selectedIndustry.toLowerCase()

    return matchesSearch && matchesFilter
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Info banner */}
        <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-4 flex items-center gap-3 text-blue-600 dark:text-blue-400">
          <Sparkles className="shrink-0" size={20} />
          <div className="text-sm font-medium">
            <span className="font-bold">Full Mentor Matching coming soon:</span> Our AI matching algorithm analyzes your parsed resume, suggests optimal networking targets, and unlocks direct email connections.
          </div>
        </div>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary-600 to-indigo-600 dark:from-primary-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Alumni & Mentorship Hub
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              Connect with experienced industry professionals and university alumni to scale your career journey.
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search mentors by name, company, skill..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {['all', 'Machine Learning', 'Product Strategy', 'UI/UX Design', 'Distributed Systems'].map((industry) => (
              <button
                key={industry}
                onClick={() => setSelectedIndustry(industry)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  (selectedIndustry === industry)
                    ? 'bg-primary-600 text-white dark:bg-primary-500'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {industry === 'all' ? 'All Focus Areas' : industry}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main List */}
          <div className="lg:col-span-8 space-y-4">
            {filteredMentors.map((mentor) => {
              const isBookmarked = bookmarkedMentors.includes(mentor.id)
              const hasRequested = chatRequests.includes(mentor.id)
              return (
                <motion.div
                  key={mentor.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="flex gap-4">
                      <img
                        src={mentor.avatar}
                        alt={mentor.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-slate-100 dark:border-slate-800"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-primary-500 transition-colors">
                            {mentor.name}
                          </h3>
                          <span className="text-[10px] font-bold bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded flex items-center gap-0.5">
                            <Sparkles size={10} /> {mentor.matchScore}% Match
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {mentor.role} @ {mentor.company}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {mentor.type} {mentor.alumniYear && `• Class of ${mentor.alumniYear}`} • <span className="text-emerald-500 font-semibold">{mentor.status}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
                    {mentor.bio}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {mentor.skills.map((skill, idx) => (
                      <span key={idx} className="text-xs bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                    <button
                      onClick={() => handleRequestChat(mentor)}
                      className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        hasRequested
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-primary-600 hover:bg-primary-700 text-white dark:bg-primary-500 dark:hover:bg-primary-600'
                      }`}
                    >
                      <Coffee size={14} />
                      {hasRequested ? 'Chat Requested' : 'Request Coffee Chat'}
                    </button>
                    <button
                      onClick={() => handleToggleBookmark(mentor.id)}
                      className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-colors"
                    >
                      {isBookmarked ? (
                        <BookmarkCheck size={16} className="text-primary-500" />
                      ) : (
                        <Bookmark size={16} className="text-slate-400" />
                      )}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Credits Info */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-1.5">
                <Coffee className="text-amber-500" size={16} /> Connection Wallet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                You have {5 - chatRequests.length} coffee chat request invitations remaining this month.
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(5 - chatRequests.length) * 20}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
                <span>{chatRequests.length} Used</span>
                <span>{5 - chatRequests.length} Remaining</span>
              </div>
            </div>

            {/* Active Requests */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4">Active Requests</h4>
              <div className="space-y-3">
                {chatRequests.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                    No active chat requests.
                  </p>
                ) : (
                  chatRequests.map(id => {
                    const mentor = MOCK_MENTORS.find(m => m.id === id)
                    return (
                      <div key={id} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                        <img src={mentor.avatar} className="w-8 h-8 rounded-full" alt="" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{mentor.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{mentor.role}</p>
                        </div>
                        <span className="text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
                          Pending
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>

        </div>

      </div>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </div>
  )
}
