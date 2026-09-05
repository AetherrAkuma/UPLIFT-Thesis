/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Briefcase, Clock, Building2, ChevronRight, RefreshCw
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Applications = () => {
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { token, API_BASE_URL } = useAuth();



    const fetchApps = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/applications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setApps(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchApps();
    }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    const getStatusStyles = (status) => {
        switch (status) {
            case 'Approved': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'Rejected': return 'bg-rose-50 text-rose-600 border-rose-100';
            default: return 'bg-blue-50 text-blue-600 border-blue-100';
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Header */}
            <div className="bg-white border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Job Applications</h1>
                        <p className="text-sm font-bold text-slate-400">Track your vocational journey</p>
                    </div>
                    <button 
                        onClick={fetchApps}
                        className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400 hover:text-blue-600 border border-transparent hover:border-slate-100"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-12">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1,2,3].map(i => (
                            <div key={i} className="bg-white rounded-[2rem] p-8 border border-slate-100 h-64 animate-pulse" />
                        ))}
                    </div>
                ) : apps.length === 0 ? (
                    <div className="bg-white rounded-[3rem] p-20 text-center border border-slate-100 shadow-sm max-w-2xl mx-auto">
                        <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-blue-600 mx-auto mb-8 shadow-inner">
                            <Briefcase size={40} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-4">No Applications Yet</h2>
                        <p className="text-slate-500 font-bold mb-8">Your dream job is waiting for you in the Discovery dashboard.</p>
                        <button 
                            onClick={() => navigate('/dashboard')}
                            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                        >
                            Start Discovery
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <AnimatePresence>
                            {apps.map((app, index) => (
                                <motion.div 
                                    key={app.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden group cursor-pointer"
                                    onClick={() => navigate(`/job/${app.job_id}`)}
                                >
                                    <div className="p-8">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center text-xl font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                {app.employer_name?.charAt(0)}
                                            </div>
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(app.status)}`}>
                                                {app.status}
                                            </span>
                                        </div>

                                        <h3 className="text-xl font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">{app.job_title}</h3>
                                        <div className="flex items-center gap-2 text-slate-400 text-sm font-bold mb-6">
                                            <Building2 size={16} />
                                            {app.employer_name}
                                        </div>

                                        <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <Clock size={14} className="text-slate-300" />
                                                Applied {new Date(app.applied_at).toLocaleDateString()}
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:translate-x-1">
                                                <ChevronRight size={18} />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Applications;
