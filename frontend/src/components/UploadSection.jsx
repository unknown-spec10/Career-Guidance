import React from 'react'
import { motion } from 'framer-motion'
import { Upload, Sparkles, ArrowRight, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function UploadSection() {
  const navigate = useNavigate()



  return (
    <section id="get-started" className="py-24 md:py-32 bg-dark-800 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-primary-500/5 rounded-full filter blur-[120px]"></div>
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] bg-primary-600/5 rounded-full filter blur-[120px]"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Ready to Get Started?
            </h2>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
              Create a free account and start discovering your perfect career path today
            </p>
          </div>

          <div className="relative bg-white/[0.02] backdrop-blur-sm border border-white/10 rounded-3xl p-12 md:p-16">
            {/* Login/Register Prompt */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-500/10 to-primary-600/10 border border-primary-500/20 mb-8">
                <Sparkles className="w-12 h-12 text-primary-400" />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-white">Start Your Journey</h3>
              <p className="text-gray-400 mb-10 max-w-lg mx-auto text-lg">
                Join thousands of students and professionals discovering their ideal career path with AI-powered insights
              </p>
              
              <div className="flex flex-col items-center justify-center mb-10">
                <button
                  onClick={() => navigate('/register')}
                  className="group relative inline-flex items-center justify-center px-10 py-5 text-lg font-semibold text-white bg-primary-600 rounded-xl overflow-hidden transition-all duration-300 hover:bg-primary-700 hover:scale-105 hover:shadow-2xl hover:shadow-primary-500/30"
                >
                  <span className="relative z-10 flex items-center space-x-2">
                    <span>Get Started</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                  </span>
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-4 text-sm text-gray-400 hover:text-white transition-colors duration-200"
                >
                  Already have an account? <span className="text-primary-400 hover:text-primary-300">Sign in</span>
                </button>
              </div>

              <div className="flex items-center justify-center space-x-8 pt-8 border-t border-white/5">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Shield className="w-4 h-4" />
                  <span>Secure & Private</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>•</span>
                  <span>Free Forever</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>•</span>
                  <span>No Credit Card</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
