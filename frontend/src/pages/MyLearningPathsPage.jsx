import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { BookOpen, Calendar, ChevronRight, Target, Clock, Check, Trash2, RotateCcw } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from '../components/Toast'

const MyLearningPathsPage = () => {
    const navigate = useNavigate()
    const [paths, setPaths] = useState([])
    const [loading, setLoading] = useState(true)
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

    const handleDeletePath = async (e, pathId) => {
        e.stopPropagation()
        const ok = window.confirm("Are you sure you want to delete this learning path? It will be permanently deleted from the database in 30 days. You can restore it from the Trash section at any time before then.")
        if (!ok) return
        try {
            await api.post(`/api/learning-paths/${pathId}/delete`)
            toast.success('Learning path moved to Trash.')
            fetchPaths()
        } catch (err) {
            console.error(err)
            toast.error('Failed to delete path.')
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
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    const activePaths = paths.filter(p => !p.skill_gaps?.is_deleted)
    const deletedPaths = paths.filter(p => p.skill_gaps?.is_deleted)

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                        <BookOpen className="mr-3 text-indigo-650" />
                        My Learning Paths
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Track your personalized learning progress from past mock practices
                    </p>
                </div>
            </div>

            {activePaths.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center shadow-sm">
                    <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Learning Paths Yet</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        Complete mock practices to compile structured skill gap analyses and interactive roadmaps.
                    </p>
                    <button
                        onClick={() => navigate('/dashboard/interview')}
                        className="px-6 py-3 bg-indigo-650 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-650/15"
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
                            className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-200 overflow-hidden group flex flex-col justify-between"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                        path.status === 'completed' 
                                            ? 'bg-green-50 border border-green-150 text-green-600' 
                                            : 'bg-indigo-50 border border-indigo-100 text-indigo-750'
                                    }`}>
                                        {path.status === 'completed' ? 'Completed' : 'Active'}
                                    </span>
                                    <span className="text-xs text-gray-400 flex items-center">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {new Date(path.created_at).toLocaleDateString()}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-indigo-650 transition-colors">
                                    Learning Path #{path.id}
                                </h3>

                                {path.priority_skills && path.priority_skills.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-[10px] font-bold text-gray-450 block uppercase tracking-wider mb-2">Focus Skills</p>
                                        <div className="flex flex-wrap gap-1">
                                            {path.priority_skills.slice(0, 3).map((skill, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-slate-50 border border-slate-150 text-gray-600 text-xs rounded font-medium">
                                                    {skill}
                                                </span>
                                            ))}
                                            {path.priority_skills.length > 3 && (
                                                <span className="px-2 py-0.5 bg-slate-50 border border-slate-150 text-gray-500 text-xs rounded font-medium">
                                                    +{path.priority_skills.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                                    <div className="flex items-center text-sm text-slate-500 font-medium">
                                        <Clock className="w-4 h-4 mr-1.5 text-slate-400" />
                                        {path.progress_percentage || 0}% Complete
                                    </div>
                                    
                                    {/* Action buttons list */}
                                    <div className="flex gap-2">
                                        {path.status !== 'completed' && (
                                            <button
                                                onClick={(e) => handleMarkCompleted(e, path.id)}
                                                title="Mark as completed"
                                                className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 border border-green-150 text-green-600 hover:text-green-700 transition-colors"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => handleDeletePath(e, path.id)}
                                            title="Delete learning path"
                                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-150 text-red-550 hover:text-red-700 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-100 h-1 w-full">
                                <div
                                    className={`h-1 transition-all duration-500 ${path.status === 'completed' ? 'bg-green-500' : 'bg-indigo-650'}`}
                                    style={{ width: `${path.progress_percentage || 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Trash recovery section */}
            {deletedPaths.length > 0 && (
                <div className="mt-16 pt-8 border-t border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Trash2 className="text-red-500" />
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
                                    className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6 relative flex flex-col justify-between"
                                >
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-500 mb-1">Learning Path #{path.id}</h3>
                                        <p className="text-xs text-red-600 font-semibold mb-4 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            Will be permanently deleted in {remainingDays} days
                                        </p>
                                    </div>
                                    <div className="flex gap-2 border-t border-slate-200/60 pt-4 mt-2">
                                        <button
                                            onClick={(e) => handleRestorePath(e, path.id)}
                                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
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
            <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
        </div>
    )
}

export default MyLearningPathsPage
