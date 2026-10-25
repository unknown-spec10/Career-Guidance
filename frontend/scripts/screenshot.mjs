/**
 * Visual-pass screenshot harness.
 * Boots the Vite dev server, mocks every /api response at the network layer,
 * injects an authenticated session per role, and captures each major route
 * in light+dark themes at desktop+mobile widths into ../screenshots/.
 *
 * Usage: node scripts/screenshot.mjs [--out ../screenshots]
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.resolve(ROOT, process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '../screenshots')
const PORT = 3999
const BASE = `http://localhost:${PORT}`

const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64')

const USERS = {
  student: { id: 5, email: 'student@example.com', role: 'student', name: 'Maya Chen' },
  employer: { id: 9, email: 'hr@acme.com', role: 'employer', name: 'Acme Corp' },
  admin: { id: 1, email: 'admin@example.com', role: 'admin', name: 'Site Admin' },
}

const JOB = {
  id: 11, title: 'Senior React Developer', company: 'Acme Corp',
  location_city: 'Bengaluru', work_type: 'hybrid', description: 'Build polished UIs.',
  required_skills: [{ name: 'React' }, { name: 'TypeScript' }],
  status: 'approved', created_at: '2026-08-01T10:00:00Z',
}

const BALANCE = {
  current_credits: 42, weekly_limit: 60, next_refill_days: 2, next_refill_hours: 7,
  usage_today: { credits: 3 }, usage_this_week: { credits: 12, full_interviews: 2 },
  limits: {}, costs: { micro_session: 1, learning_path: 10 }, is_premium: false,
}

const QUESTIONS = [
  {
    id: 101, text: 'Walk me through how you would structure a React component library for a large dashboard.',
    question_number: 1, total_questions: 3, skill_tag: 'React Architecture',
    user_answer: null, answer_status: null,
  },
  {
    id: 102, text: 'How do you keep a FastAPI service resilient when a downstream model call is slow?',
    question_number: 2, total_questions: 3, skill_tag: 'Backend Resilience',
    user_answer: null, answer_status: null,
  },
  {
    id: 103, text: 'Describe a time you disagreed with a teammate about a technical decision.',
    question_number: 3, total_questions: 3, skill_tag: 'Collaboration',
    user_answer: null, answer_status: null,
  },
]

const ADMIN_OVERVIEW = {
  users_total: 1284, applicants_total: 842, uploads_total: 1930,
  jobs_by_status: { pending: 7, approved: 96, rejected: 11 },
  credit_totals: { accounts: 842, current_credits: 18420, total_earned: 92100, total_spent: 73680 },
  latest_audits: [
    { id: 1, action: 'job.approve', target_type: 'job', target_id: 11, user_id: 1, created_at: '2026-08-02T09:10:00Z' },
    { id: 2, action: 'credits.adjust', target_type: 'applicant', target_id: 7, user_id: 1, created_at: '2026-08-02T08:42:00Z' },
  ],
}

let activeRole = null

function fulfill(route, data) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
}

const MOCKS = [
  [/\/api\/credits\/balance(?:\?.*)?$/, BALANCE],
  [/\/api\/credits\/transactions(?:\?.*)?$/, [
    { id: 1, transaction_type: 'spend', amount: -1, balance_after: 42, description: 'Mock interview response', created_at: '2026-08-02T10:00:00Z' },
    { id: 2, transaction_type: 'refill', amount: 60, balance_after: 43, description: 'Weekly quota refill', created_at: '2026-08-01T00:00:00Z' },
  ]],
  [/\/api\/student\/applications\/jobs(?:\?.*)?$/, { applications: [
    { job_id: 11, job_title: 'Senior React Developer', company: 'Acme Corp', status: 'interviewing', applied_at: '2026-08-02' },
    { job_id: 12, job_title: 'Backend Engineer', company: 'Globex', status: 'pending', applied_at: '2026-08-05' },
    { job_id: 13, job_title: 'Fullstack Dev', company: 'Initech', status: 'accepted', applied_at: '2026-07-20' },
  ]}],
  [/\/api\/student\/applicant(?:\?.*)?$/, { id: 7, applicant_id: 'app_1', location_city: 'bengaluru', skills: ['React', 'TypeScript'] }],
  [/\/api\/student\/profile(?:\?.*)?$/, { personal_info: { name: 'Maya Chen', location: 'Bengaluru, India' }, display_name: 'Maya Chen', skills: ['React', 'TypeScript'] }],
  [/\/api\/recommendations\/\d+/, { cooldown_active: false, job_recommendations: [
    { job: { ...JOB, id: 11 }, match_score: 0.91, scoring_breakdown: {} },
    { job: { ...JOB, id: 12, title: 'Platform Engineer', company: 'Globex' }, match_score: 0.74, scoring_breakdown: {} },
    { job: { ...JOB, id: 13, title: 'Fullstack Developer', company: 'Initech' }, match_score: 0.62, scoring_breakdown: {} },
  ]}],
  [/\/api\/jobs/, { jobs: [JOB, { ...JOB, id: 12, title: 'Platform Engineer', company: 'Globex' }, { ...JOB, id: 13, title: 'Fullstack Developer', company: 'Initech', location_city: 'Remote' }], total: 3 }],
  [/\/api\/job\/\d+(?:\?.*)?$/, { job: JOB, employer: { company_name: 'Acme Corp', location_city: 'Bengaluru' }, metadata: { tags: ['React', 'TypeScript'] }, already_applied: false }],
  [/\/api\/applicant\/app_1(?:\?.*)?$/, { parsed_data: {
    personal_info: { name: 'Maya Chen', email: 'maya@example.com', phone: '+91 99999 00000' },
    education: [{ institution: 'IIT Madras', degree: 'B.Tech CSE', cgpa: 8.7, year_start: 2020, year_end: 2024 }],
    skills: [{ name: 'React' }, { name: 'TypeScript' }],
    experience: [{ title: 'Frontend Intern', company: 'Acme', duration: '3 months' }],
    projects: [{ name: 'CareerSync', description: 'Job matching dashboard' }],
    llm_confidence: 0.86,
  }, flags: [] }],
  [/\/api\/interview\/history$/, []],
  [/\/api\/interview\/active-session$/, { data: null }],
  [/\/api\/interview\/candidate-intelligence$/, { profile: {
    sessions_count: 6,
    summary: 'Maya shows strong frontend fundamentals and uses concrete examples when discussing UI architecture.',
    last_updated: '2026-08-01T10:00:00Z',
    answer_patterns: {
      explanation_depth: 'Explains trade-offs before jumping to implementation.',
      example_coverage: 'Usually grounds answers in shipped work.',
      time_pressure: 'Paces well until the final coding follow-up.',
      context_assumptions: 'States assumptions explicitly.',
    },
    skills: [{ skill: 'React', score: 0.82 }, { skill: 'System Design', score: 0.61 }],
  }}],
  [/\/api\/interview\/session\/sess-1\/questions$/, QUESTIONS],
  [/\/api\/interview\/session\/sess-1$/, {
    session_id: 'sess-1', status: 'active', interview_type: 'technical',
    interviewer_persona: 'Friendly Senior Engineer', voice_mode: false,
    created_at: '2026-08-02T10:00:00Z', expires_at: '2026-08-03T10:00:00Z',
  }],
  [/\/api\/interview\/results\/sess-1$/, {
    status: 'completed', total: 3, overall_score: 0.78,
    skill_breakdown: [
      { skill: 'React', score: 0.86, label: 'Strong' },
      { skill: 'System Design', score: 0.64, label: 'Developing' },
    ],
    questions_review: QUESTIONS.map((q) => ({
      question_id: q.id, question: q.text, answer: 'A structured answer with a concrete example.',
      score: 0.8, feedback: 'Clear structure and a relevant example.', skill_tag: q.skill_tag,
    })),
  }],
  [/\/api\/learning-paths\/applicant\/\d+/, [
    { id: 'lp1', target_role: 'Frontend Engineer', status: 'in_progress', created_at: '2026-08-01', skill_gaps: {}, topics_outline: [{ week: 'Week 1', skill_focus: 'React Hooks Deep Dive' }] },
    { id: 'lp2', target_role: 'Backend Engineer', status: 'completed', created_at: '2026-07-10', skill_gaps: {} },
  ]],
  [/\/api\/learning-paths\/lp1$/, { id: 'lp1', target_role: 'Frontend Engineer', topics_outline: [], recommended_projects: [], practice_problems: [] }],
  [/\/api\/learning-paths\//, { id: 'lp1', target_role: 'Frontend Engineer', topics_outline: [], recommended_projects: [], practice_problems: [] }],
  [/\/api\/admin\/overview$/, ADMIN_OVERVIEW],
  [/\/api\/admin\/config$/, { config: [
    { key: 'credits.weekly_limit', value: 60, category: 'credits', description: 'Free tier weekly credits' },
    { key: 'interview.max_questions', value: 5, category: 'interview', description: 'Question ceiling per session' },
  ]}],
  [/\/api\/admin\/audit-logs/, { total: 2, logs: ADMIN_OVERVIEW.latest_audits }],
  [/\/api\/admin\/credits\/transactions/, { transactions: [
    { id: 1, transaction_type: 'adjustment', amount: 10, balance_after: 52, description: 'Support goodwill credit', created_at: '2026-08-02T10:00:00Z', applicant_id: 7 },
  ]}],
  [/\/api\/admin\/users/, { total: 2, users: [
    { id: 1, name: 'Maya Chen', email: 'student@example.com', role: 'student', is_active: true, created_at: '2026-06-01' },
    { id: 2, name: 'Bob Recruiter', email: 'hr@acme.com', role: 'employer', is_active: false, created_at: '2026-06-15' },
  ]}],
  [/\/api\/admin\/jobs/, { jobs: [{ ...JOB, status: 'pending', company_name: 'Acme Corp' }], total: 1 }],
  [/\/api\/search\/semantic$/, { results: [] }],
  [/\/api\/rag\/suggestions$/, []],
]

async function mockApi(route) {
  const url = route.request().url()
  if (/\/api\/auth\/me(?:\?.*)?$/.test(url)) return fulfill(route, USERS[activeRole] || USERS.student)
  for (const [re, data] of MOCKS) {
    if (re.test(url)) return fulfill(route, data)
  }
  return fulfill(route, {})
}

const ROUTES = [
  ['login', '/login', null],
  ['register', '/register', null],
  ['forgot-password', '/forgot-password', null],
  ['reset-password', '/reset-password', null],
  ['verify-code', '/verify-code', null],
  ['resend-verification', '/resend-verification', null],
  ['student-dashboard', '/student/dashboard', 'student'],
  ['jobs', '/jobs', 'student'],
  ['job-details', '/job/11', 'student'],
  ['my-applications', '/student/applications', 'student'],
  ['interview-setup', '/dashboard/interview', 'student'],
  ['interview-session', '/dashboard/interview/sess-1', 'student'],
  ['interview-results', '/dashboard/interview/results/sess-1', 'student'],
  ['candidate-intelligence', '/student/intelligence', 'student'],
  ['learning-paths', '/dashboard/learning-paths', 'student'],
  ['learning-path', '/dashboard/learning-path/lp1', 'student'],
  ['student-profile', '/student/profile', 'student'],
  ['ask', '/ask', 'student'],
  ['upgrade', '/dashboard/upgrade', 'student'],
  ['transactions', '/dashboard/credits/transactions', 'student'],
  ['results', '/results/app_1', 'student'],
  ['admin-dashboard', '/admin/dashboard', 'admin'],
  ['admin-users', '/admin/users', 'admin'],
  ['admin-jobs', '/admin/jobs', 'admin'],
]

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } }

function startServer() {
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT, stdio: 'pipe', shell: true,
  })
  proc.stderr.on('data', (d) => process.stderr.write(d))
  // Poll HTTP instead of parsing the ANSI-colored stdout banner.
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = async () => {
      try {
        const res = await fetch(BASE)
        if (res.ok) return resolve(proc)
      } catch { /* not up yet */ }
      if (Date.now() - started > 60000) return reject(new Error('vite dev server timed out'))
      setTimeout(tick, 500)
    }
    tick()
  })
}

const only = process.argv.find((a) => a.startsWith('--only='))
const filter = only ? only.split('=')[1] : null

const server = await startServer()
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()

try {
  for (const [name, routePath, role] of ROUTES) {
    if (filter && !name.includes(filter)) continue
    activeRole = role
    for (const theme of ['light', 'dark']) {
      for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
        const context = await browser.newContext({ viewport })
        const page = await context.newPage()
        // Session values must be pre-encoded in Node — addInitScript
        // serializes this closure without access to module scope.
        const session = role ? {
          token: enc('h.' + enc({ exp: Math.floor(Date.now() / 1000) + 3600 }) + '.s'),
          user: enc(USERS[role]),
          login_time: enc(Date.now()),
          db_applicant_id: enc(7),
        } : null
        await page.addInitScript(({ theme, session }) => {
          if (session) {
            for (const [k, v] of Object.entries(session)) {
              sessionStorage.setItem(`_secure_${k}`, v)
            }
          }
          try {
            localStorage.setItem('theme', theme)
            document.documentElement.classList.toggle('dark', theme === 'dark')
          } catch {
            /* document may not be ready in the earliest init pass */
          }
        }, { theme, session })
        await page.route('**/api/**', mockApi)
        try {
          await page.goto(BASE + routePath, { waitUntil: 'networkidle', timeout: 30000 })
        } catch { /* networkidle may not settle on pages with polling; screenshot anyway */ }
        await page.waitForTimeout(1500)
        // Walk the page so viewport-triggered reveals run before a full-page
        // capture (captureBeyondViewport alone never intersects below-fold
        // content, which would screenshot entire sections as blank).
        await page.evaluate(async () => {
          // `html { scroll-behavior: smooth }` turns scrollTo into an
          // animation; force instant jumps while walking the page.
          const root = document.documentElement
          const previousBehavior = root.style.scrollBehavior
          root.style.scrollBehavior = 'auto'
          const step = Math.max(320, Math.round(window.innerHeight * 0.7))
          const height = root.scrollHeight
          for (let y = 0; y < height; y += step) {
            window.scrollTo(0, y)
            await new Promise((resolve) => setTimeout(resolve, 140))
          }
          window.scrollTo(0, height)
          await new Promise((resolve) => setTimeout(resolve, 300))
          window.scrollTo(0, 0)
          await new Promise((resolve) => setTimeout(resolve, 800))
          root.style.scrollBehavior = previousBehavior
        })
        const file = path.join(OUT, `${name}--${theme}--${vpName}.png`)
        await page.screenshot({ path: file, fullPage: true })
        console.log('captured', path.basename(file))
        await context.close()
      }
    }
  }
} finally {
  await browser.close()
  server.kill('SIGTERM')
}
console.log('DONE ->', OUT)
