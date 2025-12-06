import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../config/api'
import secureStorage from '../utils/secureStorage'
import { BookOpen, Calendar, ChevronRight, Target, Clock } from 'lucide-react'

const MyLearningPathsPage = () => {
    const navigate = useNavigate()
    const [paths, setPaths] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchPaths()
    }, [])

    const fetchPaths = async () => {
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
            const response = await api.get(`/api/learning-paths/${applicantId}`)
            setPaths(response.data)
        } catch (error) {
            console.error('Error fetching paths:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                        <BookOpen className="mr-3 text-indigo-600" />
                        My Learning Paths
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Track your personalized learning progress from past interviews
                    </p>
                </div>
            </div>

            {paths.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Learning Paths Yet</h3>
                    <p className="text-gray-600 mb-6">
                        Complete an interview to get a personalized learning plan.
                    </p>
                    <button
                        onClick={() => navigate('/dashboard/interview')}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Start Interview Practice
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paths.map((path) => (
                        <div
                            key={path.id}
                            onClick={() => navigate(`/dashboard/learning-path/${path.id}`)}
                            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer border border-gray-100 overflow-hidden group"
                        >
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">
                                        {path.status === 'active' ? 'Active' : 'Completed'}
                                    </div>
                                    <span className="text-xs text-gray-500 flex items-center">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        {new Date(path.created_at).toLocaleDateString()}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                                    Learning Path #{path.id}
                                </h3>

                                {path.priority_skills && path.priority_skills.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-xs text-gray-500 mb-2">Focus Skills:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {path.priority_skills.slice(0, 3).map((skill, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                                    {skill}
                                                </span>
                                            ))}
                                            {path.priority_skills.length > 3 && (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                                                    +{path.priority_skills.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                                    <div className="flex items-center text-sm text-gray-600">
                                        <Clock className="w-4 h-4 mr-1" />
                                        {path.progress_percentage || 0}% Complete
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                                </div>
                            </div>
                            <div className="bg-gray-50 h-1 w-full">
                                <div
                                    className="bg-indigo-600 h-1 transition-all duration-500"
                                    style={{ width: `${path.progress_percentage || 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default MyLearningPathsPage
