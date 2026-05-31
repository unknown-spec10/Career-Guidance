import React from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Briefcase, ChevronRight } from 'lucide-react'
import { calculateProfileCompletion } from '../utils/profileCompletion'

const ProfileHealth = ({ profileData }) => {
    const navigate = useNavigate()
    const healthScore = calculateProfileCompletion(profileData)
    const circumference = 2 * Math.PI * 14 // Radius 14
    const strokeDashoffset = circumference - (healthScore / 100) * circumference

    const getColor = () => {
        if (healthScore >= 80) return 'text-green-700 stroke-green-500'
        if (healthScore >= 50) return 'text-yellow-700 stroke-yellow-500'
        return 'text-red-700 stroke-red-500'
    }

    return (
        <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/student/profile')}
            className="group inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-1.5 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50"
            title="Open My Profile"
        >
            <div className="relative flex h-8 w-8 items-center justify-center">
                <svg className="h-full w-full -rotate-90 transform">
                    <circle
                        cx="16"
                        cy="16"
                        r="14"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="transparent"
                        className="text-gray-300"
                    />
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
                        className={`${getColor().split(' ')[1]} transition-all duration-700 ease-out`}
                    />
                </svg>
                <span className={`absolute text-[10px] font-bold ${getColor().split(' ')[0]}`}>
                    {healthScore}%
                </span>
            </div>

            <div className="flex items-center gap-2">
                <div className="text-left leading-tight">
                    <div className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">My Profile</div>
                    <div className="text-[11px] text-gray-500">Open profile section</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
            </div>
        </motion.button>
    )
}

export default ProfileHealth
