import React from 'react'
import { motion } from 'framer-motion'
import { Upload, Sparkles, ArrowRight, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function UploadSection() {
  const navigate = useNavigate()



  return (
    <section id="get-started" className="py-24 md:py-32 bg-white relative overflow-hidden">

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
              Ready to Get Started?
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
              Create a free account and start discovering your perfect career path today
            </p>
          </div>

          <div className="relative bg-gray-50 border border-gray-200 rounded-2xl p-12 md:p-16">
            {/* Login/Register Prompt */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-xl bg-primary-50 border border-primary-200 mb-8">
                <Sparkles className="w-12 h-12 text-primary-500" />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-gray-900">Start Your Journey</h3>
              <p className="text-gray-600 mb-10 max-w-lg mx-auto text-lg">
                Join thousands of students and professionals discovering their ideal career path with AI-powered insights
              </p>
              
              <div className="flex flex-col items-center justify-center mb-10">
                <button
                  onClick={() => navigate('/register')}
                  className="group relative inline-flex items-center justify-center px-10 py-5 text-lg font-semibold text-white bg-primary-500 rounded-lg overflow-hidden transition-all duration-200 hover:bg-primary-600 hover:shadow-lg"
                >
                  <span className="relative z-10 flex items-center space-x-2">
                    <span>Get Started</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                  </span>
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-4 text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
                >
                  Already have an account? <span className="text-primary-500 hover:text-primary-600 font-semibold">Sign in</span>
                </button>
              </div>

              <div className="flex items-center justify-center space-x-8 pt-8 border-t border-gray-200">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Shield className="w-4 h-4" />
                  <span>Secure & Private</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>•</span>
                  <span>Free Forever</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
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
