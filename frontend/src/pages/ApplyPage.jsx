import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Building2, MapPin, Send, CheckCircle2,
    AlertCircle, Upload, FileText, X, RefreshCw,
    Briefcase, User, GraduationCap, Terminal, Shield
} from 'lucide-react';
import PDFViewer from '../components/PDFViewer';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ApplyPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token, API_BASE_URL } = useAuth();
    const toast = useToast();

    const [job, setJob] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);

    const [resumeChoice, setResumeChoice] = useState('auto');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [uploadedBase64, setUploadedBase64] = useState('');
    const [generatedBase64, setGeneratedBase64] = useState('');
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const [jobRes, userRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/jobs/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axios.get(`${API_BASE_URL}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                ]);
                setJob(jobRes.data);
                setUserProfile(userRes.data);
                setResumeChoice(userRes.data?.auto_generate_resume ? 'auto' : 'upload');
                setLoading(false);
            } catch (err) {
                toast.error('Failed to load job details.');
                navigate(-1);
            }
        })();
    }, [id]);

    // Auto-generate resume on mount if auto selected
    useEffect(() => {
        if (!loading && resumeChoice === 'auto' && !generatedBase64 && !generating) {
            handleRegenerate();
        }
    }, [loading, resumeChoice]);

    const handleRegenerate = async () => {
        setGenerating(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/resume/generate`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                setGeneratedBase64(res.data.resume_base64);
            }
        } catch (err) {
            // Non-critical
        } finally {
            setGenerating(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            toast.error('Please upload a PDF file.');
            return;
        }
        setUploadedFile(file);
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            setUploadedBase64(base64);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!resumeChoice || (resumeChoice === 'upload' && !uploadedBase64)) return;
        setApplying(true);
        try {
            const payload = { job_id: id, resume_source: resumeChoice };
            if (resumeChoice === 'upload') {
                payload.resume_data = uploadedBase64;
            }
            await axios.post(`${API_BASE_URL}/applications`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Application submitted successfully!');
            navigate(`/job/${id}`);
        } catch (err) {
            toast.error('Failed to submit: ' + (err.response?.data?.detail || 'Unknown error'));
        } finally {
            setApplying(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
    );

    if (!job) return null;

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-colors group">
                        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        Back
                    </button>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                        Apply
                    </span>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
                {/* Job summary bar */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl font-black text-blue-600">
                            {job.employer_name?.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">{job.job_title}</h1>
                            <div className="flex items-center gap-3 text-slate-500 font-bold text-sm mt-1">
                                <span className="flex items-center gap-1.5"><Building2 size={16}/> {job.employer_name}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                <span className="flex items-center gap-1.5"><MapPin size={16}/> {job.location}</span>
                            </div>
                        </div>
                    </div>
                    <div className="hidden sm:flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{job.job_type}</span>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{job.salary_range}</span>
                    </div>
                </div>

                {/* Resume choice */}
                <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 block">Choose your resume</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => setResumeChoice('auto')}
                            className={`p-8 rounded-[2.5rem] border-2 text-left transition-all ${
                                resumeChoice === 'auto'
                                ? 'border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-50'
                                : 'border-slate-100 hover:border-slate-200 bg-white'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                                resumeChoice === 'auto' ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                            }`}>
                                <FileText size={24} />
                            </div>
                            <h4 className={`font-black text-base mb-2 ${resumeChoice === 'auto' ? 'text-blue-600' : 'text-slate-800'}`}>
                                Auto-Generated Resume
                            </h4>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                RenderCV generates an ATS-optimized PDF resume from your profile data. Best match for employer systems.
                            </p>
                        </button>
                        <button
                            onClick={() => setResumeChoice('upload')}
                            className={`p-8 rounded-[2.5rem] border-2 text-left transition-all ${
                                resumeChoice === 'upload'
                                ? 'border-green-500 bg-green-50/50 shadow-lg shadow-green-50'
                                : 'border-slate-100 hover:border-slate-200 bg-white'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                                resumeChoice === 'upload' ? 'bg-green-600 text-white' : 'bg-slate-50 text-slate-400'
                            }`}>
                                <Upload size={24} />
                            </div>
                            <h4 className={`font-black text-base mb-2 ${resumeChoice === 'upload' ? 'text-green-600' : 'text-slate-800'}`}>
                                Upload Your Resume
                            </h4>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                Upload your existing PDF resume to include with this application.
                            </p>
                        </button>
                    </div>
                </div>

                {/* Preview area */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                        <h3 className="font-black text-slate-800 text-sm">
                            {resumeChoice === 'auto' ? 'Generated Resume Preview' : 'Uploaded Resume'}
                        </h3>
                        {resumeChoice === 'auto' && (
                            <button
                                onClick={handleRegenerate}
                                disabled={generating}
                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
                            >
                                <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
                                Regenerate
                            </button>
                        )}
                    </div>
                    <div className="p-8">
                        {resumeChoice === 'auto' ? (
                            generating ? (
                                <div className="h-[50vh] bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-center">
                                    <div className="text-center">
                                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
                                        <p className="text-sm text-slate-400 font-medium">Generating your ATS resume...</p>
                                    </div>
                                </div>
                            ) : generatedBase64 ? (
                                <PDFViewer 
                                    pdfData={generatedBase64}
                                    fileName="Generated_ATS_Resume.pdf"
                                    className="w-full h-[55vh]"
                                />
                            ) : (
                                <div className="h-[50vh] bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-center">
                                    <p className="text-slate-400 font-medium">Resume will be generated on submit.</p>
                                </div>
                            )
                        ) : (
                            <div className="space-y-6">
                                <label className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-[2rem] cursor-pointer transition-all ${
                                    uploadedFile ? 'border-green-300 bg-green-50/30' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                                }`}>
                                    {uploadedFile ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                                                <FileText size={28} />
                                            </div>
                                            <p className="font-bold text-slate-700">{uploadedFile.name}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{(uploadedFile.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                                                <Upload size={28} />
                                            </div>
                                            <p className="font-bold text-sm text-slate-500">Click to upload PDF</p>
                                            <p className="text-[10px] text-slate-400 font-medium">or drag and drop</p>
                                        </div>
                                    )}
                                    <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                                </label>

                                {uploadedBase64 && (
                                    <PDFViewer 
                                        pdfData={uploadedBase64}
                                        fileName={uploadedFile?.name || 'Uploaded_Resume.pdf'}
                                        className="w-full h-[55vh]"
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Profile snapshot */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                    <h3 className="font-black text-slate-800 text-sm mb-6 flex items-center gap-2">
                        <User size={18} className="text-blue-500" />
                        Profile data included in application
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <GraduationCap size={16} className="text-slate-400" />
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Name</p>
                                    <p className="font-bold text-slate-700">{userProfile?.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Terminal size={16} className="text-slate-400" />
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Skills</p>
                                    <p className="font-bold text-slate-700">{userProfile?.skills || 'Not specified'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Shield size={16} className="text-slate-400" />
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Disabilities</p>
                                    <p className="font-bold text-slate-700">{(userProfile?.disabilities || []).join(', ') || 'Not specified'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Briefcase size={16} className="text-slate-400" />
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Resume Source</p>
                                    <p className="font-bold text-slate-700">{resumeChoice === 'auto' ? 'Auto-Generated (RenderCV)' : 'Uploaded PDF'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit section */}
                <div className="sticky bottom-8 bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-sm text-slate-500 font-medium">
                        <AlertCircle size={18} className="text-blue-500 shrink-0" />
                        <span>Your UPLIFT Suitability Score is shared with the employer.</span>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={applying || (resumeChoice === 'upload' && !uploadedBase64)}
                        className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shrink-0"
                    >
                        {applying ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <><Send size={16} /> Submit Application</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApplyPage;
