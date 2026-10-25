import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { BookOpen, Calendar, ChevronRight, Target, Clock, Check, Trash2, RotateCcw } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

const MyLearningPathsPage = () => {
    const navigate = useNavigate()
    const [paths, setPaths] = useState([])
    const [loading, setLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleting, setDeleting] = useState(false)
    const toast = useToast()

    useEffect(() => {
        fetchPaths()
    }, [])

    const fetchPaths = async () => {
        setLoading(true)
        try {
            let applicantId = secureStorage.getItem('db_applicant_id')

            if (!applicantId) {
                try {
                    const profileRes = await api.get('/api/student/applicant')
                    if (profileRes.data && profileRes.data.id) {
                        applicantId = profileRes.data.id
                        secureStorage.setItem('db_applicant_id', String(applicantId))
                    }
                } catch (e) {
                    console.error("Profile fetch failed", e)
                }
            }

            if (!applicantId) {
                setLoading(false)
                return
            }
            const response = await api.get(`/api/learning-paths/applicant/${applicantId}`)
            setPaths(response.data)
        } catch (error) {
            console.error('Error fetching paths:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleMarkCompleted = async (e, pathId) => {
        e.stopPropagation()
        try {
            await api.post(`/api/learning-paths/${pathId}/complete`)
            toast.success('Learning path marked as completed!')
            fetchPaths()
        } catch (err) {
            console.error(err)
            toast.error('Failed to complete path.')
        }
    }

    const handleDeletePath = (e, pathId) => {
        e.stopPropagation()
        setDeleteTarget(pathId)
    }

    const performDeletePath = async () => {
        if (!deleteTarget) return
        setDeleting(true)
        try {
            await api.post(`/api/learning-paths/${deleteTarget}/delete`)
            toast.success('Learning path moved to Trash.')
            fetchPaths()
            setDeleteTarget(null)
        } catch (err) {
            console.error(err)
            toast.error('Failed to delete path.')
        } finally {
            setDeleting(false)
        }
    }

    const handleRestorePath = async (e, pathId) => {
        e.stopPropagation()
        try {
            await api.post(`/api/learning-paths/${pathId}/restore`)
            toast.success('Learning path successfully restored!')
            fetchPaths()
        } catch (err) {
            console.error(err)
            toast.error('Failed to restore path.')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-pill h-16 w-16 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    const activePaths = paths.filter(p => !p.skill_gaps?.is_deleted)
    const deletedPaths = paths.filter(p => p.skill_gaps?.is_deleted)

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8 border-b border-hairline pb-6">
                <div>
                    <p className="eyebrow mb-2">Learning</p>
                    <h1 className="app-page-title flex items-center gap-3">
                        <BookOpen className="text-primary-600 dark:text-primary-400" size={28} />
                        My Learning Paths
                    </h1>
                    <p className="app-page-subtitle">
                        Track your personalized learning progress from past mock practices
                    </p>
                </div>
            </div>

            {activePaths.length === 0 ? (
                <div className="surface-card border-dashed p-12 text-center">
                    <Target className="w-16 h-16 text-ink-subtle mx-auto mb-4" />
                    <h3 className="text-title text-ink mb-2">No Active Learning Paths Yet</h3>
                    <p className="text-body text-ink-muted mb-6 max-w-md mx-auto">
                        Complete mock practices to compile structured skill gap analyses and interactive roadmaps.
                    </p>
                    <button
                        onClick={() => navigate('/dashboard/interview')}
                        className="app-btn-primary"
                    >
                        Start Interview Practice
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activePaths.map((path) => (
                        <div
                            key={path.id}
                            onClick={() => navigate(`/dashboard/learning-path/${path.id}`)}
                            className="surface-card surface-card-interactive cursor-pointer overflow-hidden group flex h-full flex-col justify-between"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <span className={`px-2.5 py-0.5 rounded-pill text-caption font-bold border ${
                                        path.status === 'completed' 
                                            ? 'bg-success/10 border-success/20 text-success' 
                                            : 'bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-500/10 dark:border-primary-500/30 dark:text-primary-300'
                                    }`}>
                                        {path.status === 'completed' ? 'Completed' : 'Active'}
                                    </span>
                                    <span className="text-caption text-ink-subtle flex items-center">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {new Date(path.created_at).toLocaleDateString()}
                                    </span>
                                </div>

                                <h3 className="text-title text-ink mb-2 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                                    Learning Path #{path.id}
                                </h3>

                                {path.priority_skills && path.priority_skills.length > 0 && (
                                    <div className="mb-4">
                                        <p className="app-label block mb-2">Focus Skills</p>
                                        <div className="flex flex-wrap gap-1">
                                            {path.priority_skills.slice(0, 3).map((skill, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-surface-sunken border border-hairline text-ink-muted text-caption rounded-pill font-medium">
                                                    {skill}
                                                </span>
                                            ))}
                                            {path.priority_skills.length > 3 && (
                                                <span className="px-2 py-0.5 bg-surface-sunken border border-hairline text-ink-subtle text-caption rounded-pill font-medium">
                                                    +{path.priority_skills.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-6 pt-4 border-t border-hairline">
                                    <div className="flex items-center text-caption text-ink-muted font-medium">
                                        <Clock className="w-4 h-4 mr-1.5 text-ink-subtle" />
                                        {path.progress_percentage || 0}% Complete
                                    </div>
                                    
                                    {/* Action buttons list */}
                                    <div className="flex gap-2">
                                        {path.status !== 'completed' && (
                                            <button
                                                onClick={(e) => handleMarkCompleted(e, path.id)}
                                                title="Mark as completed"
                                                aria-label="Mark learning path as completed"
                                                className="p-1.5 rounded-card bg-success/10 hover:bg-success/20 border border-success/20 text-success hover:text-success transition-colors"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDeletePath(e, path.id)}
                                            title="Delete learning path"
                                            aria-label="Delete learning path"
 className="p-1.5 rounded-card bg-error/10 hov-danger border border-error/20 text-error hover:text-error transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-surface-sunken h-1 w-full">
                                <div
                                    className={`h-1 transition-all duration-500 ${path.status === 'completed' ? 'bg-success' : 'bg-primary-500'}`}
                                    style={{ width: `${path.progress_percentage || 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Trash recovery section */}
            {deletedPaths.length > 0 && (
                <div className="mt-16 pt-8 border-t border-hairline">
                    <h2 className="app-section-title mb-6 flex items-center gap-2">
                        <Trash2 className="text-error" size={22} />
                        Trash & Recovery (Soft Deleted)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {deletedPaths.map((path) => {
                            // Calculate remaining days
                            const deletedAt = new Date(path.skill_gaps.deleted_at)
                            const diffMs = deletedAt.getTime() + (30 * 24 * 60 * 60 * 1000) - Date.now()
                            const remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
                            
                            return (
                                <div 
                                    key={path.id} 
                                    className="rounded-panel border border-dashed border-hairline-strong bg-surface-sunken p-6 relative flex flex-col justify-between"
                                >
                                    <div>
                                        <h3 className="text-caption font-bold text-ink-subtle mb-1">Learning Path #{path.id}</h3>
                                        <p className="text-caption text-error font-semibold mb-4 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            Will be permanently deleted in {remainingDays} days
                                        </p>
                                    </div>
                                    <div className="flex gap-2 border-t border-hairline pt-4 mt-2">
                                        <button
                                            onClick={(e) => handleRestorePath(e, path.id)}
                                            className="app-btn-secondary app-btn-sm flex items-center gap-1.5"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            Restore Pathway
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="Delete this learning path?"
                message="It will be permanently deleted in 30 days. You can restore it from the Trash section at any time before then."
                confirmLabel="Delete"
                destructive
                loading={deleting}
                onConfirm={performDeletePath}
                onClose={() => !deleting && setDeleteTarget(null)}
            />
            <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
        </div>
    )
}

export default MyLearningPathsPage
