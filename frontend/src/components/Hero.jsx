import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, TrendingUp, Star } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Clean gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-white">
        {/* Subtle glow effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary-500/5 rounded-full filter blur-[128px]"></div>
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary-600/5 rounded-full filter blur-[128px]"></div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-20 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center space-x-2 bg-primary-50 border border-primary-200 rounded-full px-5 py-2 mb-8"
          >
            <Star className="w-4 h-4 text-primary-500" fill="currentColor" />
            <span className="text-sm font-medium text-primary-700">AI-Powered Career Guidance Platform</span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 leading-[1.1] tracking-tight"
          >
            <span className="text-gray-900">Discover Your Perfect</span>
            <br />
            <span className="text-primary-500">
              Career Path
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Upload your resume and let our advanced AI match you with colleges and jobs
            that align perfectly with your skills and aspirations.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <a 
              href="/register" 
              className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-primary-500 rounded-lg overflow-hidden transition-all duration-200 hover:bg-primary-600 hover:shadow-lg"
            >
              <span className="relative z-10 flex items-center space-x-2">
                <span>Get Started Free</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
              </span>
            </a>
            <a 
              href="#features" 
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-primary-500 transition-all duration-200"
            >
              <span className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>See How It Works</span>
              </span>
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-3 gap-8 md:gap-12 max-w-3xl mx-auto pt-8 border-t border-gray-200"
          >
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary-500 mb-2">95%</div>
              <div className="text-sm md:text-base text-gray-600 font-medium">Accuracy Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary-500 mb-2">10k+</div>
              <div className="text-sm md:text-base text-gray-600 font-medium">Resumes Analyzed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary-500 mb-2">500+</div>
              <div className="text-sm md:text-base text-gray-600 font-medium">Institutions</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
