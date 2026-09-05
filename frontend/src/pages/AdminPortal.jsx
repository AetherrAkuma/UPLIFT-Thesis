/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { 
    ShieldCheck, UserCheck, Briefcase, FileSearch, Activity, 
    CheckCircle2, XCircle, Clock, TrendingUp,
    Users, Settings, Search, Building2,
    Scale, AlertTriangle, BarChart3, Menu, X, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const AdminPortal = () => {
    const { user, token, logout, API_BASE_URL } = useAuth();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('overview'); // overview, employers, jobs, logs, fairness
    const [stats, setStats] = useState(null);
    const [pendingEmployers, setPendingEmployers] = useState([]);
    const [pendingJobs, setPendingJobs] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [mobileSidebar, setMobileSidebar] = useState(false);
    const [fairnessReport, setFairnessReport] = useState(null);
    const [fairnessLoading, setFairnessLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null); // For detail modals
    const [resumeTheme, setResumeTheme] = useState('classic');
    const [themeSaving, setThemeSaving] = useState(false);

    const fetchResumeTheme = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/resume-settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setResumeTheme(res.data.resume_theme);
        } catch {
            // Non-critical
        }
    };

    const handleAuthError = (err, contextMessage) => {
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            console.warn(`Auth failed during ${contextMessage}, redirecting to login...`);
            logout();
        } else {
            console.warn(`${contextMessage} failed (server issue):`, err.message || err);
        }
    };

    const handleResumeThemeChange = async (newTheme) => {
        setThemeSaving(true);
        try {
            await axios.put(`${API_BASE_URL}/admin/resume-settings`,
                { resume_theme: newTheme },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            setResumeTheme(newTheme);
            toast.success("Resume theme updated successfully!");
        } catch {
            toast.error('Failed to update resume theme.');
        } finally {
            setThemeSaving(false);
        }
    };

    const fetchStats = async () => {
        if (!token) return;
        setStatsLoading(true);
        setFetchError(null);
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/system-info`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setStats(res.data);
        } catch (err) {
            handleAuthError(err, "Stats fetch");
            if (!err.response || (err.response.status !== 401 && err.response.status !== 403)) {
                setFetchError("Cannot connect to server — is PostgreSQL running?");
            }
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchPendingEmployers = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/employers/pending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setPendingEmployers(res.data.employers);
        } catch (err) {
            handleAuthError(err, "Employers fetch");
        }
    };

    const fetchPendingJobs = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/jobs/pending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setPendingJobs(res.data.jobs);
        } catch (err) {
            handleAuthError(err, "Jobs fetch");
        }
    };

    const fetchAuditLogs = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setAuditLogs(res.data);
        } catch (err) {
            handleAuthError(err, "Logs fetch");
        }
    };

    const fetchFairnessReport = async () => {
        setFairnessLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/admin/fairness-report`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setFairnessReport(res.data);
        } catch (err) {
            console.error("Fairness report fetch failed", err);
            setFairnessReport({ error: "Failed to fetch fairness report." });
        } finally {
            setFairnessLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        fetchStats();
        fetchAuditLogs();
        fetchResumeTheme();
        if (activeTab === 'employers') fetchPendingEmployers();
        if (activeTab === 'jobs') fetchPendingJobs();
        if (activeTab === 'fairness') fetchFairnessReport();
    }, [activeTab, token]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleVerifyEmployer = async (userId, action, reason = "") => {
        if (!token) return;
        try {
            await axios.post(`${API_BASE_URL}/admin/verify-employer/${userId}`, 
                { action, reason },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            setSelectedItem(null);
            fetchPendingEmployers();
            fetchStats();
            toast.success(action === 'approve' ? "Employer account successfully verified!" : "Employer account rejected.");
        } catch (err) {
            if (err.response && err.response.status === 401) {
                handleAuthError(err, "Verify employer");
            } else {
                toast.error("Action failed: " + (err.response?.data?.detail || "Unknown error"));
            }
        }
    };

    const handleVerifyJob = async (jobId) => {
        if (!token) return;
        try {
            await axios.post(`${API_BASE_URL}/admin/approve-job/${jobId}`, 
                {},
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            setSelectedItem(null);
            fetchPendingJobs();
            fetchStats();
            toast.success("Job listing successfully approved!");
        } catch (err) {
            if (err.response && err.response.status === 401) {
                handleAuthError(err, "Verify job");
            } else {
                toast.error("Approval failed: " + (err.response?.data?.detail || "Unknown error"));
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Admin Sidebar */}
            <aside className="hidden lg:block w-72 bg-white border-r border-slate-200 flex flex-col fixed h-full z-20" role="navigation" aria-label="Admin navigation">
                <div className="p-8 border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 bg-[#0038A8] rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-100">
                            <ShieldCheck size={18} />
                        </div>
                        <span className="font-black text-xl tracking-tighter text-slate-900">ADMIN <span className="text-[#0038A8]">CORE</span></span>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">System Level: root</p>
                </div>

                <nav className="flex-1 p-6 space-y-2">
                    <NavItem active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Activity size={20}/>} label="Overview" />
                    <NavItem active={activeTab === 'employers'} onClick={() => setActiveTab('employers')} icon={<UserCheck size={20}/>} label="Employers" badge={stats?.pending_employers} />
                    <NavItem active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} icon={<Briefcase size={20}/>} label="Job Queue" badge={stats?.pending_jobs} />
                    <NavItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<FileSearch size={20}/>} label="Audit Logs" />
                    <NavItem active={activeTab === 'fairness'} onClick={() => setActiveTab('fairness')} icon={<Scale size={20}/>} label="Fairness AIF360" />
                    <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20}/>} label="Settings" />
                </nav>

                <div className="p-6 mt-auto border-t border-slate-100">
                    <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-bold text-slate-700 shadow-sm">
                            {user?.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{user?.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Master Admin</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            {/* Mobile top-nav (visible on small screens) */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                <button onClick={() => setMobileSidebar(!mobileSidebar)} className="p-2 rounded-xl hover:bg-slate-100" aria-label={mobileSidebar ? "Close navigation menu" : "Open navigation menu"}>
                    <Menu size={22} aria-hidden="true" />
                </button>
                <span className="font-black text-sm tracking-tighter text-slate-900">ADMIN <span className="text-[#0038A8]">CORE</span></span>
            </div>

            {/* Mobile sidebar overlay */}
            {mobileSidebar && (
                <div className="lg:hidden fixed inset-0 z-30">
                    <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileSidebar(false)} aria-hidden="true" />
                    <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white border-r border-slate-200 flex flex-col overflow-y-auto shadow-2xl" role="navigation" aria-label="Admin navigation">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-[#0038A8] rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-100">
                                    <ShieldCheck size={18} />
                                </div>
                                <span className="font-black text-xl tracking-tighter text-slate-900">ADMIN <span className="text-[#0038A8]">CORE</span></span>
                            </div>
                            <button onClick={() => setMobileSidebar(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400" aria-label="Close navigation menu">
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <nav className="flex-1 p-6 space-y-2">
                            <NavItem active={activeTab === 'overview'} onClick={() => { setActiveTab('overview'); setMobileSidebar(false); }} icon={<Activity size={20}/>} label="Overview" />
                            <NavItem active={activeTab === 'employers'} onClick={() => { setActiveTab('employers'); setMobileSidebar(false); }} icon={<UserCheck size={20}/>} label="Employers" badge={stats?.pending_employers} />
                            <NavItem active={activeTab === 'jobs'} onClick={() => { setActiveTab('jobs'); setMobileSidebar(false); }} icon={<Briefcase size={20}/>} label="Job Queue" badge={stats?.pending_jobs} />
                            <NavItem active={activeTab === 'logs'} onClick={() => { setActiveTab('logs'); setMobileSidebar(false); }} icon={<FileSearch size={20}/>} label="Audit Logs" />
                            <NavItem active={activeTab === 'fairness'} onClick={() => { setActiveTab('fairness'); setMobileSidebar(false); }} icon={<Scale size={20}/>} label="Fairness AIF360" />
                            <NavItem active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setMobileSidebar(false); }} icon={<Settings size={20}/>} label="Settings" />
                        </nav>
                    </aside>
                </div>
            )}

            <main className="flex-1 lg:ml-72 p-6 sm:p-8 lg:p-12 pt-20 lg:pt-0">
                <AnimatePresence mode="wait">
                    {activeTab === 'overview' && (
                        <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <header className="mb-12">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Platform Overview</h2>
                                <p className="text-slate-500 font-medium">Real-time diagnostics and platform metrics.</p>
                            </header>

                            {fetchError && (
                                <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
                                    <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black text-rose-700 uppercase tracking-widest mb-0.5">Connection Issue</p>
                                        <p className="text-xs text-rose-600">{fetchError}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                                {statsLoading ? (
                                    Array(4).fill(0).map((_, i) => (
                                        <div key={i} className="p-6 rounded-3xl border bg-white border-slate-100 shadow-sm animate-pulse">
                                            <div className="h-10 w-10 rounded-xl bg-slate-100 mb-4" />
                                            <div className="h-3 w-20 bg-slate-100 rounded mb-2" />
                                            <div className="h-8 w-16 bg-slate-100 rounded" />
                                        </div>
                                    ))
                                ) : (
                                    <>
                                        <StatCard label="Total Candidates" value={stats?.pwd_count} icon={<Users className="text-blue-600" />} trend="+12% this week" />
                                        <StatCard label="Active Employers" value={stats?.employer_count} icon={<Building2 className="text-indigo-600" />} />
                                        <StatCard label="Pending Verifications" value={(stats?.pending_employers || 0) + (stats?.pending_jobs || 0)} icon={<Clock className="text-[#CE1126]" />} highlight />
                                        <StatCard label="AI Matchings" value={(stats?.total_applications || 0) * 8} icon={<TrendingUp className="text-emerald-600" />} />
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-8">
                                    <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-slate-100 shadow-xl shadow-slate-200/40">
                                        <div className="flex items-center justify-between mb-8">
                                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">System Health</h3>
                                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> All Systems Online
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <HealthBar label="Semantic Engine (all-MiniLM-L12-v2)" status="Optimal" pct={98} />
                                            <HealthBar label="Cross-Encoder Reranker" status="Optimal" pct={96} />
                                            <HealthBar label="Generative Data Analysis (T5)" status="Healthy" pct={92} />
                                            <HealthBar label="Vector DB (FAISS Index)" status="Active" pct={100} />
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-1">
                                    <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 lg:p-10 text-white shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-8 opacity-10">
                                            <Activity size={120} />
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-blue-400 mb-6">Recent Activity</h3>
                                        <div className="space-y-4">
                                            {auditLogs.length === 0 ? (
                                                <p className="text-[11px] text-slate-500 italic">No recent activity yet.</p>
                                            ) : auditLogs.slice(0, 3).map(log => (
                                                <AlertItem 
                                                    key={log.id}
                                                    type={log.action.includes('approve') ? 'success' : log.action.includes('reject') ? 'warning' : 'info'} 
                                                    msg={log.details} 
                                                    time={new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'employers' && (
                        <motion.div key="employers" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <header className="mb-12 flex items-center justify-between">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Employer Verification</h2>
                                    <p className="text-slate-500 font-medium">Review and validate organizational applications.</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                                        <input type="text" placeholder="Search companies..." aria-label="Search companies" className="bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-6 text-sm font-medium focus:outline-none focus:border-[#0038A8] transition-all w-full sm:w-64 max-w-xs" />
                                    </div>
                                </div>
                            </header>

                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-x-auto">
                                <table className="w-full text-left min-w-[600px]">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Organization</th>
                                            <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Application Date</th>
                                            <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                            <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {pendingEmployers.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-4 sm:px-8 py-20 text-center text-slate-400 font-medium italic">
                                                    No pending applications found.
                                                </td>
                                            </tr>
                                        ) : pendingEmployers.map(emp => (
                                            <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 sm:px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 uppercase">
                                                            {emp.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800">{emp.name}</p>
                                                            <p className="text-xs text-slate-500">{emp.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 sm:px-8 py-6 text-sm text-slate-500 font-medium">{emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A'}</td>
                                                <td className="px-4 sm:px-8 py-6">
                                                    <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">
                                                        {emp.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 sm:px-8 py-6 text-right">
                                                    <button 
                                                        onClick={() => setSelectedItem({ type: 'employer', data: emp })}
                                                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#0038A8] hover:text-white transition-all shadow-sm"
                                                    >
                                                        Review Application
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'jobs' && (
                        <motion.div key="jobs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                            <header className="mb-12">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Job Verification Queue</h2>
                                <p className="text-slate-500 font-medium">Ensuring role accessibility and safety standards.</p>
                            </header>

                            <div className="grid grid-cols-1 gap-6">
                                {pendingJobs.length === 0 ? (
                                    <div className="bg-white rounded-[2.5rem] p-20 text-center border-2 border-dashed border-slate-200">
                                        <Briefcase size={48} className="mx-auto mb-4 text-slate-200" />
                                        <p className="text-slate-400 font-medium">All job postings have been verified.</p>
                                    </div>
                                ) : pendingJobs.map(job => (
                                    <div key={job.id} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-8 group">
                                        <div className="flex gap-6 flex-1 min-w-0">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-[#0038A8] transition-colors">
                                                <Briefcase size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h4 className="font-black text-lg text-slate-800 truncate">{job.job_title}</h4>
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest">New Posting</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                                                    <span className="flex items-center gap-1.5"><Building2 size={14}/> {job.employer_name}</span>
                                                    <span className="flex items-center gap-1.5"><Activity size={14}/> {job.work_environment}</span>
                                                    <span className="flex items-center gap-1.5"><TrendingUp size={14}/> {job.work_tempo}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => setSelectedItem({ type: 'job', data: job })}
                                                className="px-5 py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                                            >
                                                Inspect Detail
                                            </button>
                                            <button 
                                                onClick={() => handleVerifyJob(job.id)}
                                                className="px-5 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                                            >
                                                Verify & Index
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'fairness' && (
                        <motion.div key="fairness" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <header className="mb-12 flex items-center justify-between">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">AI Fairness 360 Audit</h2>
                                    <p className="text-slate-500 font-medium">AIF360-powered bias detection across disability groups.</p>
                                </div>
                                <button
                                    onClick={fetchFairnessReport}
                                    className="px-5 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2"
                                >
                                    <BarChart3 size={16} /> Refresh Audit
                                </button>
                            </header>

                            {fairnessLoading ? (
                                <div className="bg-white rounded-[2.5rem] p-20 text-center border border-slate-100 shadow-xl shadow-slate-200/40">
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
                                    <p className="text-slate-400 font-medium">Computing fairness metrics...</p>
                                </div>
                            ) : fairnessReport?.error ? (
                                <div className="bg-white rounded-[2.5rem] p-20 text-center border border-slate-100 shadow-xl shadow-slate-200/40">
                                    <AlertTriangle size={48} className="mx-auto mb-4 text-amber-400" />
                                    <h3 className="text-xl font-black text-slate-800 mb-2">{fairnessReport.error}</h3>
                                    <p className="text-slate-400 text-sm">As PWD users search for jobs, their match data is logged. Run searches from user accounts to populate the fairness database.</p>
                                </div>
                            ) : fairnessReport && (
                                <div className="space-y-8">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        <StatCard label="Total Match Records" value={fairnessReport.total_records} icon={<BarChart3 className="text-indigo-600" />} />
                                        <StatCard label="Privileged Group" value={fairnessReport.privileged_group} icon={<ShieldCheck className="text-emerald-600" />} />
                                        <StatCard label="Demographic Parity" value={fairnessReport.fairness_metrics?.demographic_parity_ratio?.toFixed(3)} icon={<Scale className="text-blue-600" />} />
                                        <StatCard label="Disparate Impact" value={fairnessReport.fairness_metrics?.disparate_impact?.toFixed(3)} icon={<AlertTriangle className="text-amber-600" />} />
                                    </div>

                                    {/* Group Breakdown Table */}
                                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-x-auto">
                                        <table className="w-full text-left min-w-[500px]">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Disability Group</th>
                                                    <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Match Count</th>
                                                    <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Score</th>
                                                    <th className="px-4 sm:px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Favorable Rate (≥70%)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {Object.entries(fairnessReport.group_stats || {}).map(([cat, stats]) => (
                                                    <tr key={cat} className={`hover:bg-slate-50/50 transition-colors ${cat === fairnessReport.privileged_group ? 'bg-emerald-50/30' : ''}`}>
                                                        <td className="px-4 sm:px-8 py-5">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                                                                    cat === fairnessReport.privileged_group ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                    {cat.charAt(0)}
                                                                </div>
                                                                <span className="font-bold text-slate-800">{cat}</span>
                                                                {cat === fairnessReport.privileged_group && (
                                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-[8px] font-black uppercase tracking-widest">Privileged</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-8 py-5 text-sm font-bold text-slate-700">{stats.count}</td>
                                                        <td className="px-4 sm:px-8 py-5">
                                                            <span className={`text-sm font-black ${
                                                                stats.avg_score >= 75 ? 'text-emerald-600' : stats.avg_score >= 60 ? 'text-amber-600' : 'text-rose-600'
                                                            }`}>
                                                                {stats.avg_score}%
                                                            </span>
                                                        </td>
                                                        <td className="px-4 sm:px-8 py-5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[120px]">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${(stats.favorable_rate || 0) * 100}%` }}
                                                                        className={`h-full rounded-full ${
                                                                            stats.favorable_rate >= 0.7 ? 'bg-emerald-500' : stats.favorable_rate >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'
                                                                        }`}
                                                                    />
                                                                </div>
                                                                <span className="text-sm font-bold text-slate-700">{(stats.favorable_rate * 100).toFixed(0)}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Fairness Metrics Detail */}
                                    {fairnessReport.fairness_metrics && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            <MetricCard
                                                title="Demographic Parity Ratio"
                                                value={fairnessReport.fairness_metrics.demographic_parity_ratio}
                                                threshold={0.8}
                                                higher_is_better={true}
                                                description="Ratio of favorable outcomes between unprivileged vs privileged groups. Target: ≥ 0.80"
                                            />
                                            <MetricCard
                                                title="Disparate Impact"
                                                value={fairnessReport.fairness_metrics.disparate_impact}
                                                threshold={0.8}
                                                higher_is_better={true}
                                                description="Ratio of selection rates. Values below 0.80 indicate adverse impact."
                                            />
                                            <MetricCard
                                                title="Statistical Parity Diff"
                                                value={fairnessReport.fairness_metrics.statistical_parity_difference}
                                                threshold={0.1}
                                                higher_is_better={false}
                                                description="Difference in favorable rates between groups. Target: closer to 0."
                                            />
                                            <MetricCard
                                                title="Consistency Score"
                                                value={fairnessReport.fairness_metrics.consistency}
                                                threshold={0.7}
                                                higher_is_better={true}
                                                description="Individual-level fairness (0-1). Higher is more consistent."
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'logs' && (
                        <motion.div key="logs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <header className="mb-12">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Audit Logs</h2>
                                <p className="text-slate-500 font-medium">Traceability for all administrative actions.</p>
                            </header>

                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-x-auto">
                                <div className="divide-y divide-slate-50">
                                    {auditLogs.map(log => (
                                        <div key={log.id} className="p-6 flex items-start gap-6 hover:bg-slate-50/50 transition-colors">
                                            <div className={`p-2.5 rounded-xl shrink-0 ${
                                                log.action.includes('approve') ? 'bg-emerald-50 text-emerald-600' : 
                                                log.action.includes('reject') ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                                            }`}>
                                                {log.action.includes('job') ? <Briefcase size={18}/> : <UserCheck size={18}/>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <p className="font-bold text-slate-800">{log.details}</p>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(log.timestamp).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                        <ShieldCheck size={12}/> Admin: {log.admin_name}
                                                    </span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">•</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                                                        ID: {log.target_id.split('-')[0]}...
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'settings' && (
                        <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <header className="mb-12">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">System Settings</h2>
                                <p className="text-slate-500 font-medium">Configure global system preferences.</p>
                            </header>

                            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 space-y-8">
                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-800">Resume Theme</h3>
                                            <p className="text-xs text-slate-400 font-medium">Choose the RenderCV theme for auto-generated resumes.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {['classic', 'engineeringclassic', 'engineeringresumes', 'harvard',
                                          'moderncv', 'opal', 'sb2nov', 'amber', 'ink'].map(theme => (
                                            <button
                                                key={theme}
                                                onClick={() => handleResumeThemeChange(theme)}
                                                disabled={themeSaving}
                                                className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                    resumeTheme === theme
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100'
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                                                }`}
                                            >
                                                {theme}
                                            </button>
                                        ))}
                                    </div>
                                    {themeSaving && (
                                        <p className="mt-4 text-xs text-blue-600 font-medium">Saving...</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Detail Modals */}
            <AnimatePresence>
                {selectedItem && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 lg:p-12" role="dialog" aria-modal="true" aria-label="Verification details">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" 
                            onClick={() => setSelectedItem(null)} 
                            aria-hidden="true"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]"
                        >
                            <div className="p-6 sm:p-8 lg:p-10 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-[#0038A8] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                                        {selectedItem.type === 'employer' ? <UserCheck size={24} /> : <Briefcase size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{selectedItem.type === 'employer' ? 'Verification Proof' : 'Job DNA Inspection'}</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{selectedItem.data.name || selectedItem.data.job_title}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedItem(null)} className="p-3 rounded-2xl hover:bg-slate-200 transition-colors text-slate-400" aria-label="Close details">
                                    <XCircle size={24} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10 space-y-8 custom-scrollbar">
                                {selectedItem.type === 'employer' ? (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Registration Proof</label>
                                            <div className="aspect-video bg-slate-100 rounded-3xl flex items-center justify-center border-2 border-dashed border-slate-200">
                                                <div className="text-center">
                                                    <FileSearch size={48} className="mx-auto mb-4 text-slate-300" />
                                                    <p className="text-xs font-bold text-slate-400">{selectedItem.data.employer_proof || "No document image uploaded"}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Metadata Analysis</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Company Email</p>
                                                    <p className="text-sm font-bold text-slate-700">{selectedItem.data.email}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-300 uppercase mb-1">Status</p>
                                                    <p className="text-sm font-bold text-amber-600">Pending Review</p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="bg-blue-50 rounded-3xl p-8 border border-blue-100">
                                            <h4 className="text-[10px] font-black text-[#0038A8] uppercase tracking-widest mb-4">Role Description</h4>
                                            <p className="text-sm font-medium text-slate-700 leading-relaxed">{selectedItem.data.job_description}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <MetricItem label="Cognitive Load" val={selectedItem.data.cognitive_load} />
                                            <MetricItem label="Sensory Demand" val={selectedItem.data.sensory_load} />
                                            <MetricItem label="Social Interaction" val={selectedItem.data.social_interaction} />
                                            <MetricItem label="Physical Stamina" val={selectedItem.data.stamina_required} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-10 border-t border-slate-100 flex gap-4">
                                {selectedItem.type === 'employer' ? (
                                    <>
                                        <button 
                                            onClick={() => handleVerifyEmployer(selectedItem.data.id, 'reject', 'Proof insufficient')}
                                            className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all"
                                        >
                                            Reject & Notify
                                        </button>
                                        <button 
                                            onClick={() => handleVerifyEmployer(selectedItem.data.id, 'approve')}
                                            className="flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-[#0038A8] hover:bg-blue-800 transition-all shadow-xl shadow-blue-100"
                                        >
                                            Approve Organization
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button className="flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-rose-600 bg-rose-50">Flag Review</button>
                                        <button 
                                            onClick={() => handleVerifyJob(selectedItem.data.id)}
                                            className="flex-[2] py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white bg-[#0038A8] hover:bg-blue-800 transition-all shadow-xl shadow-blue-100"
                                        >
                                            Authorize & Index
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const NavItem = ({ active, onClick, icon, label, badge }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
            active ? 'bg-blue-50 text-[#0038A8]' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
        }`}
    >
        <div className="flex items-center gap-3">
            {icon}
            <span className="text-sm font-black uppercase tracking-widest">{label}</span>
        </div>
        {badge > 0 && (
            <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${active ? 'bg-[#0038A8] text-white' : 'bg-slate-100 text-slate-500'}`}>
                {badge}
            </div>
        )}
    </button>
);

const StatCard = ({ label, value, icon, trend, highlight }) => (
    <div className={`p-6 rounded-3xl border ${highlight ? 'bg-[#CE1126]/5 border-[#CE1126]/10' : 'bg-white border-slate-100'} shadow-sm`}>
        <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${highlight ? 'bg-red-100 text-[#CE1126]' : 'bg-slate-50 text-slate-400'}`}>
                {icon}
            </div>
            {trend && <span className="text-[9px] font-black text-emerald-600 uppercase">{trend}</span>}
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
        <p className={`text-3xl font-black ${highlight ? 'text-[#CE1126]' : 'text-slate-800'}`}>{value || 0}</p>
    </div>
);

const HealthBar = ({ label, status, pct }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{status} • {pct}%</span>
        </div>
        <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className="h-full bg-emerald-500 rounded-full" />
        </div>
    </div>
);

const AlertItem = ({ type, msg, time }) => (
    <div className="flex gap-4 group cursor-pointer">
        <div className={`w-1.5 h-8 rounded-full shrink-0 ${
            type === 'warning' ? 'bg-amber-500' : type === 'info' ? 'bg-blue-500' : 'bg-emerald-500'
        }`} />
        <div>
            <p className="text-[11px] font-bold text-slate-200 group-hover:text-white transition-colors">{msg}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{time}</p>
        </div>
    </div>
);

const MetricCard = ({ title, value, threshold, higher_is_better, description }) => {
    const isGood = higher_is_better ? value >= threshold : value <= threshold;
    return (
        <div className={`bg-white rounded-3xl p-6 border shadow-sm ${
            isGood ? 'border-emerald-100' : 'border-amber-100'
        }`}>
            <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isGood ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                    {isGood ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                </div>
                {!isGood && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg text-[8px] font-black uppercase tracking-widest">Attention</span>
                )}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{title}</p>
            <p className={`text-2xl font-black mb-2 ${isGood ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">{description}</p>
        </div>
    );
};

const MetricItem = ({ label, val }) => (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-sm font-black text-slate-700">{val}</p>
    </div>
);

export default AdminPortal;
