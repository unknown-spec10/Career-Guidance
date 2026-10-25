import React from 'react'
import { Globe, Github, Linkedin } from 'lucide-react'

const socialLink = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface-raised text-ink-subtle shadow-soft-xs transition-colors duration-200 hover:border-hairline-strong hover:text-primary-700 dark:hover:text-primary-300'

const footerLink = 'text-caption font-medium text-ink-muted transition-colors duration-200 hover:text-primary-700 dark:hover:text-primary-300'

export default function Footer() {
  return (
    <footer id="about" className="border-t border-hairline bg-canvas py-section-sm font-body transition-colors">
      <div className="landing-shell max-w-6xl">
        <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-5">
          {/* Brand */}
          <div className="col-span-1 space-y-4 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="CareerSync Logo" className="h-8 w-8 rounded-[10px] object-contain" />
              <span className="font-display text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">
                CareerSync AI
              </span>
            </div>
            <p className="max-w-md text-caption leading-relaxed text-ink-muted">
              Empowering academic and professional transitions through advanced AI intelligence.
            </p>
            <div className="flex gap-2.5 pt-2">
              <a href="#" aria-label="Website" className={socialLink}>
                <Globe className="h-4 w-4" />
              </a>
              <a href="#" aria-label="GitHub" className={socialLink}>
                <Github className="h-4 w-4" />
              </a>
              <a href="#" aria-label="LinkedIn" className={socialLink}>
                <Linkedin className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="eyebrow mb-4">Platform</h3>
            <ul className="space-y-2.5">
              <li><a href="#" className={footerLink}>Skill Mapping</a></li>
              <li><a href="#" className={footerLink}>Interview Prep</a></li>
              <li><a href="#" className={footerLink}>Job Discovery</a></li>
              <li><a href="#" className={footerLink}>Enterprise</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="eyebrow mb-4">Resources</h3>
            <ul className="space-y-2.5">
              <li><a href="#" className={footerLink}>Career Blog</a></li>
              <li><a href="#" className={footerLink}>API Docs</a></li>
              <li><a href="#" className={footerLink}>Student Guides</a></li>
              <li><a href="#" className={footerLink}>Market Trends</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="eyebrow mb-4">Legal</h3>
            <ul className="space-y-2.5">
              <li><a href="#" className={footerLink}>Privacy Policy</a></li>
              <li><a href="#" className={footerLink}>Terms of Use</a></li>
              <li><a href="#" className={footerLink}>Cookie Policy</a></li>
              <li><a href="#" className={footerLink}>Security</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-hairline pt-8 text-caption font-medium text-ink-subtle sm:flex-row">
          <p>© {new Date().getFullYear()} CareerSync AI Inc. All rights reserved.</p>
          
          <div className="flex select-none items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Systems Operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
