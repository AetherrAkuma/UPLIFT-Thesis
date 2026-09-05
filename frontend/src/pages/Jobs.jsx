import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, ArrowRight, X } from 'lucide-react';

const Jobs = () => {
    const { API_BASE_URL } = useAuth();
    const navigate = useNavigate();

    const [publicJobs, setPublicJobs] = useState([]);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedJobType, setSelectedJobType] = useState('All');
    const [selectedEnvironment, setSelectedEnvironment] = useState('All');
    const [selectedLocation, setSelectedLocation] = useState('All');
    const [selectedStamina, setSelectedStamina] = useState('All');

    const locationsList = ['All', ...new Set(publicJobs.map(job => job.location).filter(Boolean))];

    useEffect(() => {
        const fetchPublicJobs = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/public/jobs`);
                setPublicJobs(res.data);
            } catch (err) {
                console.error("Failed to load public jobs:", err);
            } finally {
                setLoadingJobs(false);
            }
        };
        fetchPublicJobs();
    }, [API_BASE_URL]);

    const filteredJobs = useMemo(() => {
        return publicJobs.filter(job => {
            const q = searchQuery.toLowerCase().trim();
            if (q) {
                const matchesQuery = (
                    (job.job_title || '').toLowerCase().includes(q) ||
                    (job.employer_name || '').toLowerCase().includes(q) ||
                    (job.location || '').toLowerCase().includes(q) ||
                    (job.job_description || '').toLowerCase().includes(q) ||
                    (job.structured_skills || '').toLowerCase().includes(q)
                );
                if (!matchesQuery) return false;
            }
            if (selectedJobType !== 'All' && job.job_type !== selectedJobType) return false;
            if (selectedEnvironment !== 'All') {
                if (selectedEnvironment === 'Remote' && !job.remote_friendly) return false;
                if (selectedEnvironment === 'Indoor' && job.work_environment !== 'Indoor') return false;
                if (selectedEnvironment === 'Outdoor' && job.work_environment !== 'Outdoor') return false;
            }
            if (selectedLocation !== 'All' && job.location !== selectedLocation) return false;
            if (selectedStamina !== 'All' && job.stamina_required !== selectedStamina) return false;
            return true;
        });
    }, [publicJobs, searchQuery, selectedJobType, selectedEnvironment, selectedLocation, selectedStamina]);

    return (
        <div className="min-h-screen bg-slate-50 py-10 sm:py-16 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
                {/* Header Banner */}
                <div className="text-center mb-10 sm:mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-[#0038A8] text-[10px] font-black uppercase tracking-widest mb-4 sm:mb-6 border border-blue-100">
                        <Briefcase size={12} /> Public Job Board
                    </div>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3 sm:mb-4">
                        Explore Open <span className="text-[#0038A8]">Opportunities</span>
                    </h1>
                    <p className="text-slate-500 font-medium text-base sm:text-lg max-w-2xl mx-auto">
                        Search and filter approved, verified-safe vacancies from inclusive employers across the Philippines.
                    </p>
                </div>

                {/* Search and Filters Card */}
                <div className="max-w-4xl mx-auto mb-10 sm:mb-16 bg-white rounded-3xl sm:rounded-[2rem] p-5 sm:p-8 border border-slate-100 shadow-sm space-y-5 sm:space-y-6">
                    <div className="relative">
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by title, employer, location, or skills..."
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 sm:px-6 py-3.5 sm:py-4.5 pr-12 text-slate-700 placeholder:text-slate-400 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all text-xs sm:text-sm font-bold shadow-inner"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                                title="Clear search"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        {/* Job Type Select */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Job Type</label>
                            <select 
                                value={selectedJobType}
                                onChange={(e) => setSelectedJobType(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 focus:border-[#0038A8] focus:bg-white focus:outline-none cursor-pointer transition-all"
                            >
                                <option value="All">All Types</option>
                                <option value="Full-time">Full-time</option>
                                <option value="Part-time">Part-time</option>
                                <option value="Contract">Contract</option>
                            </select>
                        </div>

                        {/* Work Environment Select */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Work Setup</label>
                            <select 
                                value={selectedEnvironment}
                                onChange={(e) => setSelectedEnvironment(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 focus:border-[#0038A8] focus:bg-white focus:outline-none cursor-pointer transition-all"
                            >
                                <option value="All">All Setups</option>
                                <option value="Remote">Remote Friendly</option>
                                <option value="Indoor">On-Site (Indoor)</option>
                                <option value="Outdoor">Outdoor</option>
                            </select>
                        </div>

                        {/* Location Select */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Location</label>
                            <select 
                                value={selectedLocation}
                                onChange={(e) => setSelectedLocation(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 focus:border-[#0038A8] focus:bg-white focus:outline-none cursor-pointer transition-all"
                            >
                                {locationsList.map(loc => (
                                    <option key={loc} value={loc}>{loc === 'All' ? 'All Locations' : loc}</option>
                                ))}
                            </select>
                        </div>

                        {/* Stamina Required Select */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Stamina Load</label>
                            <select 
                                value={selectedStamina}
                                onChange={(e) => setSelectedStamina(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 focus:border-[#0038A8] focus:bg-white focus:outline-none cursor-pointer transition-all"
                            >
                                <option value="All">All Stamina</option>
                                <option value="Low">Low Stamina</option>
                                <option value="Medium">Medium Stamina</option>
                                <option value="High">High Stamina</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Jobs List Grid */}
                {loadingJobs ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-10 h-10 border-4 border-[#0038A8] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredJobs.map(job => (
                            <motion.div 
                                key={job.id}
                                whileHover={{ y: -6 }}
                                className="bg-white rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="w-12 h-12 bg-blue-50 text-[#0038A8] rounded-2xl flex items-center justify-center font-black text-lg">
                                            {job.employer_name?.charAt(0)}
                                        </div>
                                        <span className="px-3 py-1 bg-slate-50 border border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                                            {job.job_type}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 mb-2 line-clamp-1">{job.job_title}</h3>
                                    <p className="text-sm font-bold text-slate-400 mb-4">{job.employer_name}</p>
                                    <div className="flex items-center gap-2 text-slate-500 font-bold text-xs mb-6">
                                        <MapPin size={14} className="text-blue-500" />
                                        <span>{job.location}</span>
                                    </div>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6 line-clamp-3">
                                        {job.job_description}
                                    </p>
                                </div>
                                <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                                    <span className="text-xs font-black text-[#0038A8] bg-blue-50/50 px-3 py-1.5 rounded-xl border border-blue-100/50">
                                        {job.salary_range}
                                    </span>
                                    <button 
                                        onClick={() => navigate(`/job/${job.id}`)}
                                        className="text-xs font-black uppercase tracking-widest text-[#0038A8] hover:text-blue-800 flex items-center gap-1.5"
                                    >
                                        Details <ArrowRight size={14} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                        {filteredJobs.length === 0 && (
                            <div className="col-span-full text-center py-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm mb-2">No opportunities match your search.</p>
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedJobType('All');
                                        setSelectedEnvironment('All');
                                        setSelectedLocation('All');
                                        setSelectedStamina('All');
                                    }}
                                    className="text-xs font-black uppercase tracking-wider text-[#0038A8] hover:underline"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Jobs;
