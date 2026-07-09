# Frontend Performance and Correctness Audit Report

This report outlines the findings, root causes, and refactoring recommendations for the React frontend (`frontend/`) codebase of the Career Guidance system.

---

## 1. StudentProfile.jsx Runtime Crash

### Observation & File Locations
- **File Path**: `frontend/src/pages/StudentProfile.jsx`
- **Imports (Line 30)**:
  ```javascript
  import { useToast } from '../hooks/useToast'
  ```
- **Initialization (Line 36)**:
  ```javascript
  const { showToast } = useToast()
  ```
- **Usage (Lines 214, 219, 229, 234, 241, 245, 253, 257, 289, 294, 303)**:
  ```javascript
  showToast('Account deactivated successfully', 'success')
  // and other showToast(...) calls
  ```

### Root Cause
1. **Destructuring Failure**: The `useToast` custom hook defined in `frontend/src/hooks/useToast.js` does not return a function named `showToast`. It returns an object containing:
   ```javascript
   return {
     toasts,
     addToast,
     removeToast,
     success,
     error,
     warning,
     info
   }
   ```
   Destructuring `const { showToast } = useToast()` results in `showToast` being `undefined`. Calling it throws a runtime crash: `TypeError: showToast is not a function`.
2. **Missing Toast Container**: Unlike other views, `StudentProfile.jsx` neither imports `ToastContainer` from `../components/Toast` nor renders it anywhere within its JSX layout. Even if the hook was called correctly, toasts would never render on this page.

### Refactoring Recommendations
- **Option A (Quick Fix)**: Refactor `StudentProfile.jsx` to align with the rest of the application's local toast implementation:
  1. Import `ToastContainer` at the top of the file:
     ```javascript
     import { ToastContainer } from '../components/Toast'
     ```
  2. Change destructuring to retrieve the `toast` object:
     ```javascript
     const toast = useToast()
     ```
  3. Replace all instances of `showToast(msg, type)` with `toast[type](msg)`. For example:
     - `showToast('...', 'success')` $\rightarrow$ `toast.success('...')`
     - `showToast('...', 'error')` $\rightarrow$ `toast.error('...')`
  4. Render the container at the end of the root wrapper element (near line 1025):
     ```javascript
     <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
     ```
- **Option B (Best Practice)**: Refactor the toast architecture globally to use a single context (see Section 3.2).

---

## 2. Nested Component Declarations in JobsPage.jsx

### Observation & File Locations
- **File Path**: `frontend/src/pages/JobsPage.jsx`
- **Definition (Lines 602–793)**:
  The component `JobCard` is declared directly inside the functional body of the parent component `JobsPage`.
- **Instantiation (Line 1003)**:
  `<JobCard key={job.id} job={job} />`

### Root Cause
Declaring a component inside another component's render body is a major React anti-pattern:
1. **Reference Recreation**: On every render of the parent `JobsPage`, a new functional reference for `JobCard` is created.
2. **Subtree Demolition (DOM Thrashing)**: React compares components by their type reference. Because the reference changes on every render, React determines that the old `JobCard` component type has been replaced by a completely new one. React destroys the entire DOM subtree for the cards, unmounts them, and remounts new instances.
3. **Timer Ticks Amplification**: A 1-second interval updates `cooldownTimeLeft` state in `JobsPage`. This triggers a full re-render of `JobsPage` every second. Consequently, every job card in the list is unmounted and remounted *every single second*, causing heavy DOM thrashing, lag, and high CPU usage.

### Refactoring Recommendations
1. **Un-nest `JobCard`**: Move the `JobCard` definition out of the `JobsPage` component function entirely. Ideally, place it in a dedicated file `frontend/src/components/JobCard.jsx` or at the bottom of `JobsPage.jsx`.
2. **Wrap in `React.memo`**: Wrap the un-nested component in `React.memo` to skip re-renders if props have not changed.
3. **Optimize Prop Passing (Avoid reference leak)**: Instead of passing the entire state arrays/sets or current indices which force all cards to re-render when any card updates, pass pre-computed primitive values.
   - Pass `isApplied={appliedJobIds.has(job.id)}` instead of passing `appliedJobIds` Set.
   - Pass `isApplying={applyingId === job.id}` instead of passing `applyingId` string/integer.
   - Pass memoized callbacks `onOpenDetails` and `onApply` wrapped in `useCallback` inside `JobsPage`.

#### Proposed Code Structure for `src/components/JobCard.jsx`
```javascript
import React from 'react'
import { motion } from 'framer-motion'
import { Briefcase, MapPin, Clock, Sparkles, Award, Check, CheckCircle, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { jobMarkdownComponents } from '../pages/JobsPage' // Or export/move to configs

export const JobCard = React.memo(({
  job,
  recommendation,
  candidateCity,
  candidateSkills,
  isApplied,
  isApplying,
  showApplicantFeatures,
  onOpenDetails,
  onApply
}) => {
  const userCity = candidateCity || ''
  const jobCity = (job.location_city || '').toLowerCase().trim()
  const isCityMatched = userCity && jobCity && (userCity.includes(jobCity) || jobCity.includes(userCity))
  
  const showLocGreen = isCityMatched || (!job.location_city && job.work_type === 'remote')
  const showWorkTypeGreen = job.work_type === 'remote' || job.work_type === 'hybrid'
  const isExpMatched = (recommendation?.scoring_breakdown?.experience_fit ?? 0) >= 0.5
  const isCgpaMatched = (recommendation?.scoring_breakdown?.academic_score ?? 0) >= 0.5

  const matched = recommendation?.scoring_breakdown?.skills_breakdown?.matched_skills || []
  const partial = recommendation?.scoring_breakdown?.skills_breakdown?.partial_matches || []
  const fallbackSkills = [...new Set([...matched, ...partial])]
  const skillsToRender = Array.isArray(job.required_skills) && job.required_skills.length > 0 
    ? job.required_skills.slice(0, 3) 
    : fallbackSkills.slice(0, 3)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-100 hover:border-primary-200/80 transition-all duration-300 hover:shadow-[0_20px_45px_rgba(15,23,42,0.06)] hover:-translate-y-1 flex flex-col h-full relative overflow-hidden group"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-primary-500 group-hover:via-indigo-500 group-hover:to-purple-500 transition-all duration-300" />
      
      <div className="flex justify-between items-start mb-3 gap-4">
        <div className="flex-1 mr-2">
          <div className="flex items-start gap-3 mb-1.5">
            <div className="w-11 h-11 bg-primary-50 border border-primary-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Briefcase className="w-5 h-5 text-primary-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg leading-tight mb-1 text-slate-900 group-hover:text-primary-900 transition-colors line-clamp-2">{job.title}</h3>
              <p className="text-sm font-semibold text-slate-500">{job.company}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
          showLocGreen ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-600'
        }`}>
          <MapPin className={`w-3.5 h-3.5 ${showLocGreen ? 'text-emerald-500' : 'text-slate-400'}`} />
          <span>{job.location_city || 'Remote'}{job.location_state ? `, ${job.location_state}` : ''}</span>
        </div>
        <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium capitalize transition-all ${
          showWorkTypeGreen ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-600'
        }`}>
          <Clock className={`w-3.5 h-3.5 ${showWorkTypeGreen ? 'text-emerald-500' : 'text-slate-400'}`} />
          <span>{job.work_type || 'Full-time'}</span>
        </div>
        {job.min_experience_years !== null && job.min_experience_years !== undefined && (
          <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
            isExpMatched ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-600'
          }`}>
            <Sparkles className={`w-3.5 h-3.5 ${isExpMatched ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span>{job.min_experience_years}+ years</span>
          </div>
        )}
        {job.min_cgpa && (
          <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
            isCgpaMatched ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-600'
          }`}>
            <Award className={`w-3.5 h-3.5 ${isCgpaMatched ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span>CGPA {job.min_cgpa}+</span>
          </div>
        )}
      </div>

      {skillsToRender.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {skillsToRender.map((skill, idx) => {
            const skillName = typeof skill === 'string' ? skill : skill?.name || skill?.skill || `Skill ${idx + 1}`
            const reqName = skillName.toLowerCase().trim()
            const isMatched = candidateSkills.some(cs => cs.toLowerCase().trim() === reqName) ||
                              matched.some(m => m.toLowerCase().trim() === reqName) ||
                              partial.some(p => p.toLowerCase().trim() === reqName)
            return (
              <span
                key={`${skillName}-${idx}`}
                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition-all inline-flex items-center ${
                  isMatched ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-500'
                }`}
              >
                {isMatched && <Check className="w-2.5 h-2.5 mr-0.5 text-emerald-600 flex-shrink-0" />}
                {skillName}
              </span>
            )
          })}
        </div>
      )}

      {job.description && (
        <div className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6 bg-slate-50/50 rounded-xl p-3 border border-slate-100 line-clamp-4 overflow-hidden">
          <ReactMarkdown components={jobMarkdownComponents}>{job.description}</ReactMarkdown>
        </div>
      )}

      {(job.min_salary || job.max_salary) && (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Salary Range</p>
          <p className="text-sm font-bold text-primary-600">
            {job.min_salary ? `INR ${(job.min_salary / 100000).toFixed(1)}L` : 'Competitive'}
            {job.max_salary ? ` - INR ${(job.max_salary / 100000).toFixed(1)}L` : ''}
          </p>
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <button
            onClick={() => onOpenDetails(job)}
            className="flex-1 py-2 px-3 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-700 active:scale-95 duration-200"
          >
            Details
          </button>

          {isApplied ? (
            <button
              disabled
              className="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-not-allowed text-center flex items-center justify-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              Applied
            </button>
          ) : (
            <button
              onClick={() => onApply(job.id)}
              disabled={isApplying}
              className="flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all active:scale-95 duration-200 bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-500/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying...
                </>
              ) : (
                'Easy Apply'
              )}
            </button>
          )}
        </div>

        {!showApplicantFeatures && (
          <button
            onClick={() => onOpenDetails(job)}
            className="text-[9px] text-primary-600 font-extrabold hover:underline self-center pt-0.5"
          >
            View full job details
          </button>
        )}
      </div>
    </motion.div>
  )
})
```

---

## 3. Other React Performance Bottlenecks

### 3.1 Local Filter/Sort Calculations on Every Render
- **Observation**:
  In `JobsPage.jsx`, lines 504–576 calculate `filteredRecommendations` and `sortedRecommendations` dynamically on every single render cycle.
- **Problem**:
  Because the page re-renders every second via the cooldown timer, these filters and sorts are continuously recalculated from scratch even if the filter inputs, jobs data, or recommendations have not changed.
- **Recommendation**:
  Wrap these operations in `useMemo` hooks:
  ```javascript
  const filteredRecommendations = useMemo(() => {
    return rawRecommendations.filter((rec) => {
      const job = rec.job || rec
      if (!job) return false
      // ... filter logic
      return true
    })
  }, [rawRecommendations, filters.q, filters.location, filters.work_type, filters.skills])

  const sortedRecommendations = useMemo(() => {
    return [...filteredRecommendations].sort((a, b) => {
      const jobA = a.job || a
      const jobB = b.job || b
      // ... sort logic
    })
  }, [filteredRecommendations, filters.sort])

  const displayJobs = useMemo(() => {
    return showApplicantFeatures
      ? sortedRecommendations.map(rec => rec.job).filter(Boolean)
      : jobs
  }, [showApplicantFeatures, sortedRecommendations, jobs])
  ```

### 3.2 Timer State Causes Complete Page Re-render
- **Observation**:
  The `cooldownTimeLeft` state variable is updated every second inside a `useEffect` hook in `JobsPage.jsx`.
- **Problem**:
  Updating this single text field forces the entire layout of `JobsPage`—including the filter inputs, the job grid, and the details overlay—to re-evaluate.
- **Recommendation**:
  Create a self-contained `<CooldownTimer />` component to isolate the state updates.
  ```javascript
  import React, { useState, useEffect } from 'react'

  export const CooldownTimer = ({ expiresAt, onComplete }) => {
    const [timeLeft, setTimeLeft] = useState('')

    useEffect(() => {
      const calculateTimeLeft = () => {
        const difference = +new Date(expiresAt) - +new Date()
        if (difference <= 0) {
          onComplete()
          return
        }
        const hours = Math.floor(difference / (1000 * 60 * 60))
        const minutes = Math.floor((difference / 1000 / 60) % 60)
        const seconds = Math.floor((difference / 1000) % 60)
        setTimeLeft(
          `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
        )
      }

      calculateTimeLeft()
      const interval = setInterval(calculateTimeLeft, 1000)
      return () => clearInterval(interval)
    }, [expiresAt, onComplete])

    return <span>{timeLeft}</span>
  }
  ```
  Then in the parent component:
  - Render `<CooldownTimer expiresAt={cooldownExpiresAt} onComplete={() => { setCooldownActive(false); fetchRecommendations(); }} />` inside the JSX.
  - Remove `cooldownTimeLeft` state from `JobsPage.jsx`.

### 3.3 Duplicate ToastContainer Architecture & Navigate Bug
- **Observation**:
  Every single page (21 files) instantiates `useToast` locally and renders its own `<ToastContainer>`.
- **Problem**:
  1. **Navigate Bug**: In `StudentProfile.jsx`, calling `navigate('/login')` immediately unmounts the page component, destroying the local toast state. As a result, the "Account deactivated successfully" toast is destroyed before the user can see it on the login page.
  2. **Duplicate Code**: Massive rendering and import duplication across 21 pages.
- **Recommendation**:
  Implement a global context-based Toast system:
  1. Create a `src/context/ToastContext.jsx` file:
     ```javascript
     import React, { createContext, useContext, useState, useCallback } from 'react'
     import { ToastContainer } from '../components/Toast'

     const ToastContext = createContext(null)

     let toastId = 0

     export function ToastProvider({ children }) {
       const [toasts, setToasts] = useState([])

       const addToast = useCallback((message, type = 'info', duration = 3000) => {
         const id = ++toastId
         setToasts((prev) => [...prev, { id, message, type, duration }])
         return id
       }, [])

       const removeToast = useCallback((id) => {
         setToasts((prev) => prev.filter((t) => t.id !== id))
       }, [])

       const success = useCallback((msg, dur) => addToast(msg, 'success', dur), [addToast])
       const error = useCallback((msg, dur) => addToast(msg, 'error', dur), [addToast])
       const warning = useCallback((msg, dur) => addToast(msg, 'warning', dur), [addToast])
       const info = useCallback((msg, dur) => addToast(msg, 'info', dur), [addToast])

       return (
         <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
           {children}
           <ToastContainer toasts={toasts} removeToast={removeToast} />
         </ToastContext.Provider>
       )
     }

     export function useToast() {
       const context = useContext(ToastContext)
       if (!context) throw new Error('useToast must be used within a ToastProvider')
       return context
     }
     ```
  2. Wrap `<App>` in `<ToastProvider>` in `src/App.jsx`.
  3. Remove all page-level `<ToastContainer>` declarations.

### 3.4 Unstable List Keys (`key={idx}`)
- **Observation**:
  In multiple files, lists are rendered mapping items using array indices as keys.
  - **Example**: `StudentProfile.jsx` line 837 renders the skills using `key={idx}`:
    ```javascript
    (parsedSkills.length > 0 ? parsedSkills : profile.skills).map((skill, idx) => (
      <div key={idx} ...
    ```
- **Problem**:
  Using index as keys causes React to mismatch DOM elements when items are added, deleted, or reordered. It results in poor rendering performance, layout shifts during editing, and can cause component state mismatch.
- **Recommendation**:
  Change key mappings to use unique item attributes:
  - For skills (which are unique strings): `key={skill}`.
  - For education and experience lists: Use a unique database ID if available, or generate a composite key (e.g., `key={`${edu.institution}-${edu.degree}`}`).
