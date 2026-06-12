import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Brain,
  FileText,
  Handshake,
  Mic2,
  GraduationCap,
  Lock,
  CheckCircle,
  Sparkles,
} from 'lucide-react'
import secureStorage from '../utils/secureStorage'

const features = [
  {
    icon: Brain,
    title: 'AI Profile Analysis',
    description: 'Deep insights into your career trajectory based on market trends and skill signals.',
  },
  {
    icon: FileText,
    title: 'Resume Processing',
    description: 'Instantly structure complex resume data into an interactive candidate profile.',
  },
  {
    icon: Handshake,
    title: 'Precision Matching',
    description: 'Find roles aligned to your exact experience, skill graph, and growth aspirations.',
  },
  {
    icon: Mic2,
    title: 'AI Mock Interviews',
    description: 'Simulate live technical rounds and receive actionable, structured scoring feedback.',
  },
  {
    icon: GraduationCap,
    title: 'Targeted Roadmaps',
    description: 'Follow personalized, gap-focused learning paths that close your skill gaps faster.',
  },
  {
    icon: Lock,
    title: 'Privacy & Security',
    description: 'Your profile and application history stay protected with secure encryption.',
  },
]

const outcomes = [
  'Parsed Candidate Profile',
  'AI Recommended Roles',
  'Mock Interview Scorecard',
  'Customized Learning Paths',
]

const steps = [
  {
    number: '1',
    title: 'Upload Profile',
    description: 'Upload your resume in PDF/DOCX to build a structured profile in seconds.',
  },
  {
    number: '2',
    title: 'Get AI Insights',
    description: 'See compatible career directions, skill gaps, and interview readiness levels.',
  },
  {
    number: '3',
    title: 'Land Your Dream Job',
    description: 'Apply with confidence using targeted mock practice and skill roadmaps.',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { y: 25, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
}

export default function Hero() {
  const navigate = useNavigate()

  const handleGetStarted = () => {
    const token = secureStorage.getItem('token')
    const user = secureStorage.getItem('user')

    if (token && user?.role) {
      navigate('/dashboard')
      return
    }

    navigate('/register')
  }

  return (
    <div className="bg-slate-50/40 relative min-h-screen overflow-hidden">
      
      {/* Ambient background glows / pass */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            x: [0, 40, -20, 0],
            y: [0, -50, 30, 0],
            scale: [1, 1.15, 0.9, 1]
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute left-1/4 top-10 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-primary-400/10 to-indigo-450/10 blur-[130px]"
        />
        <motion.div
          animate={{
            x: [0, -30, 50, 0],
            y: [0, 40, -45, 0],
            scale: [1, 0.9, 1.1, 1]
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute right-1/4 top-1/4 h-[550px] w-[550px] rounded-full bg-gradient-to-br from-sky-400/10 to-emerald-450/10 blur-[140px]"
        />
        <motion.div
          animate={{
            x: [0, 40, -30, 0],
            y: [0, 30, 60, 0],
            scale: [1, 1.1, 0.95, 1]
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute left-1/3 bottom-10 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-purple-400/10 to-pink-400/10 blur-[120px]"
        />
      </div>

      {/* Hero Header Section */}
      <section className="pt-28 pb-12 sm:pt-32 sm:pb-16 relative z-10 border-b border-slate-100/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-6 shadow-sm">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>AI-Powered Career Growth</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-tight">
              Accelerate Your Career with <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-650">AI-Powered</span> Guidance
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
              Get personalized job matches, profile analysis, interactive mock interviews, and gap-focused learning paths in one cohesive platform.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4 max-w-md mx-auto">
              <button
                type="button"
                onClick={handleGetStarted}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md shadow-primary-500/10 hover:shadow-primary-500/20 transition-all duration-200 active:scale-95"
              >
                Get Started
                <ArrowRight className="w-4.5 h-4.5 animate-bounce" />
              </button>
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold rounded-xl shadow-sm transition-all duration-200 active:scale-95"
              >
                Start Mock Prep
              </Link>
            </div>

            <p className="mt-4 text-xs font-semibold text-slate-400">Free to start · No credit card required</p>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left sm:text-center">
              <div className="border border-gray-200 bg-white rounded-2xl px-5 py-4 shadow-sm">
                <p className="text-2xl font-black text-slate-900 animate-pulse">50k+</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Jobs Added Daily</p>
              </div>
              <div className="border border-gray-200 bg-white rounded-2xl px-5 py-4 shadow-sm">
                <p className="text-2xl font-black text-slate-900">10k+</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Success Stories</p>
              </div>
              <div className="border border-gray-200 bg-white rounded-2xl px-5 py-4 shadow-sm">
                <p className="text-2xl font-black text-slate-900">98%</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Match Accuracy</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 sm:py-20 relative z-10 border-b border-slate-100/80">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Features Built for Success</h2>
            <p className="mt-3 text-slate-500 leading-relaxed">
              Everything you need to analyze your profile, practice interviewing, and discover career paths.
            </p>
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <motion.div 
                  key={feature.title} 
                  variants={itemVariants}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="bg-white border border-gray-200 hover:border-primary-200 rounded-3xl p-6 shadow-sm hover:shadow-[0_20px_45px_rgba(15,23,42,0.05)] transition-all duration-300 flex flex-col h-full group relative overflow-hidden text-left"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500/0 to-primary-500 group-hover:from-primary-500 group-hover:to-indigo-500 transition-all duration-300" />
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6 text-primary-700" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary-900 transition-colors">{feature.title}</h3>
                  <p className="mt-3 text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Outcome Section */}
      <section className="py-16 sm:py-20 border-b border-slate-100/80 bg-gray-50/60 relative z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Instant Profile Enrichment</h2>
            <p className="mt-3 text-slate-500 leading-relaxed">Skip manual entries. Build a structured profile from your resume instantly.</p>
          </div>
          
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {outcomes.map((item) => (
              <motion.div 
                key={item} 
                variants={itemVariants}
                whileHover={{ scale: 1.02, x: 5 }}
                className="bg-white border border-gray-200 hover:border-emerald-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm transition-all duration-300 text-left"
              >
                <div className="p-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-slate-800 font-bold text-sm tracking-wide">{item}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-16 sm:py-20 border-b border-slate-100/80 relative z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Your Path to Success in 3 Steps</h2>
            <p className="mt-3 text-slate-500 leading-relaxed">Simple, structured, and outcome-oriented.</p>
          </div>
          
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {steps.map((step) => (
              <motion.div 
                key={step.number} 
                variants={itemVariants}
                whileHover={{ y: -5 }}
                className="border border-gray-200 bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-black flex items-center justify-center mb-5 shadow-sm shadow-primary-500/10">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-20 border-b border-slate-100/80 bg-gray-50/60 relative z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-3xl p-8 shadow-sm flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-primary-500 to-indigo-500" />
            <p className="text-slate-800 text-lg sm:text-xl font-medium leading-relaxed italic max-w-2xl">
              "Career Guidance AI did not just help me apply faster. It helped me focus on the right roles and improve my interview performance with clear feedback."
            </p>
            <div className="mt-6 flex flex-col items-center">
              <p className="font-extrabold text-slate-900 text-base">Deep Podder</p>
              <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">Senior Software Engineer</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-24 relative z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Ready to Level Up Your Career?</h2>
            <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed text-base sm:text-lg">
              Join professionals using Career Guidance AI to discover matches and prep with absolute clarity.
            </p>
            <Link
              to="/register"
              onClick={(event) => {
                const token = secureStorage.getItem('token')
                const user = secureStorage.getItem('user')
                if (token && user?.role) {
                  event.preventDefault()
                  navigate('/dashboard')
                }
              }}
              className="mt-8 inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-extrabold shadow-lg shadow-primary-500/10 hover:shadow-primary-500/25 transition-all duration-200 active:scale-95 text-center"
            >
              Get Started for Free
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
