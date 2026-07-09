import React from 'react'
import { Mail, Globe, Github, Linkedin } from 'lucide-react'

export default function Footer() {
  return (
    <footer id="about" className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-850 py-16 transition-colors font-sans">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="flex items-center space-x-2.5">
              <img src="/logo.png" alt="CareerSync Logo" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                CareerSync AI
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed max-w-md font-medium">
              Empowering academic and professional transitions through advanced AI intelligence.
            </p>
            <div className="flex space-x-3.5 pt-2">
              <a href="#" className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 transition-colors shadow-sm">
                <Globe className="w-4 h-4" />
              </a>
              <a href="#" className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 transition-colors shadow-sm">
                <Github className="w-4 h-4" />
              </a>
              <a href="#" className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 transition-colors shadow-sm">
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-slate-900 dark:text-slate-100 font-extrabold text-xs uppercase tracking-wider mb-4">Platform</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Skill Mapping</a></li>
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Interview Prep</a></li>
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Job Discovery</a></li>
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Enterprise</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-slate-900 dark:text-slate-100 font-extrabold text-xs uppercase tracking-wider mb-4">Resources</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Career Blog</a></li>
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">API Docs</a></li>
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Student Guides</a></li>
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Market Trends</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-slate-900 dark:text-slate-100 font-extrabold text-xs uppercase tracking-wider mb-4">Legal</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Terms of Use</a></li>
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Cookie Policy</a></li>
              <li><a href="#" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Security</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} CareerSync AI Inc. All rights reserved.</p>
          
          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/30 px-3 py-1.5 rounded-full text-emerald-600 dark:text-emerald-400 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Systems Operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
