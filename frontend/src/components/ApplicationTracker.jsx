import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, Building2, ExternalLink, CheckCircle, Clock, XCircle, X } from 'lucide-react'

const ApplicationTracker = ({ jobApps = [], collegeApps = [] }) => {
    const [showModal, setShowModal] = useState(false)
    const [activeTab, setActiveTab] = useState('jobs')

    const totalApps = jobApps.length + collegeApps.length

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'accepted': return 'text-green-400 bg-green-900/20 border-green-500/30'
            case 'rejected': return 'text-red-400 bg-red-900/20 border-red-500/30'
            case 'interviewing': return 'text-blue-400 bg-blue-900/20 border-blue-500/30'
            default: return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30'
        }
    }

    const getStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'accepted': return <CheckCircle className="w-4 h-4" />
            case 'rejected': return <XCircle className="w-4 h-4" />
            default: return <Clock className="w-4 h-4" />
        }
    }

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowModal(true)}
                className="flex items-center space-x-3 px-5 py-3 bg-dark-800 border border-dark-600 rounded-xl hover:bg-dark-700 transition-all group"
            >
                <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 z-10">
                        <Briefcase className="w-4 h-4" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <Building2 className="w-4 h-4" />
                    </div>
                </div>
                <div className="text-left">
                    <div className="text-xs text-gray-400 font-medium group-hover:text-gray-300">Applications</div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                        {totalApps} Active
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    </div>
                </div>
            </motion.button>

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
                        >
                            <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-900/50">
                                <h3 className="text-xl font-bold">Application Status Board</h3>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex border-b border-dark-700">
                                <button
                                    onClick={() => setActiveTab('jobs')}
                                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'jobs' ? 'border-blue-500 text-blue-400 bg-blue-900/10' : 'border-transparent text-gray-400 hover:text-white'
                                        }`}
                                >
                                    Job Applications ({jobApps.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('colleges')}
                                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'colleges' ? 'border-purple-500 text-purple-400 bg-purple-900/10' : 'border-transparent text-gray-400 hover:text-white'
                                        }`}
                                >
                                    College Applications ({collegeApps.length})
                                </button>
                            </div>

                            <div className="overflow-y-auto p-4 flex-1">
                                {activeTab === 'jobs' ? (
                                    <div className="space-y-3">
                                        {jobApps.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">No job applications yet.</div>
                                        ) : (
                                            jobApps.map((app, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700">
                                                    <div>
                                                        <h4 className="font-semibold text-white">{app.job?.title || 'Unknown Job'}</h4>
                                                        <p className="text-sm text-gray-400">{app.job?.company || 'Unknown Company'}</p>
                                                        <p className="text-xs text-gray-500 mt-1">Applied: {new Date(app.applied_at).toLocaleDateString()}</p>
                                                    </div>
                                                    <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(app.status)}`}>
                                                        {getStatusIcon(app.status)}
                                                        <span className="capitalize">{app.status.replace('_', ' ')}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {collegeApps.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">No college applications yet.</div>
                                        ) : (
                                            collegeApps.map((app, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-4 bg-dark-900/50 rounded-xl border border-dark-700">
                                                    <div>
                                                        <h4 className="font-semibold text-white">{app.college?.name || 'Unknown College'}</h4>
                                                        <p className="text-sm text-gray-400">{app.college?.location_city}, {app.college?.location_state}</p>
                                                        <p className="text-xs text-gray-500 mt-1">Applied: {new Date(app.applied_at).toLocaleDateString()}</p>
                                                    </div>
                                                    <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(app.status)}`}>
                                                        {getStatusIcon(app.status)}
                                                        <span className="capitalize">{app.status.replace('_', ' ')}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}

export default ApplicationTracker
