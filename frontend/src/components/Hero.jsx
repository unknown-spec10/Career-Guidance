import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  ArrowRight, Sparkles, Star, Shield, Briefcase, 
  MapPin, CheckCircle, Brain, Play, Compass, Code, 
  Target, Zap, GraduationCap, Check
} from 'lucide-react'
import secureStorage from '../utils/secureStorage'

export default function Hero() {
  const navigate = useNavigate()
  const [emailInput, setEmailInput] = useState('')

  const handleGetStarted = () => {
    const token = secureStorage.getItem('token')
    const user = secureStorage.getItem('user')

    if (token && user?.role) {
      navigate('/dashboard')
    } else {
      navigate('/register')
    }
  }

  const handleEarlyAccess = (e) => {
    e.preventDefault()
    if (emailInput.trim()) {
      navigate(`/register?email=${encodeURIComponent(emailInput.trim())}`)
    } else {
      navigate('/register')
    }
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative min-h-screen overflow-hidden pt-16 font-sans">
      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] dark:opacity-[0.02] pointer-events-none z-0" />
      
      {/* Background ambient radial glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          animate={{
            x: [0, 40, -40, 0],
            y: [0, -50, 50, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute left-10 top-20 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-primary-500/10 to-indigo-500/10 dark:from-primary-500/5 dark:to-indigo-500/5 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -30, 30, 0],
            y: [0, 40, -40, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute right-10 top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-purple-400/5 to-pink-400/10 dark:from-purple-400/2 dark:to-pink-400/5 blur-[140px]"
        />
      </div>

      {/* --- HERO SECTION --- */}
      <section className="relative z-10 pt-16 pb-20 sm:pt-24 lg:pt-32 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Headline */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Tag Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/40 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider shadow-sm">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>AI-Powered Career Transition Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black tracking-tight text-slate-900 dark:text-white leading-[1.1] transition-colors">
              Your Professional Journey, <br />
              <span className="text-primary-600 dark:text-primary-400 bg-gradient-to-r from-primary-600 to-indigo-600 dark:from-primary-400 dark:to-indigo-400 bg-clip-text text-transparent">Precisely Synchronized.</span>
            </h1>

            <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed">
              Bridge the gap between academics and industry. CareerSync AI maps your unique potential to the global job market with clinical precision.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              <button 
                onClick={handleGetStarted}
                className="bg-primary-600 hover:bg-primary-750 text-white font-extrabold px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary-500/10 hover:shadow-primary-500/20 hover:scale-102 transition-all cursor-pointer"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button 
                onClick={handleGetStarted}
                className="bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-extrabold px-6 py-3.5 rounded-2xl flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors shadow-sm cursor-pointer"
              >
                <span>View Demo</span>
              </button>
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-4 pt-6 border-t border-slate-100 dark:border-slate-800 max-w-md">
              {/* Avatar stack */}
              <div className="flex -space-x-2.5">
                {[
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80',
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80'
                ].map((src, idx) => (
                  <img 
                    key={idx} 
                    src={src} 
                    alt="User Avatar" 
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 object-cover"
                  />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  Trusted by 12,000+ students globally
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Mockup Widget */}
          <div className="lg:col-span-5 relative flex justify-center lg:justify-end">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 shadow-2xl p-5 relative overflow-hidden select-none">
              
              {/* Career Match Engine header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-500 border border-primary-100 dark:border-primary-900/40">
                    <Brain className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-250 leading-none">Career Match Engine</p>
                    <p className="text-[9px] font-semibold text-slate-400 mt-0.5">REAL-TIME ANALYTICS</p>
                  </div>
                </div>
                <span className="text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 border border-emerald-100 dark:border-emerald-900/30 rounded-full">
                  96% Match
                </span>
              </div>

              {/* Rows */}
              <div className="mt-4 space-y-3.5">
                {/* Row 1 */}
                <div className="p-3 border border-slate-100 dark:border-slate-900 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-black text-slate-850 dark:text-slate-200">Senior Product Designer</h4>
                    <div className="flex gap-1 mt-1.5">
                      <span className="text-[8px] font-bold text-slate-500 bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-850">UX RESEARCH</span>
                      <span className="text-[8px] font-bold text-slate-500 bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-850">FIGMA</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20 px-2 py-0.5 border border-primary-100/60 dark:border-primary-900/40 rounded-lg">
                    $140k+
                  </span>
                </div>

                {/* Row 2 */}
                <div className="p-3 border border-slate-100 dark:border-slate-900 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-black text-slate-850 dark:text-slate-200">AI Research Engineer</h4>
                    <div className="flex gap-1 mt-1.5">
                      <span className="text-[8px] font-bold text-slate-500 bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-850">PYTHON</span>
                      <span className="text-[8px] font-bold text-slate-500 bg-white dark:bg-slate-950 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-850">PYTORCH</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/20 px-2 py-0.5 border border-primary-100/60 dark:border-primary-900/40 rounded-lg">
                    $165k+
                  </span>
                </div>
              </div>

              {/* Bottom tag block */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-900 flex justify-between items-center text-[10px] font-bold text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-ping" />
                  <span>82% Skills Growth</span>
                </span>
                <span>Match scales...</span>
              </div>

              {/* Verified badge */}
              <div className="absolute -top-3 -right-3 rotate-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-2.5 rounded-2xl shadow-xl flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Resume Verified</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- UNIVERSITY TRUST SECTION --- */}
      <section className="relative z-10 bg-white dark:bg-slate-950 border-y border-slate-150 dark:border-slate-850/80 py-10 transition-colors">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-6">
            Empowering students from world-class institutions
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-slate-400 font-extrabold tracking-widest text-xs sm:text-sm">
            {['STANFORD', 'MIT', 'HARVARD', 'BERKELEY', 'CARNEGIE MELLON'].map((uni) => (
              <span key={uni} className="hover:text-slate-500 transition-colors">{uni}</span>
            ))}
          </div>
        </div>
      </section>

      {/* --- STATISTICS SECTION --- */}
      <section className="relative z-10 py-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { val: '93%', lbl: 'Placement Rate' },
            { val: '15k+', lbl: 'AI Resume Audits' },
            { val: '200+', lbl: 'Hiring Partners' },
            { val: '24/7', lbl: 'Career Coaching' }
          ].map((stat, idx) => (
            <div key={idx} className="p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-2xl shadow-sm text-center">
              <p className="text-2xl sm:text-3xl font-black text-primary-600 dark:text-primary-400 leading-none">{stat.val}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">{stat.lbl}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section id="features" className="relative z-10 py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none transition-colors">Engineered for Your Success</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold leading-relaxed">
            We've built an industry-leading infrastructure to ensure your transition from classroom to boardroom is seamless.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Deep Semantic Skills Mapping (Spans 2 columns on medium+) */}
          <div className="md:col-span-2 p-6 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-3xl shadow-sm flex flex-col justify-between min-h-[300px] relative overflow-hidden group">
            <div className="space-y-4 max-w-md z-10">
              <div className="p-3 w-fit rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 border border-indigo-100 dark:border-indigo-900/40">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Deep Semantic Skills Mapping</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
                Our LLM-powered engine doesn't just look for keywords. It understands the underlying concepts and technical depth of your projects, matching you with roles where you'll truly thrive.
              </p>
            </div>
            
            <div className="pt-6 z-10">
              <Link 
                to="/register" 
                className="inline-flex items-center gap-1 text-xs font-bold text-primary-650 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-350 transition-colors uppercase tracking-wider"
              >
                <span>Learn how it works</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Abstract floating nodes inside card */}
            <div className="absolute right-[-20px] bottom-[-20px] opacity-15 dark:opacity-10 group-hover:scale-105 transition-transform duration-300 pointer-events-none select-none">
              <svg viewBox="0 0 180 180" className="w-40 h-40">
                <rect x="10" y="10" width="60" height="40" rx="6" fill="#4f46e5" />
                <rect x="90" y="30" width="70" height="35" rx="6" fill="#3b82f6" />
                <rect x="30" y="80" width="80" height="40" rx="6" fill="#8b5cf6" />
                <line x1="40" y1="30" x2="125" y2="47" stroke="#475569" strokeWidth="2" />
                <line x1="70" y1="100" x2="125" y2="47" stroke="#475569" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Card 2: Technical Interview Ready */}
          <div className="p-6 bg-primary-600 dark:bg-primary-950/20 border border-primary-700 dark:border-primary-900/40 rounded-3xl shadow-sm text-white flex flex-col justify-between min-h-[300px]">
            <div className="space-y-4">
              <div className="p-3 w-fit rounded-2xl bg-white/10 text-white border border-white/10">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black dark:text-white">Technical Interview Ready</h3>
              <p className="opacity-90 dark:text-slate-300 text-xs sm:text-sm font-medium leading-relaxed">
                AI-driven simulations tailored to the specific company and role you're targeting. Practice voice responses and receive structured score breakdowns.
              </p>
            </div>

            <button
              onClick={handleGetStarted}
              className="w-full py-3 bg-white text-primary-600 hover:bg-slate-50 dark:bg-primary-600 dark:text-white dark:hover:bg-primary-500 font-extrabold rounded-2xl transition-all shadow-md text-xs cursor-pointer"
            >
              Start Practice
            </button>
          </div>

          {/* Card 3: Dynamic Learning Paths */}
          <div className="p-6 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-3xl shadow-sm flex flex-col justify-between min-h-[260px]">
            <div className="space-y-4">
              <div className="p-3 w-fit rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 border border-emerald-100 dark:border-emerald-900/40">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Dynamic Learning Paths</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
                Instantly identify and bridge skill gaps with curriculum-aligned content from top learning platforms and project repos.
              </p>
            </div>
          </div>

          {/* Card 4: Portfolio Optimization */}
          <div className="md:col-span-2 p-6 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-3xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 min-h-[260px]">
            <div className="space-y-4 max-w-md">
              <div className="p-3 w-fit rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-500 border border-amber-100 dark:border-amber-900/40">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Portfolio Optimization</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
                Automatically highlight your strongest projects and contributions to catch the attention of recruiters. Our engine optimizes your narrative for maximum impact.
              </p>
              <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-400 pt-1">
                <span className="flex items-center gap-1">
                  <Code className="w-3.5 h-3.5 text-primary-500" />
                  <span>GitHub Integration</span>
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Live Hosting</span>
                </span>
              </div>
            </div>

            {/* Circular Progress Gauge */}
            <div className="w-28 h-28 flex-shrink-0 relative flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-900">
              <svg viewBox="0 0 100 100" className="w-24 h-24 transform -rotate-90">
                <circle cx="50" cy="50" r="38" className="stroke-slate-200/60 dark:stroke-slate-800" strokeWidth="7" fill="transparent" />
                <circle cx="50" cy="50" r="38" className="stroke-primary-500" strokeWidth="7" fill="transparent" strokeDasharray="238.7" strokeDashoffset="35.8" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-base font-black text-slate-800 dark:text-slate-200">85%</span>
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS SECTION --- */}
      <section id="how-it-works" className="relative z-10 py-16 bg-white dark:bg-slate-950/40 border-y border-slate-150 dark:border-slate-850/80 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">A Streamlined Journey</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold leading-relaxed">
              How CareerSync AI synchronizes your potential with actual industry demands in three simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Upload Resume', desc: 'Upload your academic CV or resume. Our parser instantly extracts skills and structures your baseline profile.' },
              { step: '02', title: 'Target Gaps', desc: 'Specify your dream job path. The semantic matching engine computes compatibility scores and outlines course gaps.' },
              { step: '03', title: 'Close Gaps', desc: 'Complete interactive milestone paths, simulate voice-based interview practices, and secure placement matches.' }
            ].map((st, sIdx) => (
              <div key={sIdx} className="space-y-4">
                <span className="block text-3xl font-black text-primary-500/20 dark:text-primary-500/10 leading-none">{st.step}</span>
                <h3 className="text-base font-extrabold text-slate-855 dark:text-slate-200">{st.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- TESTIMONIALS SECTION --- */}
      <section id="testimonials" className="relative z-10 py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Loved by Candidates</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Hear from candidates who secured their dream positions using our platform.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              quote: "CareerSync AI did not just help me apply faster. It helped me focus on the right roles and improve my interview performance with clear feedback.",
              author: "Priya Sharma",
              role: "Frontend Engineer, Razorpay",
              avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80"
            },
            {
              quote: "The mock practice simulated the actual technical interview with Razorpay precisely. The real-time Whisper review helped me build confidence.",
              author: "Rohan Das",
              role: "Data Analyst, Zepto",
              avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80"
            }
          ].map((t, tIdx) => (
            <div key={tIdx} className="p-6 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-3xl shadow-sm space-y-4">
              <p className="italic text-slate-600 dark:text-slate-350 text-xs sm:text-sm font-medium leading-relaxed">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-3">
                <img src={t.avatar} alt={t.author} className="w-10 h-10 rounded-full object-cover border border-slate-100 dark:border-slate-800" />
                <div>
                  <h4 className="text-xs font-black text-slate-850 dark:text-slate-200 leading-none">{t.author}</h4>
                  <p className="text-[10px] font-bold text-slate-450 dark:text-slate-400 mt-1">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- PRICING SECTION --- */}
      <section id="pricing" className="relative z-10 py-16 bg-white dark:bg-slate-950/40 border-t border-slate-150 dark:border-slate-850/80 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Simple, Transparent Pricing</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">Get started today for free and unlock premium credits when you are ready to scale.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free Tier */}
            <div className="p-6 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-3xl shadow-sm flex flex-col justify-between min-h-[350px]">
              <div className="space-y-4">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 text-slate-500 px-2.5 py-1 rounded-full">Free Tier</span>
                <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">$0</p>
                <p className="text-xs font-semibold text-slate-400">Perfect to test features and review matches.</p>
                <ul className="space-y-2 text-xs font-semibold text-slate-550 dark:text-slate-350 pt-2">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-primary-500" /> 65 Initial Trial Credits</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-primary-500" /> 1 Mock Practice Session</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-primary-500" /> Basic Job Search Matching</li>
                </ul>
              </div>
              <button 
                onClick={handleGetStarted}
                className="w-full mt-6 py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 font-extrabold rounded-2xl transition-all shadow-sm text-xs cursor-pointer"
              >
                Sign Up Now
              </button>
            </div>

            {/* Premium Tier */}
            <div className="p-6 bg-primary-600 dark:bg-primary-950/20 border border-primary-700 dark:border-primary-900/40 rounded-3xl shadow-sm text-white flex flex-col justify-between min-h-[350px]">
              <div className="space-y-4">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/10 text-white px-2.5 py-1 rounded-full">Premium Tier</span>
                <p className="text-3xl font-black leading-none">$19<span className="text-xs opacity-80 font-normal">/mo</span></p>
                <p className="text-xs opacity-90 dark:text-slate-350">Supercharge your tech prep with continuous mocks.</p>
                <ul className="space-y-2 text-xs font-semibold opacity-95 dark:text-slate-300 pt-2">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white" /> 200 Refillable Weekly Credits</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white" /> Unlimited Mock Practice Mocks</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white" /> Complete AI Weakness scorecard diagnostics</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-white" /> Live Resume re-indexing updates</li>
                </ul>
              </div>
              <button 
                onClick={handleGetStarted}
                className="w-full mt-6 py-3 bg-white text-primary-650 hover:bg-slate-50 dark:bg-primary-600 dark:text-white dark:hover:bg-primary-500 font-extrabold rounded-2xl transition-all shadow-md text-xs cursor-pointer"
              >
                Go Premium
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA BOTTOM BANNER --- */}
      <section className="relative z-10 py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-850 dark:to-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-xl space-y-6">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none transition-colors">
            Start Your Transition Today
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold max-w-md mx-auto leading-relaxed">
            Join thousands of high-performers who have already synchronized their careers with the future of work.
          </p>

          <form onSubmit={handleEarlyAccess} className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto pt-2">
            <input 
              type="email"
              placeholder="Enter your email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm dark:text-white transition-all shadow-sm"
              required
            />
            <button 
              type="submit"
              className="w-full sm:w-auto bg-primary-600 hover:bg-primary-750 text-white font-extrabold px-6 py-3.5 rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-primary-500/10 hover:scale-102 transition-all cursor-pointer whitespace-nowrap"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Get Early Access</span>
            </button>
          </form>

          <p className="text-[10px] font-semibold text-slate-400">
            No credit card required. Free for your first 3 career matches.
          </p>
        </div>
      </section>
    </div>
  )
}
