import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, FileText, CheckCircle, AlertCircle, X, Award } from 'lucide-react'

const ProfileHealth = ({ applicantData }) => {
    const [showModal, setShowModal] = useState(false)

    // Calculate health score based on available data
    const calculateHealth = () => {
        if (!applicantData) return 0
        let score = 20 // Base for having an account
        if (applicantData.skills && applicantData.skills.length > 0) score += 20
        if (applicantData.education && applicantData.education.length > 0) score += 20
        if (applicantData.projects && applicantData.projects.length > 0) score += 20
        if (applicantData.experience && applicantData.experience.length > 0) score += 20
        return Math.min(score, 100)
    }

    const healthScore = calculateHealth()
    const circumference = 2 * Math.PI * 18 // Radius 18
    const strokeDashoffset = circumference - (healthScore / 100) * circumference

    const getColor = () => {
        if (healthScore >= 80) return 'text-green-700 stroke-green-500'
        if (healthScore >= 50) return 'text-yellow-700 stroke-yellow-500'
        return 'text-red-700 stroke-red-500'
    }

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowModal(true)}
                className="relative group"
            >
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-gray-200 hover:border-gray-300 transition-colors shadow-sm">
                    <div className="relative w-8 h-8 flex items-center justify-center">
                        {/* Background Circle */}
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="transparent"
                                className="text-gray-300"
                            />
                            {/* Progress Circle */}
                            <circle
                                cx="16"
                                cy="16"
                                r="14"
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="transparent"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className={`${getColor().split(' ')[1]} transition-all duration-1000 ease-out`}
                            />
                        </svg>
                        <span className={`absolute text-[10px] font-bold ${getColor().split(' ')[0]}`}>
                            {healthScore}%
                        </span>
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                        Profile
                    </span>
                </div>
            </motion.button>

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl flex flex-col max-h-[85vh]"
                        >
                            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary-100 rounded-lg">
                                        <User className="w-6 h-6 text-primary-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">Resume Insights</h3>
                                        <p className="text-xs text-gray-600">Analysis from your uploaded resume</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-900">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6">
                                {/* Score Hero */}
                                <div className="text-center mb-6">
                                    <div className="text-4xl font-bold text-gray-900 mb-1">{healthScore}%</div>
                                    <div className="text-sm text-gray-600">Profile Completeness</div>
                                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                                        <div className="h-2 rounded-full bg-gradient-to-r from-green-400 to-blue-500" style={{ width: `${healthScore}%` }}></div>
                                    </div>
                                </div>

                                {!applicantData ? (
                                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-center">
                                        <AlertCircle className="w-8 h-8 text-yellow-700 mx-auto mb-2" />
                                        <h4 className="font-semibold text-yellow-900">Resume Missing</h4>
                                        <p className="text-sm text-gray-600 mt-1">Upload your resume to activate personalized recommendations.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Skills Section */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-600" /> Parsed Skills ({applicantData.skills?.length || 0})
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {(applicantData.skills || []).slice(0, 10).map((skill, i) => (
                                                    <span key={i} className="px-2 py-1 bg-gray-200 rounded text-xs text-gray-900 border border-gray-300">
                                                        {typeof skill === 'string' ? skill : skill.name}
                                                    </span>
                                                ))}
                                                {(applicantData.skills?.length || 0) > 10 && (
                                                    <span className="px-2 py-1 text-xs text-gray-500">+{applicantData.skills.length - 10} more</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Suggestions */}
                                        {healthScore < 100 && (
                                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                                <h4 className="font-semibold text-blue-900 mb-2 text-sm">Improve Your Profile</h4>
                                                <ul className="space-y-2 text-xs text-gray-700">
                                                    {!applicantData.projects?.length && (
                                                        <li className="flex items-start gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5" />
                                                            <span>Add <b>Projects</b> to showcase practical experience.</span>
                                                        </li>
                                                    )}
                                                    {!applicantData.experience?.length && (
                                                        <li className="flex items-start gap-2">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5" />
                                                            <span>List <b>Internships</b> or work experience if available.</span>
                                                        </li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}

export default ProfileHealth
