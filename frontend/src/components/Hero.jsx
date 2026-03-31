import React from 'react'
import { Link } from 'react-router-dom'
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

const features = [
  {
    icon: Brain,
    title: 'AI Analysis',
    description: 'Deep insights into your profile based on market trends and skill signals.',
  },
  {
    icon: FileText,
    title: 'Resume Parsing',
    description: 'Instantly structure resume data into a profile ready for matching.',
  },
  {
    icon: Handshake,
    title: 'Job Matching',
    description: 'Find roles aligned to your experience, skill graph, and growth path.',
  },
  {
    icon: Mic2,
    title: 'Interview Practice',
    description: 'Simulate interviews and get actionable, AI-generated feedback.',
  },
  {
    icon: GraduationCap,
    title: 'Learning Paths',
    description: 'Follow practical roadmaps that close your skill gaps faster.',
  },
  {
    icon: Lock,
    title: 'Privacy',
    description: 'Your profile data stays protected with secure storage and access controls.',
  },
]

const outcomes = [
  'Parsed profile',
  'Job recommendations',
  'Interview readiness score',
  'Learning path suggestions',
]

const steps = [
  {
    number: '1',
    title: 'Upload Profile',
    description: 'Upload your resume and create a structured profile in seconds.',
  },
  {
    number: '2',
    title: 'Get AI Insights',
    description: 'See matching opportunities, skill gaps, and readiness indicators.',
  },
  {
    number: '3',
    title: 'Land Your Dream Job',
    description: 'Apply with confidence using interview prep and targeted learning.',
  },
]

export default function Hero() {
  return (
    <div className="bg-white">
      <section className="pt-28 pb-12 sm:pt-32 sm:pb-14 border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs sm:text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Career Growth</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-tight">
              Accelerate Your Career with AI-Powered Guidance
            </h1>
            <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              Get personalized job matches, resume optimization, and interview prep in one platform.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-3">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 transition-colors"
              >
                Upload Resume
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-primary-500 hover:text-primary-700 transition-colors"
              >
                Start Interview Practice
              </Link>
              <Link to="/jobs" className="text-primary-700 font-semibold hover:text-primary-800 transition-colors">
                Browse Jobs
              </Link>
            </div>

            <p className="mt-4 text-sm text-gray-500">Free to start • No credit card required</p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-left sm:text-center">
              <div className="border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-xl font-bold text-gray-900">50k+</p>
                <p className="text-sm text-gray-600">Jobs Added Daily</p>
              </div>
              <div className="border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-xl font-bold text-gray-900">10k+</p>
                <p className="text-sm text-gray-600">Success Stories</p>
              </div>
              <div className="border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-xl font-bold text-gray-900">98%</p>
                <p className="text-sm text-gray-600">Match Accuracy</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-14 sm:py-16 border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Powerful Features for Modern Job Seekers</h2>
            <p className="mt-3 text-gray-600">
              Everything you need to navigate the market and secure your next move.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary-700" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-6">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-14 border-b border-gray-100 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">What you get after upload</h2>
            <p className="mt-2 text-gray-600">Instant value in seconds with no manual data entry.</p>
          </div>
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            {outcomes.map((item) => (
              <div key={item} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary-700" />
                <span className="text-gray-800 font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16 border-b border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Your Path to Success in 3 Steps</h2>
            <p className="mt-3 text-gray-600">Simple, transparent, and built for outcomes.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {steps.map((step) => (
              <div key={step.number} className="border border-gray-200 rounded-lg p-5 bg-white">
                <div className="w-9 h-9 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center mb-4">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-6">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-14 border-b border-gray-100 bg-gray-50/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg p-6 sm:p-8">
            <p className="text-gray-800 text-lg leading-relaxed">
              "Career Guidance AI did not just help me apply faster. It helped me focus on the right roles and improve my interview performance with clear feedback."
            </p>
            <div className="mt-5">
              <p className="font-semibold text-gray-900">Deep Podder</p>
              <p className="text-sm text-gray-600">Senior Software Engineer</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Ready to Level Up Your Career?</h2>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
            Join professionals using Career Guidance AI to move forward with clarity and confidence.
          </p>
          <Link
            to="/register"
            className="mt-7 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
          >
            Get Started Now
          </Link>
        </div>
      </section>
    </div>
  )
}
