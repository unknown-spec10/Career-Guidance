import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, MotionConfig } from 'framer-motion'
import { 
  ArrowRight, Sparkles, Star, Shield, CheckCircle, Brain, 
  Compass, Code, Target, Zap, Check
} from 'lucide-react'
import secureStorage from '../utils/secureStorage'

const EASE = [0.22, 1, 0.36, 1]

function Reveal({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

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
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-hidden bg-canvas pt-16 font-body transition-colors duration-300">
        {/* Hairline grid + ambient light — static, low contrast. */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-grid-hairline opacity-70" />
        <div className="pointer-events-none absolute -top-56 left-1/2 z-0 h-[640px] w-[900px] -translate-x-1/2 hero-glow-primary" />
        <div className="pointer-events-none absolute -right-24 top-44 z-0 h-[520px] w-[520px] hero-glow-accent" />

        {/* --- HERO SECTION --- */}
        <section className="landing-shell relative z-10 grid grid-cols-1 items-center gap-14 pb-16 pt-14 sm:pt-20 lg:grid-cols-12 lg:gap-10 lg:pb-24 lg:pt-28">
          {/* Left Column: Headline */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="space-y-6 text-left lg:col-span-7"
          >
            {/* Tag Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-raised px-3.5 py-1.5 shadow-soft-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
              <span className="text-overline uppercase text-ink-muted">AI-Powered Career Transition Platform</span>
            </div>

            <h1 className="font-display text-display-2xl text-balance text-ink transition-colors">
              Your Professional Journey,{' '}
              <span className="bg-gradient-to-r from-primary-700 via-primary-600 to-indigo-600 bg-clip-text text-transparent dark:from-primary-300 dark:via-primary-400 dark:to-indigo-300">
                Precisely Synchronized.
              </span>
            </h1>

            <p className="max-w-xl text-body-lg text-ink-muted">
              Bridge the gap between academics and industry. CareerSync AI maps your unique potential to the global job market with clinical precision.
            </p>

            <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center">
              <button 
                onClick={handleGetStarted}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-6 py-3.5 text-sm font-semibold text-white shadow-soft-sm transition-[transform,background-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-glow-primary dark:bg-primary-500 dark:hover:bg-primary-400"
              >
                <span>Get Started Free</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
              <button 
                onClick={handleGetStarted}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-hairline bg-surface-raised px-6 py-3.5 text-sm font-semibold text-ink shadow-soft-xs transition-colors duration-300 hover:border-hairline-strong hover:bg-surface-sunken"
              >
                <span>View Demo</span>
              </button>
            </div>

            {/* Social Proof */}
            <div className="flex max-w-md items-center gap-4 border-t border-hairline pt-7">
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
                    className="h-9 w-9 rounded-full border-2 border-surface-raised object-cover"
                  />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mt-1 text-caption font-semibold text-ink-subtle">
                  Trusted by 12,000+ students globally
                </p>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Hero Mockup Widget */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.12, ease: EASE }}
            className="relative mx-auto w-full max-w-sm lg:col-span-5 lg:ml-auto lg:mr-0"
          >
            <div className="absolute inset-0 rounded-hero bg-gradient-to-br from-primary-500/15 via-transparent to-indigo-500/15 blur-2xl" />

            <div className="relative select-none rounded-hero border border-hairline bg-surface-raised p-5 shadow-soft-lg">
              {/* Career Match Engine header */}
              <div className="flex items-center justify-between border-b border-hairline pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-card border border-hairline bg-surface-sunken p-2 text-primary-600 dark:text-primary-400">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold leading-none text-ink">Career Match Engine</p>
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Real-time analytics</p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                  96% Match
                </span>
              </div>

              {/* Rows */}
              <div className="mt-4 space-y-3">
                {/* Row 1 */}
                <div className="flex items-start justify-between rounded-card border border-hairline bg-surface-sunken p-3">
                  <div>
                    <h4 className="font-display text-xs font-bold text-ink">Senior Product Designer</h4>
                    <div className="mt-1.5 flex gap-1">
                      <span className="rounded-md border border-hairline bg-surface-raised px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-ink-subtle">UX RESEARCH</span>
                      <span className="rounded-md border border-hairline bg-surface-raised px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-ink-subtle">FIGMA</span>
                    </div>
                  </div>
                  <span className="rounded-lg border border-primary-100 bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300">
                    $140k+
                  </span>
                </div>

                {/* Row 2 */}
                <div className="flex items-start justify-between rounded-card border border-hairline bg-surface-sunken p-3">
                  <div>
                    <h4 className="font-display text-xs font-bold text-ink">AI Research Engineer</h4>
                    <div className="mt-1.5 flex gap-1">
                      <span className="rounded-md border border-hairline bg-surface-raised px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-ink-subtle">PYTHON</span>
                      <span className="rounded-md border border-hairline bg-surface-raised px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-ink-subtle">PYTORCH</span>
                    </div>
                  </div>
                  <span className="rounded-lg border border-primary-100 bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300">
                    $165k+
                  </span>
                </div>
              </div>

              {/* Bottom tag block */}
              <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-[10px] font-semibold text-ink-subtle">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-500 dark:bg-primary-400" />
                  <span>82% Skills Growth</span>
                </span>
                <span>Match scales...</span>
              </div>

              {/* Verified badge */}
              <div className="absolute -right-3 -top-3 flex rotate-3 items-center gap-1.5 rounded-card border border-hairline bg-surface-overlay p-2.5 shadow-soft">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted">Resume Verified</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* --- UNIVERSITY TRUST SECTION --- */}
        <section className="relative z-10 border-y border-hairline bg-surface-raised py-10 transition-colors">
          <div className="landing-shell max-w-5xl text-center">
            <p className="eyebrow mb-6">Empowering students from world-class institutions</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-subtle sm:gap-x-14">
              {['STANFORD', 'MIT', 'HARVARD', 'BERKELEY', 'CARNEGIE MELLON'].map((uni) => (
                <span key={uni} className="transition-colors hover:text-ink">{uni}</span>
              ))}
            </div>
          </div>
        </section>

        {/* --- STATISTICS SECTION --- */}
        <section className="landing-shell relative z-10 py-section-xs">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {[
              { val: '93%', lbl: 'Placement Rate' },
              { val: '15k+', lbl: 'AI Resume Audits' },
              { val: '200+', lbl: 'Hiring Partners' },
              { val: '24/7', lbl: 'Career Coaching' }
            ].map((stat, idx) => (
              <div key={idx} className="surface-card px-5 py-6 text-center">
                <p className="font-display text-2xl font-extrabold leading-none text-primary-700 dark:text-primary-300 sm:text-3xl">{stat.val}</p>
                <p className="mt-2.5 text-overline text-ink-subtle">{stat.lbl}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- FEATURES SECTION --- */}
        <section id="features" className="landing-shell landing-section relative z-10 scroll-mt-24 space-y-12">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-display-xl text-balance text-ink transition-colors">Engineered for Your Success</h2>
            <p className="mx-auto mt-4 max-w-xl text-body text-ink-muted">
              We&apos;ve built an industry-leading infrastructure to ensure your transition from classroom to boardroom is seamless.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
            {/* Card 1: Deep Semantic Skills Mapping (Spans 2 columns on medium+) */}
            <Reveal className="md:col-span-2" delay={0.05}>
              <div className="surface-card surface-card-interactive group relative flex h-full min-h-[300px] flex-col justify-between overflow-hidden p-7">
                <div className="z-10 max-w-md space-y-4">
                  <div className="inline-flex rounded-card border border-hairline bg-surface-sunken p-3 text-indigo-600 dark:text-indigo-400">
                    <Brain className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-title-lg text-ink">Deep Semantic Skills Mapping</h3>
                  <p className="text-body text-ink-muted">
                    Our LLM-powered engine doesn&apos;t just look for keywords. It understands the underlying concepts and technical depth of your projects, matching you with roles where you&apos;ll truly thrive.
                  </p>
                </div>
                
                <div className="z-10 pt-6">
                  <Link 
                    to="/register" 
                    className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary-700 transition-colors hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
                  >
                    <span>Learn how it works</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Abstract floating nodes inside card */}
                <div className="pointer-events-none absolute -bottom-6 -right-6 select-none opacity-10 transition-transform duration-500 group-hover:scale-105 dark:opacity-[0.08]">
                  <svg viewBox="0 0 180 180" className="h-44 w-44">
                    <rect x="10" y="10" width="60" height="40" rx="6" fill="#4f46e5" />
                    <rect x="90" y="30" width="70" height="35" rx="6" fill="#3b82f6" />
                    <rect x="30" y="80" width="80" height="40" rx="6" fill="#8b5cf6" />
                    <line x1="40" y1="30" x2="125" y2="47" stroke="#475569" strokeWidth="2" />
                    <line x1="70" y1="100" x2="125" y2="47" stroke="#475569" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </Reveal>

            {/* Card 2: Technical Interview Ready */}
            <Reveal delay={0.1}>
              <div className="relative flex h-full min-h-[300px] flex-col justify-between overflow-hidden rounded-panel border border-primary-700/40 bg-primary-800 p-7 text-white shadow-soft-sm">
                <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-500/20 blur-3xl" />
                <div className="relative space-y-4">
                  <div className="inline-flex rounded-card border border-primary-600/50 bg-primary-900/70 p-3 text-primary-100">
                    <Shield className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-title-lg">Technical Interview Ready</h3>
                  <p className="text-body text-primary-100/85">
                    AI-driven simulations tailored to the specific company and role you&apos;re targeting. Practice voice responses and receive structured score breakdowns.
                  </p>
                </div>

                <button
                  onClick={handleGetStarted}
                  className="relative mt-6 w-full rounded-full bg-primary-100 px-4 py-3 text-caption font-bold text-primary-800 shadow-soft-xs transition-colors duration-300 hover:bg-primary-200 dark:bg-primary-400 dark:text-primary-950 dark:hover:bg-primary-300"
                >
                  Start Practice
                </button>
              </div>
            </Reveal>

            {/* Card 3: Dynamic Learning Paths */}
            <Reveal delay={0.05}>
              <div className="surface-card surface-card-interactive flex h-full min-h-[260px] flex-col justify-between p-7">
                <div className="space-y-4">
                  <div className="inline-flex rounded-card border border-hairline bg-surface-sunken p-3 text-emerald-600 dark:text-emerald-400">
                    <Compass className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-title-lg text-ink">Dynamic Learning Paths</h3>
                  <p className="text-body text-ink-muted">
                    Instantly identify and bridge skill gaps with curriculum-aligned content from top learning platforms and project repos.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Card 4: Portfolio Optimization */}
            <Reveal className="md:col-span-2" delay={0.1}>
              <div className="surface-card surface-card-interactive flex h-full min-h-[260px] flex-col items-center justify-between gap-6 p-7 sm:flex-row">
                <div className="max-w-md space-y-4">
                  <div className="inline-flex rounded-card border border-hairline bg-surface-sunken p-3 text-amber-600 dark:text-amber-400">
                    <Target className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-title-lg text-ink">Portfolio Optimization</h3>
                  <p className="text-body text-ink-muted">
                    Automatically highlight your strongest projects and contributions to catch the attention of recruiters. Our engine optimizes your narrative for maximum impact.
                  </p>
                  <div className="flex flex-wrap gap-4 pt-1 text-caption font-semibold text-ink-subtle">
                    <span className="flex items-center gap-1.5">
                      <Code className="h-3.5 w-3.5 text-primary-500 dark:text-primary-400" />
                      <span>GitHub Integration</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Live Hosting</span>
                    </span>
                  </div>
                </div>

                {/* Circular Progress Gauge */}
                <div className="relative flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-card border border-hairline bg-surface-sunken">
                  <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
                    <circle cx="50" cy="50" r="38" className="stroke-slate-200/60 dark:stroke-slate-800" strokeWidth="7" fill="transparent" />
                    <circle cx="50" cy="50" r="38" className="stroke-primary-500 dark:stroke-primary-400" strokeWidth="7" fill="transparent" strokeDasharray="238.7" strokeDashoffset="35.8" strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span className="font-display text-base font-bold text-ink">85%</span>
                    <span className="mt-1 text-[7px] font-bold uppercase tracking-[0.18em] text-ink-subtle">Ready</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* --- HOW IT WORKS SECTION --- */}
        <section id="how-it-works" className="relative z-10 scroll-mt-24 border-y border-hairline bg-surface-sunken transition-colors">
          <div className="landing-shell landing-section space-y-12">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-display-xl text-balance text-ink">A Streamlined Journey</h2>
              <p className="mx-auto mt-4 max-w-xl text-body text-ink-muted">
                How CareerSync AI synchronizes your potential with actual industry demands in three simple steps.
              </p>
            </Reveal>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
              {[
                { step: '01', title: 'Upload Resume', desc: 'Upload your academic CV or resume. Our parser instantly extracts skills and structures your baseline profile.' },
                { step: '02', title: 'Target Gaps', desc: 'Specify your dream job path. The semantic matching engine computes compatibility scores and outlines course gaps.' },
                { step: '03', title: 'Close Gaps', desc: 'Complete interactive milestone paths, simulate voice-based interview practices, and secure placement matches.' }
              ].map((st, sIdx) => (
                <Reveal key={sIdx} delay={sIdx * 0.06}>
                  <div className="space-y-3 border-t border-hairline pt-6">
                    <span className="block font-display text-4xl font-extrabold leading-none text-primary-200 dark:text-primary-500/25">{st.step}</span>
                    <h3 className="font-display text-title text-ink">{st.title}</h3>
                    <p className="text-body text-ink-muted">{st.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* --- TESTIMONIALS SECTION --- */}
        <section id="testimonials" className="landing-shell landing-section relative z-10 scroll-mt-24 space-y-12">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-display-xl text-balance text-ink">Loved by Candidates</h2>
            <p className="mx-auto mt-4 max-w-xl text-body text-ink-muted">Hear from candidates who secured their dream positions using our platform.</p>
          </Reveal>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
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
              <Reveal key={tIdx} delay={tIdx * 0.06}>
                <figure className="surface-card flex h-full flex-col justify-between gap-6 p-7">
                  <blockquote className="text-body text-ink-muted">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="flex items-center gap-3">
                    <img src={t.avatar} alt={t.author} className="h-10 w-10 rounded-full border border-hairline object-cover" />
                    <div>
                      <p className="font-display text-caption font-bold leading-none text-ink">{t.author}</p>
                      <p className="mt-1.5 text-[11px] font-medium text-ink-subtle">{t.role}</p>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>

        {/* --- PRICING SECTION --- */}
        <section id="pricing" className="relative z-10 scroll-mt-24 border-t border-hairline bg-surface-sunken transition-colors">
          <div className="landing-shell landing-section space-y-12">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-display-xl text-balance text-ink">Simple, Transparent Pricing</h2>
              <p className="mx-auto mt-4 max-w-xl text-body text-ink-muted">Get started today for free and unlock premium credits when you are ready to scale.</p>
            </Reveal>

            <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
              {/* Free Tier */}
              <Reveal>
                <div className="surface-card flex h-full min-h-[350px] flex-col justify-between p-7">
                  <div className="space-y-4">
                    <span className="inline-block rounded-full border border-hairline bg-surface-sunken px-3 py-1 text-overline text-ink-subtle">Free Tier</span>
                    <p className="font-display text-4xl font-extrabold leading-none tracking-tight text-ink">$0</p>
                    <p className="text-caption font-medium text-ink-subtle">Perfect to test features and review matches.</p>
                    <ul className="space-y-2.5 pt-2 text-caption font-medium text-ink-muted">
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary-500 dark:text-primary-400" /> 65 Initial Trial Credits</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary-500 dark:text-primary-400" /> 1 Mock Practice Session</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-primary-500 dark:text-primary-400" /> Basic Job Search Matching</li>
                    </ul>
                  </div>
                  <button 
                    onClick={handleGetStarted}
                    className="mt-7 w-full rounded-full border border-hairline bg-surface-raised px-4 py-3 text-caption font-bold text-ink shadow-soft-xs transition-colors duration-300 hover:border-hairline-strong hover:bg-surface-sunken"
                  >
                    Sign Up Now
                  </button>
                </div>
              </Reveal>

              {/* Premium Tier */}
              <Reveal delay={0.06}>
                <div className="relative flex h-full min-h-[350px] flex-col justify-between overflow-hidden rounded-panel border border-primary-700/40 bg-primary-800 p-7 text-white shadow-soft-lg">
                  <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
                  <div className="relative space-y-4">
                    <span className="inline-block rounded-full border border-primary-600/50 bg-primary-900/70 px-3 py-1 text-overline text-primary-100">Premium Tier</span>
                    <p className="font-display text-4xl font-extrabold leading-none tracking-tight">$19<span className="text-sm font-normal text-primary-200">/mo</span></p>
                    <p className="text-caption font-medium text-primary-200">Supercharge your tech prep with continuous mocks.</p>
                    <ul className="space-y-2.5 pt-2 text-caption font-medium text-primary-100">
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-white" /> 200 Refillable Weekly Credits</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-white" /> Unlimited Mock Practice Mocks</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-white" /> Complete AI Weakness scorecard diagnostics</li>
                      <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-white" /> Live Resume re-indexing updates</li>
                    </ul>
                  </div>
                  <button 
                    onClick={handleGetStarted}
                    className="relative mt-7 w-full rounded-full bg-primary-100 px-4 py-3 text-caption font-bold text-primary-800 shadow-soft-xs transition-colors duration-300 hover:bg-primary-200 dark:bg-primary-400 dark:text-primary-950 dark:hover:bg-primary-300"
                  >
                    Go Premium
                  </button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* --- CTA BOTTOM BANNER --- */}
        <section className="landing-shell relative z-10 py-section">
          <Reveal>
            <div className="relative overflow-hidden rounded-hero border border-primary-700/30 bg-gradient-to-br from-primary-800 via-primary-700 to-indigo-800 px-6 py-12 text-center shadow-soft-xl sm:px-12 sm:py-14 dark:from-primary-950 dark:via-primary-900 dark:to-indigo-950">
              <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-indigo-400/15 blur-3xl" />

              <div className="relative space-y-6">
                <h2 className="font-display text-display-xl text-balance text-white">
                  Start Your Transition Today
                </h2>
                <p className="mx-auto max-w-md text-body text-white/75">
                  Join thousands of high-performers who have already synchronized their careers with the future of work.
                </p>

                <form onSubmit={handleEarlyAccess} className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
                  <input 
                    type="email"
                    placeholder="Enter your email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full rounded-full border border-white/15 bg-slate-900/40 px-5 py-3.5 text-sm text-white shadow-soft-xs outline-none transition-all placeholder:text-slate-400 focus:border-primary-300 focus:ring-2 focus:ring-primary-300/30"
                    required
                  />
                  <button 
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-primary-100 px-6 py-3.5 text-sm font-bold text-primary-800 shadow-soft-sm transition-colors duration-300 hover:bg-primary-200 sm:w-auto dark:bg-primary-400 dark:text-primary-950 dark:hover:bg-primary-300"
                  >
                    <Zap className="h-4 w-4 fill-current" />
                    <span>Get Early Access</span>
                  </button>
                </form>

                <p className="text-caption font-medium text-white/55">
                  No credit card required. Free for your first 3 career matches.
                </p>
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </MotionConfig>
  )
}
