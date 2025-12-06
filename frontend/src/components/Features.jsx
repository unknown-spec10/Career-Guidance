import React from 'react'
import { motion } from 'framer-motion'
import { Brain, FileText, TrendingUp, Shield, Zap, Target } from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Analysis',
    description: 'Advanced machine learning algorithms analyze your resume to extract skills, experience, and potential.'
  },
  {
    icon: FileText,
    title: 'Intelligent Parsing',
    description: 'Automatically extracts education, skills, projects, and work experience from any resume format.'
  },
  {
    icon: Target,
    title: 'Smart Matching',
    description: 'Get matched with colleges and jobs that align perfectly with your skills and career goals.'
  },
  {
    icon: TrendingUp,
    title: 'Market Insights',
    description: 'Skills ranked by real-time market demand using comprehensive job market analysis.'
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Your data is encrypted and stored securely. We never share your information without consent.'
  },
  {
    icon: Zap,
    title: 'Instant Results',
    description: 'Get comprehensive analysis and recommendations in seconds, not days.'
  }
]

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 bg-gray-50 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
            Everything You Need
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Powerful features designed to help you make informed career decisions
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative bg-white border border-gray-200 rounded-xl p-8 hover:border-primary-500 hover:shadow-lg transition-all duration-200"
            >
              <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-lg bg-primary-50 mb-6 group-hover:bg-primary-100 transition-all duration-200">
                <feature.icon className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
