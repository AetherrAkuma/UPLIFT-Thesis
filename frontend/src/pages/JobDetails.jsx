/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowLeft, Building2, MapPin, 
    Briefcase, ShieldCheck, Mail, 
    Phone, Send, CheckCircle2, XCircle,
    Sparkles, AlertCircle, ChevronDown, ChevronUp,
    MessageSquare, Clock
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const JobDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token, API_BASE_URL } = useAuth();
    const [job, setJob] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [applied, setApplied] = useState(false);
    const [appStatus, setAppStatus] = useState(null);
    const [existingApp, setExistingApp] = useState(null);
    const [isDescExpanded, setIsDescExpanded] = useState(false);

    const fetchData = async () => {
        try {
            if (!token) {
                const jobRes = await axios.get(`${API_BASE_URL}/public/jobs/${id}`);
                setJob(jobRes.data);
                setLoading(false);
                return;
            }
            const [jobRes, userRes, appsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/jobs/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_BASE_URL}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_BASE_URL}/applications`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            setJob(jobRes.data);
            setUserProfile(userRes.data);
            
            const existing = appsRes.data.find(a => a.job_id === id);
            if (existing) {
                setApplied(true);
                setAppStatus(existing.status);
                setExistingApp(existing);
            }
            
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchData();
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
    );

    if (!job) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4 p-6 text-center">
            <AlertCircle size={48} className="text-slate-300" />
            <h2 className="text-xl font-black text-slate-800">Job not found</h2>
            <button onClick={() => navigate('/dashboard')} className="text-blue-600 font-bold hover:underline">Back to Discovery</button>
        </div>
    );

    const isLongDescription = (job.job_description || '').length > 350;

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-28 md:pb-20">
            {/* Top Navigation Bar */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-colors group text-sm sm:text-base">
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="hidden xs:inline">Back to Discovery</span>
                        <span className="xs:hidden">Back</span>
                    </button>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                            ID: {id?.substring(0,8)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 sm:mt-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
                    {/* Main Content Column */}
                    <div className="lg:col-span-2 space-y-6 sm:space-y-10">
                        {/* Title Section */}
                        <div className="bg-white rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-blue-50 text-blue-600 rounded-2xl sm:rounded-3xl border border-blue-100 shadow-sm flex items-center justify-center text-2xl sm:text-3xl font-black shrink-0">
                                    {job.employer_name?.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 mb-2 leading-tight break-words">
                                        {job.job_title}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 font-bold text-xs sm:text-sm">
                                        <span className="flex items-center gap-1.5"><Building2 size={16} className="text-blue-500 shrink-0"/> {job.employer_name}</span>
                                        <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-slate-300" />
                                        <span className="flex items-center gap-1.5"><MapPin size={16} className="text-blue-500 shrink-0"/> {job.location}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 sm:gap-3">
                                <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-50 text-blue-600 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider border border-blue-100">
                                    {job.job_type}
                                </span>
                                {job.salary_range && (
                                    <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider border border-emerald-100">
                                        {job.salary_range}
                                    </span>
                                )}
                                <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider border border-indigo-100">
                                    ✓ Verified Safe
                                </span>
                            </div>
                        </div>

                        {/* Employer Approval & Interview Instructions Banner */}
                        {applied && appStatus === 'Approved' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-white border-2 border-emerald-300 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-emerald-900/5 space-y-4"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                                                Application Approved
                                            </span>
                                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">Next Steps & Interview Instructions</h3>
                                        </div>
                                    </div>
                                    {existingApp?.applied_at && (
                                        <span className="text-xs font-bold text-slate-400">
                                            Applied: {new Date(existingApp.applied_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-emerald-200/80 shadow-sm space-y-2">
                                    <div className="flex items-center gap-2 text-emerald-800 text-xs font-black uppercase tracking-wider">
                                        <MessageSquare size={16} className="text-emerald-600" />
                                        Employer & Interview Notes
                                    </div>
                                    {existingApp?.employer_notes ? (
                                        <p className="text-slate-800 text-sm sm:text-base font-medium leading-relaxed whitespace-pre-wrap bg-emerald-50/40 p-4 rounded-xl border border-emerald-100/60">
                                            {existingApp.employer_notes}
                                        </p>
                                    ) : (
                                        <p className="text-slate-500 text-xs sm:text-sm font-medium italic">
                                            Your application has been approved by the employer. They will reach out to schedule your interview or onboarding shortly.
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Employer Rejection / Feedback Banner */}
                        {applied && appStatus === 'Rejected' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-rose-50/70 border-2 border-rose-200 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 space-y-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center shrink-0">
                                        <XCircle size={20} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 bg-rose-100 px-3 py-1 rounded-full border border-rose-200">
                                            Application Update
                                        </span>
                                        <h3 className="text-lg font-black text-slate-900 mt-0.5">Application Status: Declined</h3>
                                    </div>
                                </div>
                                {existingApp?.employer_notes && (
                                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-rose-100 space-y-1.5 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-rose-600">Employer Feedback</p>
                                        <p className="text-slate-700 text-xs sm:text-sm font-medium whitespace-pre-wrap">{existingApp.employer_notes}</p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Description Card with Scaling & Collapsible See More */}
                        <div className="bg-white rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 md:p-10 border border-slate-100 shadow-sm">
                            <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-4 sm:mb-6 flex items-center gap-2.5">
                                <Briefcase size={20} className="text-blue-500" />
                                Job Description
                            </h2>

                            <div className="relative">
                                <div className={`prose prose-slate max-w-none transition-all duration-300 ${!isDescExpanded && isLongDescription ? 'max-h-48 overflow-hidden' : ''}`}>
                                    <p className="text-slate-600 leading-relaxed font-medium text-sm sm:text-base md:text-lg whitespace-pre-wrap">
                                        {job.job_description}
                                    </p>
                                </div>

                                {!isDescExpanded && isLongDescription && (
                                    <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                                )}
                            </div>

                            {isLongDescription && (
                                <div className="mt-3">
                                    <button
                                        onClick={() => setIsDescExpanded(!isDescExpanded)}
                                        className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-blue-600 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100 py-2 px-4 rounded-xl transition-all"
                                    >
                                        {isDescExpanded ? (
                                            <><span>See Less</span> <ChevronUp size={14} /></>
                                        ) : (
                                            <><span>See More</span> <ChevronDown size={14} /></>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Work Environment & Operational Snapshot */}
                            <div className="mt-8 sm:mt-10 pt-8 sm:pt-10 border-t border-slate-100">
                                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-widest mb-4">
                                    Work Environment & Operational Snapshot
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
                                    <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Setting</p>
                                        <p className="font-bold text-slate-800 text-xs sm:text-sm mt-1 truncate">{job.work_environment || 'Indoor'} {job.remote_friendly ? '(Remote)' : ''}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Posture</p>
                                        <p className="font-bold text-slate-800 text-xs sm:text-sm mt-1 truncate">{job.physical_demand === 'Low' ? 'Mostly Seated' : job.physical_demand === 'High' ? 'Active / Moving' : 'Standard Desk'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Communication</p>
                                        <p className="font-bold text-slate-800 text-xs sm:text-sm mt-1 truncate">{job.auditory_demand === 'Low' ? 'Text / Email-First' : 'Mixed / Spoken'}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider">Operational Pace</p>
                                        <p className="font-bold text-slate-800 text-xs sm:text-sm mt-1 truncate">{job.work_tempo || 'Moderate'} {job.has_flexibility ? '• Flex' : ''}</p>
                                    </div>
                                </div>

                                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-widest mb-2.5">
                                    Physical Requirements & Posture
                                </h3>
                                <div className="bg-slate-50 rounded-2xl p-4 sm:p-6 border border-slate-100 mb-6">
                                    <p className="text-slate-600 font-bold text-xs sm:text-sm leading-relaxed">
                                        {job.physical_requirements || 'Standard workstation physical expectations.'}
                                    </p>
                                </div>

                                {job.accessibility_features && (
                                    <>
                                        <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-widest mb-2.5">
                                            Workplace Adaptations & Accessibility
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {job.accessibility_features.split(',').map((acc, i) => (
                                                <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-[11px] sm:text-xs font-bold border border-blue-100">
                                                    ✓ {acc.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Employer Benefits */}
                        {job.benefits && (
                            <div className="bg-slate-900 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
                                <div className="absolute -bottom-10 -right-10 opacity-10 pointer-events-none">
                                    <Sparkles size={160} />
                                </div>
                                <h2 className="text-lg sm:text-xl font-black mb-6 flex items-center gap-2.5">
                                    <ShieldCheck size={20} className="text-blue-400" />
                                    Employee Benefits
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {job.benefits.split(',').map((b, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-white/5 p-3.5 rounded-2xl border border-white/10">
                                            <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                                            <span className="font-bold text-slate-300 text-xs sm:text-sm">{b.trim()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Resume & Apply */}
                    <div className="space-y-6">
                        {/* Resume Preview Card */}
                        <div className="bg-white rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 shadow-sm relative overflow-hidden">
                            {!token ? (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">UPLIFT Application</h3>
                                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase">Join Us</span>
                                    </div>
                                    <p className="text-slate-500 font-medium leading-relaxed text-xs sm:text-sm mb-6">
                                        Create a <strong>Progressive Profile</strong> containing your skills and accommodations to receive automated suitability matches and apply directly.
                                    </p>
                                    <button 
                                        onClick={() => {
                                            sessionStorage.setItem('redirect_after_login', `/job/${id}`);
                                            navigate('/?mode=login');
                                        }}
                                        className="w-full py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2.5"
                                    >
                                        <Send size={16} />
                                        Log In to Apply
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Your Application</h3>
                                        {applied ? (
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                                appStatus === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                appStatus === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                'bg-blue-50 text-blue-600 border-blue-100'
                                            }`}>
                                                {appStatus || 'Pending'}
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase">ATS Matched</span>
                                        )}
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        {applied && existingApp?.employer_notes && (
                                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Employer Note</p>
                                                <p className="text-[11px] font-bold text-slate-700 leading-snug line-clamp-3">"{existingApp.employer_notes}"</p>
                                            </div>
                                        )}
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-1 bg-emerald-100 rounded-lg text-emerald-600 shrink-0 mt-0.5">
                                                <CheckCircle2 size={13} />
                                            </div>
                                            <p className="text-[11px] font-medium text-slate-600 leading-snug">
                                                Auto-includes your specific disability accommodations profile for transparent matching.
                                            </p>
                                        </div>
                                        {userProfile?.skills && (
                                            <div className="flex items-start gap-2.5">
                                                <div className="p-1 bg-blue-100 rounded-lg text-blue-600 shrink-0 mt-0.5">
                                                    <CheckCircle2 size={13} />
                                                </div>
                                                <p className="text-[11px] font-medium text-slate-600 leading-snug">
                                                    Your skills: <span className="text-blue-600 font-bold">{userProfile.skills}</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => navigate(`/apply/${id}`)}
                                        disabled={applied}
                                        className={`w-full py-4 sm:py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2.5 shadow-xl ${
                                            applied 
                                            ? (appStatus === 'Approved' ? 'bg-emerald-600 text-white shadow-emerald-200' : 
                                               appStatus === 'Rejected' ? 'bg-rose-600 text-white shadow-rose-200' :
                                               'bg-slate-400 text-white shadow-slate-100')
                                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95'
                                        }`}
                                    >
                                        {applied ? (
                                            <>
                                                <CheckCircle2 size={16} />
                                                {appStatus === 'Approved' ? 'Application Approved' : 
                                                 appStatus === 'Rejected' ? 'Application Rejected' : 
                                                 'Application Pending'}
                                            </>
                                        ) : (
                                            <>
                                                <Send size={16} />
                                                Submit Application
                                            </>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Employer Contact */}
                        {job.contacts && job.contacts.length > 0 && (
                            <div className="bg-white rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 shadow-sm">
                                <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-4">Employer Contact</h3>
                                <div className="space-y-3">
                                    {job.contacts.map((contact, i) => (
                                        <div key={i} className="flex items-center gap-2.5 text-slate-600 hover:text-blue-600 transition-colors">
                                            <div className="p-2 bg-slate-50 rounded-xl">
                                                {contact.includes('@') ? <Mail size={15} /> : <Phone size={15} />}
                                            </div>
                                            <span className="font-bold text-xs sm:text-sm break-all">{contact}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="p-5 bg-blue-50/80 rounded-2xl border border-blue-100 flex items-start gap-3">
                            <div className="p-1.5 bg-white rounded-lg text-blue-600 shadow-sm shrink-0">
                                <AlertCircle size={15} />
                            </div>
                            <p className="text-[10px] font-bold text-blue-900 leading-relaxed uppercase tracking-wider">
                                Your UPLIFT Capability Score is matched objectively against this workplace environment.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Mobile Sticky Apply Bar */}
            <div className="lg:hidden fixed bottom-0 inset-x-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 flex items-center justify-between gap-4 shadow-2xl">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-900 truncate">{job.job_title}</p>
                    <p className="text-[10px] font-bold text-slate-400 truncate">{job.employer_name} • {job.salary_range || job.job_type}</p>
                </div>
                <button
                    onClick={() => {
                        if (!token) {
                            sessionStorage.setItem('redirect_after_login', `/job/${id}`);
                            navigate('/?mode=login');
                        } else if (!applied) {
                            navigate(`/apply/${id}`);
                        }
                    }}
                    disabled={applied}
                    className={`px-5 py-3 rounded-xl font-black uppercase tracking-wider text-xs flex items-center gap-1.5 shadow-lg shrink-0 ${
                        applied 
                        ? 'bg-slate-300 text-white' 
                        : 'bg-blue-600 text-white active:scale-95 shadow-blue-200'
                    }`}
                >
                    <Send size={14} />
                    {applied ? 'Applied' : 'Apply Now'}
                </button>
            </div>
        </div>
    );
};

export default JobDetails;
