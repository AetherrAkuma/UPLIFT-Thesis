import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Briefcase, TrendingUp, User, Mail, Globe, Clock, 
    CheckCircle2, XCircle, X, Eye, Edit3, Trash2, Plus, Shield, Menu,
    FileText, Building2, ChevronRight, LayoutDashboard, Sparkles,
    ShieldCheck, MessageSquare, Zap, AlertCircle, Brain, Ear, Send
} from 'lucide-react';
import PDFViewer from '../components/PDFViewer';

const EmployerPortal = () => {
    const navigate = useNavigate();
    const { user, token, logout, API_BASE_URL } = useAuth();
    const toast = useToast();
    const [isEditingRejection, setIsEditingRejection] = useState(false);
    const [view, setView] = useState('dashboard'); // dashboard, jobs, applicants, profile
    const [stats, setStats] = useState({ job_count: 0, app_count: 0, fulfilled_count: 0 });
    const [jobs, setJobs] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPostModal, setShowPostModal] = useState(false);
    const [statusModal, setStatusModal] = useState(null); // { job_id, current_status }
    const [actionModal, setActionModal] = useState(null);
    const [mobileSidebar, setMobileSidebar] = useState(false); // { app_id, current_status }
    const [editingJobId, setEditingJobId] = useState(null);
    const [candidateProfile, setCandidateProfile] = useState(null);
    const [newJob, setNewJob] = useState({
        job_title: '',
        job_description: '',
        physical_requirements: '',
        employer_type: 'Private',
        salary_range: '',
        benefits: '',
        job_type: 'Full-time',
        location: '',
        accessibility_features: '',
        work_environment: 'Indoor',
        work_tempo: 'Moderate',
        structured_skills: '',
        // AI Matching Fields
        cognitive_load: 'Medium',
        sensory_load: 'Low',
        social_interaction: 'Moderate',
        has_flexibility: false,
        remote_friendly: false,
        visual_demand: 'Low',
        auditory_demand: 'Low',
        fine_motor_demand: 'Medium',
        physical_demand: 'Medium'
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [sRes, jRes, aRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/employer/stats`, { headers: { 'Authorization': `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/employer/jobs`, { headers: { 'Authorization': `Bearer ${token}` } }),
                axios.get(`${API_BASE_URL}/employer/applications`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            setStats(sRes.data);
            setJobs(jRes.data.jobs);
            setApplications(aRes.data.applications);
        } catch (err) {
            console.error("Failed to fetch employer data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            setTimeout(() => fetchData(), 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, token]);

    const handleEditClick = (job) => {
        setNewJob({
            job_title: job.job_title || '',
            job_description: job.job_description || '',
            physical_requirements: job.physical_requirements || '',
            employer_type: job.employer_type || 'Private',
            salary_range: job.salary_range || '',
            benefits: job.benefits || '',
            job_type: job.job_type || 'Full-time',
            location: job.location || '',
            accessibility_features: job.accessibility_features || '',
            work_environment: job.work_environment || 'Indoor',
            work_tempo: job.work_tempo || 'Moderate',
            structured_skills: job.structured_skills || '',
            cognitive_load: job.cognitive_load || 'Medium',
            sensory_load: job.sensory_load || 'Low',
            social_interaction: job.social_interaction || 'Moderate',
            has_flexibility: job.has_flexibility === 1 || job.has_flexibility === true,
            remote_friendly: job.remote_friendly === 1 || job.remote_friendly === true,
            visual_demand: job.visual_demand || 'Low',
            auditory_demand: job.auditory_demand || 'Low',
            fine_motor_demand: job.fine_motor_demand || 'Medium',
            physical_demand: job.physical_demand || 'Medium'
        });
        setEditingJobId(job.id);
        setShowPostModal(true);
    };

    const handleDeleteJob = async (jobId) => {
        if (!window.confirm("Are you sure you want to delete this job listing? This action cannot be undone.")) return;
        try {
            await axios.delete(`${API_BASE_URL}/employer/jobs/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success("Job listing successfully deleted");
            fetchData();
        } catch (err) {
            toast.error("Failed to delete job: " + (err.response?.data?.detail || "Unknown error"));
        }
    };

    const handleViewCandidateProfile = async (pwdId) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/employer/candidates/${pwdId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setCandidateProfile(res.data);
        } catch (err) {
            console.error("Failed to fetch candidate profile", err);
            toast.error("Failed to fetch candidate profile");
        }
    };

    const handleCreateJob = async (e) => {
        e.preventDefault();
        try {
            if (editingJobId) {
                await axios.put(`${API_BASE_URL}/employer/jobs/${editingJobId}`, newJob, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                toast.success("Job updated successfully!");
            } else {
                await axios.post(`${API_BASE_URL}/employer/submit-job`, newJob, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                toast.success("Job listing created successfully!");
            }
            setShowPostModal(false);
            setEditingJobId(null);
            setNewJob({
                job_title: '', job_description: '', physical_requirements: '',
                employer_type: 'Private', salary_range: '', benefits: '',
                job_type: 'Full-time', location: '', accessibility_features: '',
                work_environment: 'Indoor', work_tempo: 'Moderate',
                structured_skills: '',
                cognitive_load: 'Medium', sensory_load: 'Low',
                social_interaction: 'Moderate', has_flexibility: false,
                remote_friendly: false, visual_demand: 'Low', auditory_demand: 'Low',
                fine_motor_demand: 'Medium', physical_demand: 'Medium'
            });
            fetchData();
        } catch (err) {
            toast.error((editingJobId ? "Failed to update job: " : "Failed to create job: ") + (err.response?.data?.detail || "Unknown error"));
        }
    };

    const handleUpdateJobStatus = async (jobId, status, reason) => {
        try {
            await axios.patch(`${API_BASE_URL}/employer/jobs/${jobId}/status`, { status, reason }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success(`Job status updated to ${status}`);
            setStatusModal(null);
            fetchData();
        } catch (err) {
            console.error("Failed to update status", err);
            toast.error("Failed to update status");
        }
    };

    const handleActionApplication = async (appId, status, notes) => {
        try {
            await axios.patch(`${API_BASE_URL}/employer/applications/${appId}`, { status, notes }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success(`Application successfully ${status.toLowerCase()}ed`);
            setActionModal(null);
            fetchData();
        } catch (err) {
            console.error("Failed to process application", err);
            toast.error("Failed to process application");
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex">
            {/* Sidebar Navigation */}
            {/* Mobile top-nav */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                <button onClick={() => setMobileSidebar(!mobileSidebar)} className="p-2 rounded-xl hover:bg-slate-100" aria-label={mobileSidebar ? "Close navigation menu" : "Open navigation menu"}>
                    <Menu size={22} aria-hidden="true" />
                </button>
                <span className="font-black text-sm tracking-tighter text-slate-900">UPLIFT <span className="text-[#0038A8]">PRO</span></span>
            </div>

            {/* Mobile sidebar overlay */}
            {mobileSidebar && (
                <div className="lg:hidden fixed inset-0 z-30">
                    <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileSidebar(false)} aria-hidden="true" />
                    <div className="absolute left-0 top-0 bottom-0 w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto shadow-2xl" role="navigation" aria-label="Employer navigation">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#0038A8] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                                    <Building2 size={24} />
                                </div>
                                <h1 className="text-xl font-black text-slate-800 tracking-tight">UPLIFT <span className="text-[#0038A8]">PRO</span></h1>
                            </div>
                            <button onClick={() => setMobileSidebar(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400" aria-label="Close navigation menu">
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <nav className="flex-1 p-8 space-y-2">
                            <NavButton active={view === 'dashboard' && user?.status !== 'pending' && user?.status !== 'rejected'} onClick={() => { if (user?.status !== 'pending' && user?.status !== 'rejected') { setView('dashboard'); setMobileSidebar(false); } }} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
                            <NavButton active={view === 'jobs' && user?.status !== 'pending' && user?.status !== 'rejected'} onClick={() => { if (user?.status !== 'pending' && user?.status !== 'rejected') { setView('jobs'); setMobileSidebar(false); } }} icon={<Briefcase size={20}/>} label="Job Management" count={stats.job_count} />
                            <NavButton active={view === 'applicants' && user?.status !== 'pending' && user?.status !== 'rejected'} onClick={() => { if (user?.status !== 'pending' && user?.status !== 'rejected') { setView('applicants'); setMobileSidebar(false); } }} icon={<Users size={20}/>} label="Candidates" count={applications.filter(a => a.status === 'Pending').length} />
                            <NavButton active={view === 'profile' || user?.status === 'pending' || user?.status === 'rejected'} onClick={() => { setView('profile'); setMobileSidebar(false); }} icon={<User size={20}/>} label={user?.status === 'pending' || user?.status === 'rejected' ? "Verification" : "Account Settings"} />
                        </nav>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 mt-auto">
                            <button onClick={handleLogout} className="w-full py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all">Sign Out</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop Sidebar */}
            <div className="hidden lg:flex w-80 bg-white border-r border-slate-200 p-8 flex-col fixed h-full z-40" role="navigation" aria-label="Employer navigation">
                <div className="mb-12">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-[#0038A8] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                            <Building2 size={24} />
                        </div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">UPLIFT <span className="text-[#0038A8]">PRO</span></h1>
                    </div>
                </div>

                <nav className="space-y-2 flex-1">
                    <NavButton active={view === 'dashboard' && user?.status !== 'pending' && user?.status !== 'rejected'} onClick={() => user?.status !== 'pending' && user?.status !== 'rejected' && setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
                    <NavButton active={view === 'jobs' && user?.status !== 'pending' && user?.status !== 'rejected'} onClick={() => user?.status !== 'pending' && user?.status !== 'rejected' && setView('jobs')} icon={<Briefcase size={20}/>} label="Job Management" count={stats.job_count} />
                    <NavButton active={view === 'applicants' && user?.status !== 'pending' && user?.status !== 'rejected'} onClick={() => user?.status !== 'pending' && user?.status !== 'rejected' && setView('applicants')} icon={<Users size={20}/>} label="Candidates" count={applications.filter(a => a.status === 'Pending').length} />
                    <NavButton active={view === 'profile' || user?.status === 'pending' || user?.status === 'rejected'} onClick={() => setView('profile')} icon={<User size={20}/>} label={user?.status === 'pending' || user?.status === 'rejected' ? "Verification" : "Account Settings"} />
                </nav>

                <div className="mt-auto p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-200">
                            <Building2 size={20} className="text-slate-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employer</p>
                            <p className="text-xs font-bold text-slate-700 truncate max-w-[180px]">{user?.name}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all">Sign Out</button>
                </div>
            </div>

            {/* Main Content */}
            <main className="lg:ml-80 flex-1 p-6 sm:p-8 lg:p-12 pt-20 lg:pt-0">
                <AnimatePresence mode="wait">
                    {user?.status === 'rejected' ? (
                        isEditingRejection ? (
                            <VerificationView 
                                user={user} 
                                initialData={user?.verification_data} 
                                isResubmission={true} 
                                onCancel={() => setIsEditingRejection(false)} 
                            />
                        ) : (
                            <RejectionView 
                                user={user} 
                                onModify={() => setIsEditingRejection(true)} 
                            />
                        )
                    ) : user?.status === 'pending' ? (
                        user?.verification_data && Object.keys(user.verification_data).length > 0 ? (
                            <PendingView user={user} />
                        ) : (
                            <VerificationView user={user} />
                        )
                    ) : (
                        <>
                            {loading ? (
                                <div className="flex items-center justify-center min-h-[400px] w-full">
                                    <motion.div 
                                        animate={{ rotate: 360 }} 
                                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }} 
                                        className="w-12 h-12 border-4 border-[#0038A8] border-t-transparent rounded-full" 
                                    />
                                </div>
                            ) : (
                                <>
                                    {view === 'dashboard' && <DashboardView stats={stats} jobs={jobs} onPostJob={() => { setEditingJobId(null); setShowPostModal(true); }} onViewAllJobs={() => setView('jobs')} />}
                                    {view === 'jobs' && <JobsView jobs={jobs} onPostJob={() => { setEditingJobId(null); setShowPostModal(true); }} onManageStatus={setStatusModal} onEditJob={handleEditClick} onDeleteJob={handleDeleteJob} />}
                                    {view === 'applicants' && <ApplicantsView apps={applications} onAction={setActionModal} onViewCandidateProfile={handleViewCandidateProfile} token={token} API_BASE_URL={API_BASE_URL} />}
                                    {view === 'profile' && <ProfileView user={user} token={token} API_BASE_URL={API_BASE_URL} onProfileUpdate={() => window.location.reload()} />}
                                </>
                            )}
                        </>
                    )}
                </AnimatePresence>
            </main>

            {/* Modals */}
            <AnimatePresence>
                {showPostModal && <PostJobModal onClose={() => { setShowPostModal(false); setEditingJobId(null); }} onSubmit={handleCreateJob} formData={newJob} setFormData={setNewJob} isEdit={!!editingJobId} />}
                {statusModal && <StatusModal job={statusModal} onClose={() => setStatusModal(null)} onConfirm={handleUpdateJobStatus} />}
                {actionModal && <ActionModal app={actionModal} onClose={() => setActionModal(null)} onConfirm={handleActionApplication} />}
                {candidateProfile && <CandidateProfileModal candidate={candidateProfile} onClose={() => setCandidateProfile(null)} token={token} API_BASE_URL={API_BASE_URL} />}
            </AnimatePresence>
        </div>
    );
};

const NavButton = ({ active, onClick, icon, label, count }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${active ? 'bg-blue-50 text-[#0038A8] border border-blue-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
    >
        <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-[#0038A8] text-white shadow-lg shadow-blue-100' : 'bg-white border border-slate-100'}`}>
                {icon}
            </div>
            <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
        </div>
        {count !== undefined && count > 0 && (
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${active ? 'bg-[#0038A8] text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
        )}
    </button>
);

const DashboardView = ({ stats, jobs, onPostJob, onViewAllJobs }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12">
        <header className="flex justify-between items-end">
            <div>
                <h2 className="text-4xl font-black text-slate-900 mb-2">Portfolio Overview</h2>
                <p className="text-slate-500">Global metrics and recent activity across your inclusive workspace.</p>
            </div>
            <button onClick={onPostJob} className="flex items-center gap-3 px-8 py-4 bg-[#0038A8] hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:-translate-y-1">
                <Plus size={18} /> Create New Posting
            </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StatCard label="Live Opportunities" value={stats.job_count} trend="+12% this month" icon={<Briefcase size={20}/>} color="blue" />
            <StatCard label="Active Applicants" value={stats.app_count} trend="+48 new today" icon={<Users size={20}/>} color="indigo" />
            <StatCard label="Fulfilled Roles" value={stats.fulfilled_count} trend="92% success rate" icon={<CheckCircle2 size={20}/>} color="emerald" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-white rounded-[3rem] p-6 md:p-10 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-slate-800">Recent Postings</h3>
                    <button onClick={onViewAllJobs} className="text-[10px] font-black uppercase tracking-widest text-[#0038A8] hover:underline">View All</button>
                </div>
                <div className="space-y-4">
                    {jobs.slice(0, 3).map(job => (
                        <div key={job.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group hover:border-blue-200 transition-all">
                            <div className="flex items-center gap-6">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#0038A8] shadow-sm border border-slate-100 group-hover:bg-[#0038A8] group-hover:text-white transition-all">
                                    <Briefcase size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">{job.job_title}</h4>
                                    <p className="text-xs text-slate-400">{job.location} • {job.job_type}</p>
                                </div>
                            </div>
                            <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${job.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                {job.status}
                            </span>
                        </div>
                    ))}
                    {jobs.length === 0 && <p className="text-center py-10 text-slate-400 font-medium italic">No recent postings found.</p>}
                </div>
            </div>

            <div className="lg:col-span-4 bg-slate-900 rounded-[3rem] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                    <TrendingUp size={200} />
                </div>
                <h3 className="text-xl font-bold mb-6 relative z-10">System Health</h3>
                <div className="space-y-6 relative z-10">
                    <HealthBar label="Database Uptime" value={99.9} />
                    <HealthBar label="AI Matching Speed" value={85} />
                    <HealthBar label="Candidate Sat." value={94} />
                    <div className="pt-6 border-t border-white/10 mt-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Live Status</p>
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> All Systems Nominal
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </motion.div>
);

const StatCard = ({ label, value, trend, icon, color }) => (
    <div className="bg-white p-6 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm group hover:border-blue-500 transition-all">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all group-hover:scale-110 ${color === 'blue' ? 'bg-blue-50 text-[#0038A8]' : color === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {icon}
        </div>
        <p className="text-5xl font-black text-slate-900 mb-2 tracking-tighter">{value}</p>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">{label}</p>
        <p className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
            <TrendingUp size={12} /> {trend}
        </p>
    </div>
);

const HealthBar = ({ label, value }) => (
    <div className="space-y-2">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
            <span>{label}</span>
            <span>{value}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
        </div>
    </div>
);

const JobsView = ({ jobs, onPostJob, onManageStatus, onEditJob, onDeleteJob }) => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
        <header className="flex justify-between items-end mb-8">
            <div>
                <h2 className="text-4xl font-black text-slate-900 mb-2">Job Management</h2>
                <p className="text-slate-500">Control your active listings and analyze performance.</p>
            </div>
            <button onClick={onPostJob} className="flex items-center gap-3 px-8 py-4 bg-[#0038A8] hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 transition-all">
                <Plus size={18} /> New Posting
            </button>
        </header>

        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
                <thead>
                    <tr className="border-b border-slate-50">
                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Position & Info</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Salary</th>
                        <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {jobs.map(job => (
                        <tr key={job.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-10 py-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-[#0038A8] border border-slate-100 group-hover:bg-white transition-all">
                                        <Briefcase size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{job.job_title}</p>
                                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">{job.job_type} • {job.location}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-10 py-8">
                                <button 
                                    onClick={() => onManageStatus(job)}
                                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${
                                        job.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 
                                        job.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                        'bg-rose-50 text-rose-600 border-rose-100'
                                    }`}
                                >
                                    {job.status}
                                    <ChevronRight size={12} className="rotate-90" />
                                </button>
                                {job.status_reason && <p className="text-[9px] text-slate-400 mt-2 italic">"{job.status_reason}"</p>}
                            </td>
                            <td className="px-10 py-8">
                                <p className="text-sm font-bold text-slate-600">{job.salary_range || 'Negotiable'}</p>
                            </td>
                            <td className="px-10 py-8">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => onEditJob(job)} className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:bg-blue-50 hover:text-[#0038A8] transition-all" aria-label="Edit job"><Edit3 size={16} aria-hidden="true"/></button>
                                    <button onClick={() => onDeleteJob(job.id)} className="p-2.5 bg-slate-50 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all" aria-label="Delete job"><Trash2 size={16} aria-hidden="true"/></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                            {jobs.length === 0 && <tr><td colSpan="4" className="text-center py-20 text-slate-400 font-medium italic">No jobs found. Click "New Posting" to start.</td></tr>}
                </tbody>
            </table>
        </div>
    </motion.div>
);

const ApplicantsView = ({ apps, onAction, onViewCandidateProfile, token, API_BASE_URL }) => {
    const [resumePreview, setResumePreview] = useState(null);
    const [fetchingResumeId, setFetchingResumeId] = useState(null);

    const handleViewResume = async (app) => {
        if (app.resume_data) {
            setResumePreview(app.resume_data);
            return;
        }
        setFetchingResumeId(app.id);
        try {
            const res = await axios.get(`${API_BASE_URL}/employer/candidates/${app.user_id}/resume`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data?.resume_base64) {
                setResumePreview(res.data.resume_base64);
            } else {
                alert('Unable to render resume at this time.');
            }
        } catch (err) {
            console.error('Failed to fetch candidate resume', err);
            alert(err.response?.data?.detail || 'Resume could not be generated for this candidate.');
        } finally {
            setFetchingResumeId(null);
        }
    };

    return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
        <header className="mb-12">
            <h2 className="text-4xl font-black text-slate-900 mb-2">Candidate Pipeline</h2>
            <p className="text-slate-500">Review and manage PWD applicants with specialized AI context.</p>
        </header>

        <div className="grid grid-cols-1 gap-6">
            {apps.map(app => (
                <div key={app.id} className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between gap-8 group hover:border-blue-500 transition-all">
                    <div className="flex gap-8 flex-1">
                        <div className="w-20 h-20 bg-slate-50 rounded-3xl overflow-hidden border border-slate-100 shrink-0">
                            <img src={`https://ui-avatars.com/api/?name=${app.applicant_name}&background=0038A8&color=fff&size=128`} className="w-full h-full object-cover" />
                        </div>
                        <div className="space-y-4 flex-1">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                    {app.applicant_name}
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                        app.status === 'Pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                        app.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                        'bg-rose-50 text-rose-600 border-rose-100'
                                    }`}>
                                        {app.status}
                                    </span>
                                </h3>
                                <p className="text-sm font-medium text-slate-400 mt-1">Applied for <strong>{app.job_title}</strong></p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {JSON.parse(app.disabilities || '[]').map((d, i) => (
                                    <span key={i} className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-500 border border-slate-100">{d}</span>
                                ))}
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed italic line-clamp-2">"{app.summary}"</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col justify-center gap-4 w-full md:w-64 border-l border-slate-50 pl-8">
                        {app.status === 'Pending' ? (
                            <>
                                <button 
                                    onClick={() => onAction({ ...app, action: 'Approved' })}
                                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 size={16} /> Approve Candidate
                                </button>
                                <button 
                                    onClick={() => onAction({ ...app, action: 'Rejected' })}
                                    className="w-full py-4 bg-white border-2 border-slate-100 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 hover:border-rose-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <X size={16} /> Decline
                                </button>
                            </>
                        ) : (
                            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Reviewer Notes</p>
                                <p className="text-xs text-slate-600 font-medium italic">"{app.employer_notes || 'No notes added.'}"</p>
                            </div>
                        )}
                        <button 
                            onClick={() => handleViewResume(app)}
                            disabled={fetchingResumeId === app.id}
                            className="text-[10px] font-black uppercase tracking-widest text-[#0038A8] hover:underline text-center flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50/60 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                        >
                            <FileText size={12}/>
                            {fetchingResumeId === app.id ? 'Rendering Resume...' : (app.resume_data ? 'View Resume' : '📄 Render ATS Resume')}
                        </button>
                        <button onClick={() => onViewCandidateProfile(app.user_id)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:underline text-center">View Full Profile</button>
                    </div>
                </div>
            ))}
            {apps.length === 0 && <p className="text-center py-20 text-slate-400 font-medium italic">No applications received yet.</p>}
        </div>

        {/* Resume Preview Modal */}
        {resumePreview && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 lg:p-12">
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setResumePreview(null)} />
                <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="p-6 sm:p-8 lg:p-10 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                                <FileText size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Applicant Resume</h3>
                                <p className="text-xs font-bold text-slate-400">Compiled dynamically via RenderCV & Typst</p>
                            </div>
                        </div>
                        <button onClick={() => setResumePreview(null)} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900 flex flex-col">
                        <PDFViewer 
                            pdfData={resumePreview}
                            fileName="Applicant_Resume.pdf"
                            className="w-full flex-1 min-h-[550px]"
                        />
                    </div>
                </div>
            </div>
        )}
    </motion.div>
);
};

const ProfileView = ({ user, token, API_BASE_URL, onProfileUpdate }) => {
    const toast = useToast();
    const [name, setName] = useState(user?.name || '');
    const [summary, setSummary] = useState(user?.summary || '');
    const [saving, setSaving] = useState(false);

    // Password Settings States
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordChanging, setPasswordChanging] = useState(false);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.warning("Company name cannot be empty.");
            return;
        }
        setSaving(true);
        try {
            await axios.put(`${API_BASE_URL}/employer/profile`, { name, summary }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success("Profile updated successfully!");
            onProfileUpdate();
        } catch (err) {
            toast.error("Failed to update profile: " + (err.response?.data?.detail || "Unknown error"));
        } finally {
            setSaving(false);
        }
    };

    const handleChangePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!oldPassword || !newPassword) {
            toast.warning("Please fill out all fields.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.warning("New passwords do not match!");
            return;
        }
        setPasswordChanging(true);
        try {
            await axios.post(`${API_BASE_URL}/auth/change-password`, {
                old_password: oldPassword,
                new_password: newPassword
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success("Password changed successfully!");
            setShowPasswordModal(false);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            toast.error("Failed to change password: " + (err.response?.data?.detail || "Incorrect current password"));
        } finally {
            setPasswordChanging(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm("WARNING: Are you sure you want to permanently delete your employer account? This action cannot be undone and you will lose all job listings, applications, and account access.")) return;
        try {
            await axios.delete(`${API_BASE_URL}/auth/delete-account`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success("Account successfully deleted.");
            window.location.reload();
        } catch (err) {
            console.error("Failed to delete account", err);
            toast.error("Failed to delete account");
        }
    };

    return (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="max-w-4xl">
            <header className="mb-12">
                <h2 className="text-4xl font-black text-slate-900 mb-2">Account Hub</h2>
                <p className="text-slate-500">Manage your organization's presence and administrative settings.</p>
            </header>

            <form onSubmit={handleSaveProfile} className="bg-white rounded-[3rem] p-6 md:p-12 border border-slate-100 shadow-sm space-y-12">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-12">
                    <div className="w-32 h-32 bg-slate-100 rounded-[3rem] border-4 border-white shadow-xl flex items-center justify-center relative group cursor-pointer shrink-0">
                        <Building2 size={48} className="text-slate-300" />
                        <div className="absolute inset-0 bg-black/40 rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">Company</div>
                    </div>
                    <div className="space-y-4 flex-1 w-full">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Company Name</label>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all shadow-inner"
                            />
                        </div>
                        <div className="flex gap-6">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Mail size={16}/> {user?.email}</div>
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Building2 size={16}/> Professional Services</div>
                        </div>
                    </div>
                    <button type="submit" disabled={saving} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50">
                        {saving ? "Saving..." : "Save Profile"}
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-8 pt-12 border-t border-slate-50">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Company Bio</label>
                        <textarea 
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-transparent rounded-[2rem] p-8 text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all min-h-[150px] text-sm leading-relaxed"
                            placeholder="Tell us about your company's mission..."
                        />
                    </div>
                    <div className="space-y-6">
                        <div className="p-8 bg-blue-50 rounded-[2.5rem] border border-blue-100">
                            <h4 className="text-xs font-black text-[#0038A8] uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Shield size={16} /> Security Settings
                            </h4>
                            <button type="button" onClick={() => setShowPasswordModal(true)} className="w-full py-4 bg-white border border-blue-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#0038A8] hover:bg-[#0038A8] hover:text-white transition-all">Change Password</button>
                        </div>
                        <div className="p-8 bg-rose-50 rounded-[2.5rem] border border-rose-100">
                            <h4 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Trash2 size={16} /> Danger Zone
                            </h4>
                            <button type="button" onClick={handleDeleteAccount} className="w-full py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all">Delete Account</button>
                        </div>
                    </div>
                </div>
            </form>

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Change password">
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[3rem] p-6 md:p-10 w-full max-w-lg shadow-2xl">
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Change Password</h3>
                        <p className="text-sm text-slate-400 mb-8">Ensure your account uses a secure password.</p>
                        
                        <form onSubmit={handleChangePasswordSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Current Password</label>
                                <input 
                                    type="password" 
                                    value={oldPassword} 
                                    onChange={e => setOldPassword(e.target.value)} 
                                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">New Password</label>
                                <input 
                                    type="password" 
                                    value={newPassword} 
                                    onChange={e => setNewPassword(e.target.value)} 
                                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Confirm New Password</label>
                                <input 
                                    type="password" 
                                    value={confirmPassword} 
                                    onChange={e => setConfirmPassword(e.target.value)} 
                                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all shadow-inner"
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-2xl">Cancel</button>
                                <button type="submit" disabled={passwordChanging} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50">
                                    {passwordChanging ? "Updating..." : "Change Password"}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

// Improved Modal Component for Job Posting
const PostJobModal = ({ onClose, onSubmit, formData, setFormData, isEdit = false }) => {
    const { token, API_BASE_URL } = useAuth();
    const [step, setStep] = useState(1);
    const [analyzing, setAnalyzing] = useState(false);
    const [clarity, setClarity] = useState(null);
    
    const accessibilityOptions = [
        "Wheelchair Accessible", "Screen Reader Optimized", "Sign Language Support", 
        "Quiet Workspace", "Flexible Breaks", "Ergonomic Furniture", 
        "Assistive Tech Support", "Mental Health Support", "Service Animal Friendly"
    ];

    const toggleAccessibility = (opt) => {
        const current = formData.accessibility_features.split(',').map(s => s.trim()).filter(s => s);
        if (current.includes(opt)) {
            setFormData({...formData, accessibility_features: current.filter(s => s !== opt).join(', ')});
        } else {
            setFormData({...formData, accessibility_features: [...current, opt].join(', ')});
        }
    };

    const handleAutoAnalyze = async () => {
        if (!formData.job_description?.trim()) return;
        setAnalyzing(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/employer/ai-analyze-description`, {
                job_title: formData.job_title || '',
                job_description: formData.job_description,
                work_environment: formData.work_environment || 'Indoor'
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setClarity(res.data);
            const updates = {};
            if (res.data.skills && res.data.skills.length > 0 && !formData.structured_skills) {
                updates.structured_skills = res.data.skills.join(', ');
            }
            if (res.data.suggested_posture === 'Mostly Seated') {
                updates.physical_demand = 'Low';
            } else if (res.data.suggested_posture === 'Physical Handling') {
                updates.physical_demand = 'High';
            }
            if (res.data.suggested_communication === 'Text-First') {
                updates.auditory_demand = 'Low';
            }
            if (res.data.suggested_pace === 'Self-Paced') {
                updates.work_tempo = 'Slow';
                updates.has_flexibility = true;
            }
            if (Object.keys(updates).length > 0) {
                setFormData(prev => ({ ...prev, ...updates }));
            }
        } catch (e) {
            console.error("Auto analyze failed", e);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleApplySnippet = () => {
        if (!clarity?.suggested_snippet) return;
        const current = formData.job_description ? formData.job_description.trim() + "\n\n" : "";
        const updated = current + clarity.suggested_snippet;
        setFormData(prev => ({
            ...prev,
            job_description: updated
        }));
        setClarity(prev => ({
            ...prev,
            clarity_score: Math.min(100, (prev.clarity_score || 70) + 25),
            clarity_label: "🌟 High Match Precision (90%+)",
            tips: [],
            suggested_snippet: null,
            signals: { skills: true, posture: true, communication: true, environment: true }
        }));
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md overflow-y-auto" role="dialog" aria-modal="true" aria-label={isEdit ? "Update job posting" : "Create new job posting"}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 30 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                className="bg-white rounded-[4rem] shadow-2xl w-full max-w-6xl my-12 overflow-hidden flex flex-col md:flex-row h-[85vh]"
            >
                {/* Left Panel: Sidebar Progress */}
                <div className="w-full md:w-80 bg-[#0038A8] p-6 md:p-12 text-white flex flex-col">
                    <div className="mb-12">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                            <Sparkles size={28} className="text-blue-200" />
                        </div>
                        <h2 className="text-3xl font-black leading-tight">
                            {isEdit ? "Update AI-Matched Opportunity" : "Create AI-Matched Opportunity"}
                        </h2>
                    </div>

                    <div className="space-y-8 flex-1">
                        <StepItem active={step === 1} number="01" label="Role Identity" sub="Basic info & details" />
                        <StepItem active={step === 2} number="02" label="Environment" sub="Atmosphere & Flexibility" />
                        <StepItem active={step === 3} number="03" label="AI Suitability" sub="Inclusivity Metrics" />
                    </div>

                    <div className="mt-auto p-6 bg-white/5 rounded-3xl border border-white/10">
                        <div className="flex items-center gap-3 text-blue-200 mb-2">
                            <ShieldCheck size={18} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Matching Protocol v3.0</span>
                        </div>
                        <p className="text-[10px] text-blue-100/60 leading-relaxed font-medium">Your inputs are processed by our Semantic AI to find candidates with the highest capability-to-safety ratio.</p>
                    </div>
                </div>

                {/* Right Panel: Form Content */}
                <div className="flex-1 flex flex-col bg-slate-50">
                    <div className="p-8 border-b border-slate-200 flex items-center justify-between bg-white px-12">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Step {step} of 3</span>
                        <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors text-slate-400" aria-label="Close job posting form"><X size={24} aria-hidden="true"/></button>
                    </div>

                    <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <Input label="Position Title" value={formData.job_title} onChange={v => setFormData({...formData, job_title: v})} placeholder="e.g. Senior Software Engineer" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Select label="Job Type" value={formData.job_type} onChange={v => setFormData({...formData, job_type: v})} options={['Full-time', 'Part-time', 'Contract', 'Freelance']} />
                                            <Select label="Employer Type" value={formData.employer_type} onChange={v => setFormData({...formData, employer_type: v})} options={['Private', 'Government', 'NGO']} />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Job Description</label>
                                            <button 
                                                type="button" 
                                                onClick={handleAutoAnalyze}
                                                disabled={analyzing || !formData.job_description?.trim()}
                                                className="px-3.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border border-blue-200 shadow-sm disabled:opacity-40"
                                            >
                                                <Sparkles size={13} />
                                                {analyzing ? "AI Analyzing..." : "✨ Auto-Analyze & Optimize"}
                                            </button>
                                        </div>
                                        <TextArea label="" value={formData.job_description} onChange={v => setFormData({...formData, job_description: v})} placeholder="Describe the core mission, responsibilities, and working conditions of this role..." height="150px" />
                                        
                                        {clarity && (
                                            <div className="mt-4 p-5 bg-white rounded-3xl border-2 border-slate-100 shadow-sm space-y-4">
                                                {/* Header & Gauge */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs ${clarity.clarity_score >= 85 ? 'bg-emerald-100 text-emerald-700' : clarity.clarity_score >= 65 ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {clarity.clarity_score}%
                                                        </div>
                                                        <div>
                                                            <h5 className="text-xs font-black text-slate-800">{clarity.clarity_label}</h5>
                                                            <p className="text-[10px] text-slate-400 font-medium">Clarity score directly impacts Bi-Encoder & FAISS candidate matching precision.</p>
                                                        </div>
                                                    </div>
                                                    {clarity.suggested_snippet && (
                                                        <button
                                                            type="button"
                                                            onClick={handleApplySnippet}
                                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                                                        >
                                                            <Sparkles size={12} />
                                                            ✨ 1-Click Auto-Enhance (+25%)
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Signals Checklist */}
                                                {clarity.signals && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                                                        <div className={`p-2.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 ${clarity.signals.skills ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                                            <span>{clarity.signals.skills ? '✓' : '○'}</span> Skills Detected
                                                        </div>
                                                        <div className={`p-2.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 ${clarity.signals.posture ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                                            <span>{clarity.signals.posture ? '✓' : '○'}</span> Workstation Posture
                                                        </div>
                                                        <div className={`p-2.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 ${clarity.signals.communication ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                                            <span>{clarity.signals.communication ? '✓' : '○'}</span> Communication Mode
                                                        </div>
                                                        <div className={`p-2.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 ${clarity.signals.environment ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                                            <span>{clarity.signals.environment ? '✓' : '○'}</span> Setting & Schedule
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Actionable Tips to Increase Percentage */}
                                                {clarity.tips && clarity.tips.length > 0 && (
                                                    <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-100/80 space-y-1.5">
                                                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1">
                                                            <span>💡</span> How to increase match precision to 90%+:
                                                        </div>
                                                        <ul className="space-y-1">
                                                            {clarity.tips.map((tip, idx) => (
                                                                <li key={idx} className="text-[11px] text-amber-900 font-medium leading-relaxed pl-2 border-l-2 border-amber-300">
                                                                    {tip}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-8">
                                        <Input label="Salary Range" value={formData.salary_range} onChange={v => setFormData({...formData, salary_range: v})} placeholder="PHP 40,000 - 60,000" />
                                        <Input label="Primary Skills" value={formData.structured_skills} onChange={v => setFormData({...formData, structured_skills: v})} placeholder="e.g. SQL, React, Project Management" />
                                    </div>
                                    <TextArea label="Benefits & Growth" value={formData.benefits} onChange={v => setFormData({...formData, benefits: v})} placeholder="HMO, Training Programs, 13th Month..." height="100px" />
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <Input label="Primary Work Location" value={formData.location} onChange={v => setFormData({...formData, location: v})} placeholder="e.g. Makati City / Remote" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Select label="Environment" value={formData.work_environment} onChange={v => setFormData({...formData, work_environment: v})} options={['Indoor', 'Outdoor', 'Hybrid', 'Hazard-Free']} />
                                            <Select label="Tempo" value={formData.work_tempo} onChange={v => setFormData({...formData, work_tempo: v})} options={['Slow', 'Moderate', 'Fast', 'High-Pressure']} />
                                        </div>
                                    </div>
                                    
                                    <div className="p-10 bg-white rounded-[3rem] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-8 flex items-center gap-2">
                                            <Globe size={18} className="text-[#0038A8]" /> Flexibility & Remote Settings
                                        </h3>
                                        <div className="grid md:grid-cols-2 gap-10">
                                            <Toggle 
                                                icon={<Clock size={20}/>} 
                                                label="Flexible Schedule" 
                                                desc="Ability to adjust start/end times" 
                                                active={formData.has_flexibility} 
                                                onToggle={() => setFormData({...formData, has_flexibility: !formData.has_flexibility})} 
                                            />
                                            <Toggle 
                                                icon={<Briefcase size={20}/>} 
                                                label="Remote Friendly" 
                                                desc="Tasks can be performed from home" 
                                                active={formData.remote_friendly} 
                                                onToggle={() => setFormData({...formData, remote_friendly: !formData.remote_friendly})} 
                                            />
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-8">
                                        <MetricSlider 
                                            icon={<MessageSquare size={18}/>} 
                                            label="Social Interaction" 
                                            value={formData.social_interaction} 
                                            options={['Minimal', 'Moderate', 'High']} 
                                            onChange={v => setFormData({...formData, social_interaction: v})} 
                                        />
                                        <MetricSlider 
                                            icon={<Zap size={18}/>} 
                                            label="Fine Motor Demand" 
                                            value={formData.fine_motor_demand} 
                                            options={['Low', 'Medium', 'High']} 
                                            onChange={v => setFormData({...formData, fine_motor_demand: v})} 
                                        />
                                        <MetricSlider 
                                            icon={<Zap size={18}/>} 
                                            label="Physical Exertion Demand" 
                                            value={formData.physical_demand} 
                                            options={['Low', 'Medium', 'High']} 
                                            onChange={v => setFormData({...formData, physical_demand: v})} 
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                                    <div className="p-10 bg-white rounded-[3rem] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-8 flex items-center gap-2">
                                            <Brain size={18} className="text-[#0038A8]" /> Cognitive & Sensory Load
                                        </h3>
                                        <div className="grid md:grid-cols-2 gap-10 mb-10">
                                            <MetricSlider 
                                                icon={<Zap size={18}/>} 
                                                label="Cognitive Complexity" 
                                                value={formData.cognitive_load} 
                                                options={['Low', 'Medium', 'High']} 
                                                onChange={v => setFormData({...formData, cognitive_load: v})} 
                                            />
                                            <MetricSlider 
                                                icon={<Sparkles size={18}/>} 
                                                label="Sensory Intensity" 
                                                value={formData.sensory_load} 
                                                options={['Low', 'Medium', 'High']} 
                                                onChange={v => setFormData({...formData, sensory_load: v})} 
                                            />
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-10">
                                            <MetricSlider 
                                                icon={<Eye size={18}/>} 
                                                label="Visual Demand" 
                                                value={formData.visual_demand} 
                                                options={['Low', 'Medium', 'High']} 
                                                onChange={v => setFormData({...formData, visual_demand: v})} 
                                            />
                                            <MetricSlider 
                                                icon={<Ear size={18}/>} 
                                                label="Auditory Demand" 
                                                value={formData.auditory_demand} 
                                                options={['Low', 'Medium', 'High']} 
                                                onChange={v => setFormData({...formData, auditory_demand: v})} 
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Established Accessibility Features</label>
                                        <div className="flex flex-wrap gap-2">
                                            {accessibilityOptions.map(opt => (
                                                <button 
                                                    key={opt}
                                                    type="button"
                                                    onClick={() => toggleAccessibility(opt)}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                                                        formData.accessibility_features.includes(opt) 
                                                        ? 'bg-[#0038A8] text-white border-[#0038A8] shadow-lg shadow-blue-100' 
                                                        : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                                                    }`}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <TextArea label="Physical Demands & Accessibility Notes" value={formData.physical_requirements} onChange={v => setFormData({...formData, physical_requirements: v})} placeholder="e.g. Sitting for long periods, accessible restrooms available..." height="100px" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>

                    <div className="p-10 bg-white border-t border-slate-200 flex items-center justify-between px-12">
                        <div className="flex gap-4">
                            {step > 1 && (
                                <button type="button" onClick={() => setStep(step - 1)} className="px-10 py-5 bg-slate-100 text-slate-600 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Previous</button>
                            )}
                        </div>
                        
                        {step < 3 ? (
                            <button type="button" onClick={() => setStep(step + 1)} className="px-12 py-5 bg-[#0038A8] text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Next Details</button>
                        ) : (
                            <button onClick={onSubmit} className="px-12 py-5 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-3">
                                <Send size={18} /> Deploy Opportunity
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

const StepItem = ({ active, number, label, sub }) => (
    <div className={`flex gap-6 transition-all ${active ? 'opacity-100' : 'opacity-40'}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm border-2 ${active ? 'bg-white text-[#0038A8] border-white' : 'border-white/20 text-white'}`}>{number}</div>
        <div>
            <p className="font-black text-sm uppercase tracking-widest">{label}</p>
            <p className="text-[10px] text-blue-200 font-medium">{sub}</p>
        </div>
    </div>
);

const Toggle = ({ icon, label, desc, active, onToggle }) => (
    <button type="button" onClick={onToggle} className={`flex items-center gap-6 p-6 rounded-[2.5rem] border-2 transition-all text-left w-full ${active ? 'bg-blue-50 border-[#0038A8]' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${active ? 'bg-[#0038A8] text-white' : 'bg-slate-50 text-slate-400'}`}>
            {icon}
        </div>
        <div className="flex-1">
            <p className={`font-black text-xs uppercase tracking-widest ${active ? 'text-[#0038A8]' : 'text-slate-800'}`}>{label}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">{desc}</p>
        </div>
        <div className={`w-6 h-6 rounded-full border-4 ${active ? 'bg-[#0038A8] border-blue-200' : 'bg-slate-100 border-slate-50'}`} />
    </button>
);

const MetricSlider = ({ icon, label, value, options, onChange }) => (
    <div className="space-y-4">
        <div className="flex items-center gap-3 ml-4">
            <span className="text-slate-400">{icon}</span>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
        </div>
        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-3xl">
            {options.map(opt => (
                <button 
                    key={opt}
                    type="button"
                    onClick={() => onChange(opt)}
                    className={`flex-1 py-3 rounded-[1.5rem] text-[9px] font-black uppercase tracking-widest transition-all ${
                        value === opt ? 'bg-white text-[#0038A8] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    {opt}
                </button>
            ))}
        </div>
    </div>
);

const Select = ({ label, value, onChange, options }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{label}</label>
        <select 
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all"
        >
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);

const StatusModal = ({ job, onClose, onConfirm }) => {
    const [reason, setReason] = useState(job.status_reason || "");
    const statuses = ["Active", "Full", "Cancelled"];
    
    // Map db status to friendly display status
    const getFriendlyStatus = (s) => {
        if (!s) return "Active";
        const lower = s.toLowerCase();
        if (lower === 'approved') return "Active";
        if (lower === 'full') return "Full";
        if (lower === 'cancelled') return "Cancelled";
        return s;
    };

    const getDBStatus = (friendly) => {
        if (friendly === "Active") return "approved";
        return friendly.toLowerCase();
    };

    const [selectedStatus, setSelectedStatus] = useState(getFriendlyStatus(job.status));

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Update job status">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[3rem] p-6 md:p-10 w-full max-w-lg shadow-2xl">
                <h3 className="text-2xl font-black text-slate-800 mb-2">Update Job Status</h3>
                <p className="text-sm text-slate-400 mb-8">Change the availability of <strong>{job.job_title}</strong>.</p>
                
                <div className="flex gap-2 mb-8">
                    {statuses.map(s => (
                        <button 
                            key={s} 
                            type="button"
                            onClick={() => setSelectedStatus(s)}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                selectedStatus === s ? 'bg-[#0038A8] text-white border-blue-600 shadow-lg shadow-blue-100' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                <TextArea label="Reason for Status Change" value={reason} onChange={setReason} placeholder="e.g. Quota reached, Re-evaluating role..." height="100px" />
                
                <div className="flex gap-4 mt-8">
                    <button onClick={onClose} type="button" className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-2xl">Cancel</button>
                    <button onClick={() => onConfirm(job.id, getDBStatus(selectedStatus), reason)} type="button" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all">Apply Change</button>
                </div>
            </motion.div>
        </div>
    );
};

const ActionModal = ({ app, onClose, onConfirm }) => {
    const [notes, setNotes] = useState("");
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Review application">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[3rem] p-6 md:p-12 w-full max-w-2xl shadow-2xl">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-16 h-16 bg-blue-50 rounded-[2rem] flex items-center justify-center text-[#0038A8] border border-blue-100">
                        <Users size={32} aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800">Review Application</h3>
                        <p className="text-sm text-slate-400 mt-1">{app.action === 'Approved' ? 'Confirming candidate for next steps' : 'Declining this application'}</p>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-[2rem] p-8 mb-8 border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Candidate Context</p>
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <p className="text-[9px] font-black uppercase text-slate-300 mb-1">Applicant</p>
                            <p className="text-sm font-bold text-slate-700">{app.applicant_name}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase text-slate-300 mb-1">Target Role</p>
                            <p className="text-sm font-bold text-slate-700">{app.job_title}</p>
                        </div>
                    </div>
                </div>

                <TextArea label="Internal Reviewer Notes" value={notes} onChange={setNotes} placeholder="Add specific feedback or interview instructions..." height="150px" />
                
                <div className="flex gap-4 mt-12">
                    <button onClick={onClose} className="flex-1 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 rounded-[2.5rem]">Cancel</button>
                    <button 
                        onClick={() => onConfirm(app.id, app.action, notes)} 
                        className={`flex-1 py-5 text-white rounded-[2.5rem] font-black text-[10px] uppercase tracking-widest shadow-xl transition-all ${
                            app.action === 'Approved' ? 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700' : 'bg-rose-600 shadow-rose-100 hover:bg-rose-700'
                        }`}
                    >
                        {app.action} Application
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const VerificationView = ({ user, initialData = {}, isResubmission = false, onCancel }) => {
    const { token, API_BASE_URL } = useAuth();
    const toast = useToast();
    const [step, setStep] = useState(1);
    const [submitted, setSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        company_name: initialData.company_name || user?.name || '',
        company_type: initialData.company_type || 'Corporation',
        location: initialData.location || '',
        industry: initialData.industry || '',
        contact_person: initialData.contact_person || '',
        proof_filename: initialData.proof_filename || 'registration_permit.pdf'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE_URL}/employer/verify`, formData, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSubmitted(true);
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            console.error("Verification submission failed", err);
            toast.error("Submission failed. Please make sure all required fields are filled out.");
        }
    };

    if (submitted) return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto py-20 text-center">
            <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-100">
                <CheckCircle2 size={48} />
            </div>
            <h2 className="text-4xl font-black text-slate-900 mb-4">Application Submitted</h2>
            <p className="text-slate-500 text-lg mb-12">Thank you! Your credentials have been submitted for audit. Our administrative team is currently reviewing them. Refreshing state...</p>
        </motion.div>
    );

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
            <header className="mb-12 text-center">
                <h2 className="text-4xl font-black text-slate-900 mb-4">
                    {isResubmission ? "Modify Verification Details" : "Finalize Your Organization"}
                </h2>
                <p className="text-slate-500">To maintain a safe and professional workspace for PWDs, we require business verification.</p>
                
                <div className="flex items-center justify-center gap-4 mt-8">
                    <div className={`w-10 h-1 rounded-full ${step >= 1 ? 'bg-[#0038A8]' : 'bg-slate-200'}`} />
                    <div className={`w-10 h-1 rounded-full ${step >= 2 ? 'bg-[#0038A8]' : 'bg-slate-200'}`} />
                    <div className={`w-10 h-1 rounded-full ${step >= 3 ? 'bg-[#0038A8]' : 'bg-slate-200'}`} />
                </div>
            </header>

            <div className="bg-white rounded-[3rem] p-6 md:p-12 border border-slate-100 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {step === 1 && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-800 mb-6">Business Information</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="Company / Organization Name" value={formData.company_name} onChange={v => setFormData({...formData, company_name: v})} placeholder="e.g. Acme Corp" />
                                <Input label="Industry" value={formData.industry} onChange={v => setFormData({...formData, industry: v})} placeholder="e.g. Technology, Retail, Education" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input label="Company Headquarters" value={formData.location} onChange={v => setFormData({...formData, location: v})} placeholder="Full physical address" />
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Business Type</label>
                                    <select 
                                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all"
                                        value={formData.company_type} onChange={e => setFormData({...formData, company_type: e.target.value})}
                                    >
                                        <option>Corporation</option>
                                        <option>Sole Proprietorship</option>
                                        <option>Partnership</option>
                                        <option>NGO / Foundation</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                {isResubmission && onCancel && (
                                    <button type="button" onClick={onCancel} className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">Cancel</button>
                                )}
                                <button type="button" onClick={() => {
                                    if (!formData.company_name || !formData.industry || !formData.location) {
                                        toast.warning("Please fill out all business details before proceeding.");
                                        return;
                                    }
                                    setStep(2);
                                }} className="flex-[2] py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-black transition-all">Next: Contact Details</button>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                            <h3 className="text-xl font-bold text-slate-800 mb-6">Contact Details</h3>
                            <Input label="Primary Contact Person" value={formData.contact_person} onChange={v => setFormData({...formData, contact_person: v})} placeholder="Full name of representative" />
                            
                            <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs text-blue-800 leading-relaxed font-medium">
                                Provide the credentials of the person who will manage the job listings and review candidate applications.
                            </div>

                            <div className="flex gap-4">
                                <button type="button" onClick={() => setStep(1)} className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">Back</button>
                                <button type="button" onClick={() => {
                                    if (!formData.contact_person) {
                                        toast.warning("Please enter the contact person's name.");
                                        return;
                                    }
                                    setStep(3);
                                }} className="flex-[2] py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-black transition-all">Continue to Documents</button>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
                            <div className="p-10 border-4 border-dashed border-slate-100 rounded-[3rem] text-center group hover:border-blue-200 transition-all cursor-pointer">
                                <div className="w-16 h-16 bg-blue-50 text-[#0038A8] rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                                    <FileText size={32} />
                                </div>
                                <h4 className="text-lg font-bold text-slate-800 mb-2">Upload Supporting Documents</h4>
                                <p className="text-sm text-slate-400 max-w-xs mx-auto mb-4">Drag and drop your scanned SEC/DTI registration here. (PDF, JPG, PNG)</p>
                                <span className="inline-block px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 shadow-sm">
                                    File: {formData.proof_filename}
                                </span>
                            </div>
                            
                            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                                <AlertCircle size={24} className="text-amber-600 shrink-0" />
                                <p className="text-xs text-amber-700 leading-relaxed font-medium">By submitting, you declare that all information is true and accurate. UPLIFT conducts manual auditing of all employer accounts.</p>
                            </div>

                            <div className="flex gap-4">
                                <button type="button" onClick={() => setStep(2)} className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">Back</button>
                                <button type="submit" className="flex-[2] py-5 bg-[#0038A8] text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Submit for Review</button>
                            </div>
                        </motion.div>
                    )}
                </form>
            </div>
        </motion.div>
    );
};

const PendingView = ({ user }) => {
    const vData = user?.verification_data || {};
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto py-12"
        >
            <div className="bg-white rounded-[3rem] p-6 md:p-12 border border-slate-100 shadow-sm text-center">
                <div className="w-24 h-24 bg-blue-50 text-[#0038A8] rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-100/50 animate-pulse">
                    <Clock size={44} />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-4">Verification Under Review</h2>
                <p className="text-slate-500 text-lg max-w-2xl mx-auto mb-12">
                    Thank you for your commitment to inclusive hiring! Our administrative team is currently reviewing your business credentials. This process typically takes 24-48 hours.
                </p>

                {/* Submitted Details Card */}
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 text-left mb-8 max-w-2xl mx-auto">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-200/60 pb-3">Submitted Credentials</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Company Name</p>
                            <p className="text-sm font-bold text-slate-800">{vData.company_name || user?.name || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Business Type</p>
                            <p className="text-sm font-bold text-slate-800">{vData.company_type || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Industry</p>
                            <p className="text-sm font-bold text-slate-800">{vData.industry || 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Primary Contact</p>
                            <p className="text-sm font-bold text-slate-800">{vData.contact_person || 'N/A'}</p>
                        </div>
                        <div className="md:col-span-2">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Submitted At</p>
                            <p className="text-sm font-bold text-slate-800">
                                {vData.submitted_at ? new Date(vData.submitted_at).toLocaleString() : 'Just now'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
                    <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping shrink-0" />
                        Live Status: Pending Audit
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const RejectionView = ({ user, onModify }) => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className="max-w-4xl mx-auto py-12"
        >
            <div className="bg-white rounded-[3rem] p-6 md:p-12 border border-slate-100 shadow-sm text-center">
                <div className="w-24 h-24 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-rose-100/50">
                    <XCircle size={44} />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-4">Verification Declined</h2>
                <p className="text-slate-500 text-lg max-w-2xl mx-auto mb-8">
                    Your verification request has been rejected by our administration team. Please review the feedback below.
                </p>

                {/* Rejection Reason Card */}
                <div className="p-8 bg-rose-50/50 rounded-[2.5rem] border border-rose-100 text-left mb-8 max-w-2xl mx-auto">
                    <h3 className="text-xs font-black uppercase tracking-widest text-rose-600 mb-3 flex items-center gap-2">
                        <AlertCircle size={16} /> Rejection Feedback
                    </h3>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed italic bg-white p-6 rounded-2xl border border-rose-100/60 shadow-inner">
                        "{user?.rejection_reason || 'No specific feedback was provided.'}"
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
                    <button 
                        onClick={onModify} 
                        className="w-full sm:w-auto px-8 py-4 bg-[#0038A8] hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:-translate-y-1"
                    >
                        Modify & Re-submit
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

const Input = ({ label, value, onChange, placeholder }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{label}</label>
        <input 
            type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all shadow-inner"
        />
    </div>
);

const TextArea = ({ label, value, onChange, placeholder, height }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">{label}</label>
        <textarea 
            value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={{ height }}
            className="w-full bg-slate-50 border-2 border-transparent rounded-[2rem] px-8 py-6 text-sm font-medium text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all shadow-inner leading-relaxed"
        />
    </div>
);

const CandidateProfileModal = ({ candidate, onClose, token, API_BASE_URL }) => {
    if (!candidate) return null;
    const [resumeData, setResumeData] = useState(null);
    const [loadingResume, setLoadingResume] = useState(false);

    const handleFetchResume = async () => {
        setLoadingResume(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/employer/candidates/${candidate.id}/resume`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data?.resume_base64) {
                setResumeData(res.data.resume_base64);
            } else {
                alert('Unable to generate resume for this candidate.');
            }
        } catch (err) {
            console.error('Failed to generate candidate resume', err);
            alert(err.response?.data?.detail || 'Resume could not be generated.');
        } finally {
            setLoadingResume(false);
        }
    };
    
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-8 lg:p-12 overflow-y-auto bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Candidate details">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 sm:gap-6">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-blue-100 text-[#0038A8] rounded-2xl flex items-center justify-center font-black text-2xl uppercase shadow-inner shrink-0">
                            {candidate.name?.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-800">{candidate.name}</h3>
                            <p className="text-xs sm:text-sm font-medium text-slate-400 mt-0.5">{candidate.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleFetchResume}
                            disabled={loadingResume}
                            className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-[#0038A8] rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <FileText size={14} />
                            {loadingResume ? 'Rendering...' : '📄 View ATS Resume'}
                        </button>
                        <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Resume Modal Overlay inside Candidate Modal */}
                {resumeData && (
                    <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col items-center">
                        <div className="w-full flex justify-between items-center mb-3 px-2">
                            <span className="text-xs font-black text-slate-300 uppercase tracking-wider">Compiled ATS Resume</span>
                            <button onClick={() => setResumeData(null)} className="text-xs font-bold text-rose-400 hover:text-rose-300 hover:underline">Close Resume Preview</button>
                        </div>
                        <PDFViewer 
                            pdfData={resumeData}
                            fileName={`${candidate.name}_Resume.pdf`}
                            className="w-full h-[55vh]"
                        />
                    </div>
                )}
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 sm:p-10 lg:p-12 space-y-10 custom-scrollbar">
                    {/* Bio / Summary */}
                    {candidate.summary && (
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#0038A8]">Candidate Bio</h4>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50 p-6 rounded-2xl border border-slate-100 italic">
                                "{candidate.summary}"
                            </p>
                        </div>
                    )}

                    {/* Quick Profile Indicators */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100">
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Disabilities & Accessibility</h4>
                                <div className="flex flex-wrap gap-2">
                                    {candidate.disabilities && candidate.disabilities.length > 0 ? (
                                        candidate.disabilities.map((d, i) => (
                                            <span key={i} className="px-3 py-1 bg-white rounded-lg text-[10px] font-bold text-[#0038A8] border border-blue-100">{d}</span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-slate-500 italic">None declared</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Physical Capabilities / Accommodations</h4>
                                <p className="text-xs font-bold text-slate-700">{candidate.physical_capabilities || 'None specified'}</p>
                            </div>
                        </div>
                        <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-200/60 md:pl-8">
                            <div>
                                <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Preferred Work Intensity</h4>
                                <span className="inline-block px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100">
                                    {candidate.preferred_intensity || 'Medium'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Skill Sets */}
                    {candidate.skills && (
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#0038A8]">Core Skills</h4>
                            <div className="flex flex-wrap gap-2">
                                {candidate.skills.split(',').map((s, i) => (
                                    <span key={i} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 border border-slate-200/60">{s.trim()}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Grid of details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Education & Experience */}
                        <div className="space-y-8">
                            {candidate.education && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#0038A8]">Education</h4>
                                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-2">
                                        <p className="text-sm font-bold text-slate-800 whitespace-pre-wrap">{candidate.education}</p>
                                    </div>
                                </div>
                            )}
                            {candidate.experience && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#0038A8]">Work Experience</h4>
                                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-2">
                                        <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap">{candidate.experience}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column: Projects, Certifications, Awards */}
                        <div className="space-y-8">
                            {candidate.projects && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#0038A8]">Projects</h4>
                                    <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-2">
                                        <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap">{candidate.projects}</p>
                                    </div>
                                </div>
                            )}
                            {(candidate.certifications || candidate.awards) && (
                                <div className="space-y-6">
                                    {candidate.certifications && (
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#0038A8]">Certifications</h4>
                                            <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-2">
                                                <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap">{candidate.certifications}</p>
                                            </div>
                                        </div>
                                    )}
                                    {candidate.awards && (
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#0038A8]">Honors & Awards</h4>
                                            <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-2">
                                                <p className="text-sm font-medium text-slate-600 whitespace-pre-wrap">{candidate.awards}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default EmployerPortal;
