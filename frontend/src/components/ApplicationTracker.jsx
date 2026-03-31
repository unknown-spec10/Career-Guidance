import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Briefcase, CheckCircle, Clock, XCircle, X, TrendingUp } from 'lucide-react'

const ApplicationTracker = ({ jobApps = [] }) => {
    const [showModal, setShowModal] = useState(false)
    const totalApps = jobApps.length
    const interviewingCount = jobApps.filter((app) => app.status?.toLowerCase() === 'interviewing').length
    const offerCount = jobApps.filter((app) => app.status?.toLowerCase() === 'accepted').length
    const closedCount = jobApps.filter((app) => ['accepted', 'rejected', 'withdrawn'].includes(app.status?.toLowerCase())).length

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'accepted':
                return 'text-green-700 bg-green-50 border-green-200'
            case 'rejected':
                return 'text-red-700 bg-red-50 border-red-200'
            case 'interviewing':
                return 'text-blue-700 bg-blue-50 border-blue-200'
            default:
                return 'text-yellow-700 bg-yellow-50 border-yellow-200'
        }
    }

    const getStatusIcon = (status) => {
        switch (status?.toLowerCase()) {
            case 'accepted':
                return <CheckCircle className="w-4 h-4" />
            case 'rejected':
                return <XCircle className="w-4 h-4" />
            default:
                return <Clock className="w-4 h-4" />
        }
    }

    return (
        <>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowModal(true)}
                className="w-full text-left p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all shadow-sm"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Application Pipeline</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalApps} Active Applications</h3>
                        <p className="text-sm text-gray-600 mt-1">Track your progress across all applied jobs.</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                        <Briefcase className="w-5 h-5" />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs text-gray-500">Sent</p>
                        <p className="text-lg font-semibold text-gray-900">{totalApps}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs text-gray-500">Interview</p>
                        <p className="text-lg font-semibold text-gray-900">{interviewingCount}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs text-gray-500">Offers</p>
                        <p className="text-lg font-semibold text-gray-900">{offerCount}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                        <p className="text-xs text-gray-500">Closed</p>
                        <p className="text-lg font-semibold text-gray-900">{closedCount}</p>
                    </div>
                </div>

                <div className="mt-4 inline-flex items-center gap-2 text-sm text-blue-700 font-medium">
                    <TrendingUp className="w-4 h-4" />
                    View full status board
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
                            className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl flex flex-col max-h-[80vh]"
                        >
                            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                                <h3 className="text-xl font-bold text-gray-900">Application Status Board</h3>
                                <button onClick={() => setShowModal(false)} className="text-gray-600 hover:text-gray-900">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-4 flex-1">
                                <div className="space-y-3">
                                    {jobApps.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">No job applications yet.</div>
                                    ) : (
                                        jobApps.map((app, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                <div>
                                                    <h4 className="font-semibold text-gray-900">{app.job?.title || 'Unknown Job'}</h4>
                                                    <p className="text-sm text-gray-600">{app.job?.company || 'Unknown Company'}</p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Applied: {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'N/A'}
                                                    </p>
                                                </div>
                                                <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(app.status)}`}>
                                                    {getStatusIcon(app.status)}
                                                    <span className="capitalize">{(app.status || 'pending').replace('_', ' ')}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    )
}

export default ApplicationTracker
