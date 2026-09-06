import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, Briefcase, Sliders, ChevronRight, Save, 
    CheckCircle2, Accessibility, GraduationCap, Building2, Terminal, 
    Award, Sparkles, LayoutDashboard, Plus, FileText, Trash2, ArrowLeft, ArrowRight
} from 'lucide-react';
import PDFViewer from '../components/PDFViewer';

const SUB_CATEGORIES = {
    'Physical': ['Wheelchair User', 'Chronic Pain', 'Neurological Condition', 'Other'],
    'Visual': ['Total Blindness', 'Low Vision', 'Color Blindness', 'Other'],
    'Hearing': ['Profoundly Deaf', 'Hard of Hearing', 'Auditory Processing', 'Other'],
    'Learning': ['Autism (ASD)', 'ADHD', 'Dyslexia', 'Dysgraphia', 'Other'],
    'Intellectual': ['Down Syndrome', 'Developmental Delay', 'Other'],
    'Psychosocial': ['Anxiety Disorder', 'PTSD', 'Personality Disorder', 'Adjustment Disorder', 'Other'],
    'Mental': ['Bipolar Disorder', 'Schizophrenia', 'Major Depression', 'Other'],
    'Orthopedic': ['Spinal Cord Injury', 'Cerebral Palsy', 'Muscular Dystrophy', 'Polio/Post-Polio Syndrome', 'Amputee', 'Scoliosis/Kyphosis', 'Other'],
    'Speech and Language Impairment': ['Stuttering/Fluency Disorder', 'Aphasia', 'Voice Disorder', 'Articulation Disorder', 'Other'],
    'Cancer': ['Active Treatment', 'Survivor/Remission', 'Rare Cancer Type', 'Other'],
    'Rare Disease': ['Genetic Disorder', 'Autoimmune Condition', 'Metabolic Disorder', 'Other']
};

const EXTENT_OPTIONS = {
    'Amputee': ['Finger(s)', 'Hand', 'Forearm', 'Upper Arm', 'Leg(s)', 'Toe(s)', 'Other'],
    'default': ['Partial', 'Complete', 'One side', 'Both sides', 'Mild', 'Moderate', 'Severe', 'Other']
};

const EDUCATION_LEVELS = ['Elementary', 'Junior High School', 'Senior High School', 'College', 'Masteral/Doctoral'];
const LATERALITY_SUBTYPES = ['Amputee', 'Cerebral Palsy', 'Muscular Dystrophy'];

const QUICK_SUGGESTIONS = {
    'summary': ['Seeking Remote Work', 'Career Shifter', 'Entry-Level', 'Passionate Learner', 'Detail-Oriented', 'Tech-Savvy'],
    'physical_capabilities': ['Wheelchair Accessible Only', 'Needs Screen Reader', 'Low-Stamina Work', 'Quiet Environment', 'Level Floor Access', 'Service Dog Friendly', 'Flexible Breaks'],
    'skills': ['Microsoft Office', 'Customer Service', 'Data Entry', 'Public Speaking', 'Team Leadership', 'Graphic Design', 'Web Development'],
    'education': ['High School Graduate', 'College Degree', 'Vocational Certificate', 'Online Courses', 'Self-Taught'],
    'experience': ['Customer Support', 'Administrative Task', 'Volunteer Work', 'Internship', 'Freelance'],
    'projects': ['Personal Portfolio', 'Community Project', 'Open Source Contribution'],
    'certifications': ['Tesda Certified', 'Google Professional Cert', 'First Aid Certified'],
    'awards': ['Employee of the Month', 'Academic Excellence', 'Community Leader']
};

const Profile = () => {
    const { user, token, API_BASE_URL, login } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [profile, setProfile] = useState({
        summary: '',
        skills: '',
        disabilities: [],
        skill_weight: 0.5,
        safety_weight: 0.5,
        stamina_weight: 0.5,
        physical_capabilities: '',
        preferred_intensity: 'Medium',
        education: '',
        experience: '',
        projects: '',
        certifications: '',
        awards: '',
        auto_generate_resume: false,
        pwd_id_reference: ''
    });
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
    const [expandedSection, setExpandedSection] = useState('summary');
    const [disabilityProfile, setDisabilityProfile] = useState({ disabilities: [] });
    const [educEntries, setEducEntries] = useState([]);
    const [educStructured, setEducStructured] = useState(false);

    useEffect(() => {
        if (user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setProfile({
                summary: user.summary || '',
                skills: user.skills || '',
                disabilities: user.disabilities || [],
                skill_weight: user.skill_weight || 0.5,
                safety_weight: user.safety_weight || 0.5,
                stamina_weight: user.stamina_weight || 0.5,
                physical_capabilities: user.physical_capabilities || '',
                preferred_intensity: user.preferred_intensity || 'Medium',
                education: user.education || '',
                experience: user.experience || '',
                projects: user.projects || '',
                certifications: user.certifications || '',
                awards: user.awards || '',
                auto_generate_resume: user.auto_generate_resume || false,
                pwd_id_reference: user.pwd_id_reference || ''
            });
            try {
                const dp = (typeof user.disability_profile === 'object' && user.disability_profile) || JSON.parse(user.disability_profile || '{}');
                const structured = dp && dp.disabilities ? dp : { disabilities: [] };
                // Backfill structured entries from legacy "Category: Subtype (Extent)" strings
                // so the extent/laterality UI shows even for accounts registered pre-restructure.
                const legacy = (user.disabilities || []).map(d => {
                    const m = String(d).match(/^([^:]+?):\s*(.+)$/);
                    if (!m) return null;
                    const em = m[2].match(/^(.+?)\s*\((.*)\)$/);
                    return em
                        ? { category: m[1].trim(), subtype: em[1].trim(), extent: em[2].trim() }
                        : { category: m[1].trim(), subtype: m[2].trim(), extent: '' };
                }).filter(Boolean);
                for (const entry of legacy) {
                    if (!structured.disabilities.some(d => d.category === entry.category && d.subtype === entry.subtype)) {
                        structured.disabilities.push(entry);
                    }
                }
                setDisabilityProfile(structured);
            } catch {
                setDisabilityProfile({ disabilities: [] });
            }
            try {
                const ed = JSON.parse(user.education || '[]');
                if (Array.isArray(ed)) {
                    setEducEntries(ed);
                    setEducStructured(true);
                }
            } catch {
                setEducStructured(false);
            }
        }
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        setSaveStatus(null);
        try {
            const res = await axios.put(`${API_BASE_URL}/pwd/profile`, {
                ...profile,
                disability_profile: JSON.stringify(disabilityProfile),
                education: educStructured ? JSON.stringify(educEntries) : profile.education
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            login(token, res.data.user || res.data); // Update user in context
            setSaveStatus('success');
            toast.success("Profile saved successfully!");
            setTimeout(() => setSaveStatus(null), 3000);
        } catch (err) {
            setSaveStatus('error');
            toast.error("Failed to save profile: " + (err.response?.data?.detail || "Unknown error"));
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateResume = async () => {
        setGeneratingResume(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/resume/generate`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                setResumePdf(res.data.resume_base64);
                setShowResumePreview(true);
                toast.success('Resume generated successfully!');
            } else {
                toast.error('Failed to generate resume: ' + (res.data.error || 'Unknown error'));
            }
        } catch {
            toast.error('Failed to generate resume. Please ensure your profile has sufficient data.');
        } finally {
            setGeneratingResume(false);
        }
    };

    const handleDohVerify = async () => {
        if (!pwdIdNumber.trim()) {
            toast.error("Please enter your PWD ID Number");
            return;
        }
        setScanning(true);
        setScanResult(null);
        try {
            const res = await axios.post(`${API_BASE_URL}/pwd/verify-doh`, {
                pwd_id_number: pwdIdNumber
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.data.success) {
                setScanResult(res.data);
                setShowScanModal(true);
                toast.success('PWD ID verified successfully against DOH registry!');
            } else {
                toast.error(res.data.message || 'ID not found in DOH PRPWD National Registry.');
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'DOH Registry check failed. Please check the ID format and try again.');
        } finally {
            setScanning(false);
        }
    };

    const acceptScanResult = () => {
        if (!scanResult) return;
        const sd = scanResult.scanned_data;
        const disabilityStr = `${sd.disability_type}: ${sd.disability_subtype}`;
        setProfile(prev => {
            const existing = prev.disabilities || [];
            if (!existing.includes(disabilityStr)) {
                return { ...prev, disabilities: [...existing, disabilityStr], pwd_id_reference: sd.pwd_id_reference || '' };
            }
            return { ...prev, pwd_id_reference: sd.pwd_id_reference || '' };
        });
        setShowScanModal(false);
    };

    const toggleDisability = (cat, sub) => {
        const item = `${cat}: ${sub}`;
        const isOther = sub === 'Other';
        const otherPrefix = `${cat}: Other`;

        setProfile(prev => {
            const exists = isOther 
                ? prev.disabilities.some(d => d === item || d.startsWith(`${otherPrefix} (`))
                : prev.disabilities.includes(item);

            if (exists) {
                return {
                    ...prev,
                    disabilities: prev.disabilities.filter(d => 
                        isOther ? (!d.startsWith(otherPrefix)) : d !== item
                    )
                };
            } else {
                return {
                    ...prev,
                    disabilities: [...prev.disabilities, item]
                };
            }
        });

        setDisabilityProfile(prev => {
            const exists = (prev.disabilities || []).some(d => d.category === cat && d.subtype === sub);
            const next = exists
                ? (prev.disabilities || []).filter(d => !(d.category === cat && d.subtype === sub))
                : [...(prev.disabilities || []), { category: cat, subtype: sub, extent: '', laterality: '' }];
            return { disabilities: next };
        });
    };

    const updateDisabilityEntry = (cat, sub, patch) => {
        setDisabilityProfile(prev => ({
            disabilities: (prev.disabilities || []).map(d =>
                d.category === cat && d.subtype === sub ? { ...d, ...patch } : d
            )
        }));
        // keep legacy labels in sync so the matcher's legacy path still works
        setProfile(prev => {
            const entry = disabilityProfile.disabilities.find(d => d.category === cat && d.subtype === sub);
            const base = `${cat}: ${sub}`;
            const label = entry && entry.extent ? `${base} (${entry.extent})` : base;
            return {
                ...prev,
                disabilities: prev.disabilities.map(d =>
                    d === base || d.startsWith(`${base} (`) ? label : d
                )
            };
        });
    };

    const sections = [
        { id: 'summary', label: 'About & Capabilities', icon: <User size={20} />, field: 'summary' },
        { id: 'disability', label: 'Disability Classification', icon: <Accessibility size={20} />, field: 'disabilities' },
        { id: 'education', label: 'Education History', icon: <GraduationCap size={20} />, field: 'education' },
        { id: 'experience', label: 'Work Experience', icon: <Building2 size={20} />, field: 'experience' },
        { id: 'skills', label: 'Technical Skills', icon: <Terminal size={20} />, field: 'skills' },
        { id: 'projects', label: 'Notable Projects', icon: <Briefcase size={20} />, field: 'projects' },
        { id: 'certs', label: 'Certifications', icon: <Award size={20} />, field: 'certifications' },
        { id: 'awards', label: 'Awards & Honors', icon: <Sparkles size={20} />, field: 'awards' },
        { id: 'matching', label: 'Matching Weights (Advanced)', icon: <Sliders size={20} />, field: 'matching' }
    ];

    const isSectionComplete = (section) => {
        if (section.id === 'disability') return (profile.disabilities || []).length > 0;
        if (section.id === 'matching') return true; // has sensible defaults, no friction
        if (section.id === 'summary') {
            const summaryOk = (profile.summary?.trim() || '').length > 0;
            const capsOk = Object.values(disabilityProfile.capabilities || {}).some(v => v);
            const accOk = (disabilityProfile.accommodations || []).length > 0;
            return summaryOk || capsOk || accOk;
        }
        const complete = (profile[section.field]?.trim() || '').length > 0;
        return complete;
    };

    const handleFinishSection = (id) => {
        const idx = sections.findIndex(s => s.id === id);
        for (let i = idx + 1; i < sections.length; i++) {
            if (!isSectionComplete(sections[i])) {
                setExpandedSection(sections[i].id);
                return;
            }
        }
        setExpandedSection(null);
    };

    const [showResumeModal, setShowResumeModal] = useState(false);
    const [parsedData, setParsedData] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [generatingResume, setGeneratingResume] = useState(false);
    const [resumePdf, setResumePdf] = useState(null);
    const [showResumePreview, setShowResumePreview] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);
    const [showScanModal, setShowScanModal] = useState(false);
    const [pwdIdNumber, setPwdIdNumber] = useState('');

    const handleResumeUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset file input so re-uploading the same file triggers change
        e.target.value = '';

        setIsParsing(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post(`${API_BASE_URL}/resume/parse`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.data && res.data.success && res.data.data) {
                const extracted = res.data.data;
                setParsedData({
                    education: extracted.education || '',
                    experience: extracted.experience || '',
                    skills: extracted.skills || '',
                    summary: extracted.summary || ''
                });
                setShowResumeModal(true);
                toast.success('Resume parsed successfully with pydparser!');
            } else {
                toast.error('Could not extract data from the uploaded resume.');
            }
        } catch (err) {
            console.error('Resume parsing failed', err);
            const msg = err.response?.data?.detail || err.message || 'Failed to parse resume.';
            toast.error(msg);
        } finally {
            setIsParsing(false);
        }
    };

    const applyParsedData = () => {
        setProfile(prev => ({
            ...prev,
            ...parsedData
        }));
        setShowResumeModal(false);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20">
            {/* Resume Upload Modal */}
            <AnimatePresence>
                {showResumeModal && (
                    <ResumeParseModal 
                        data={parsedData} 
                        onClose={() => setShowResumeModal(false)} 
                        onConfirm={applyParsedData}
                    />
                )}
                {showResumePreview && resumePdf && (
                    <ResumePreviewModal 
                        base64={resumePdf}
                        onClose={() => setShowResumePreview(false)}
                    />
                )}
                {showScanModal && scanResult && (
                    <ScanResultModal
                        data={scanResult}
                        onClose={() => setShowScanModal(false)}
                        onConfirm={acceptScanResult}
                    />
                )}
            </AnimatePresence>

            <div className="max-w-[1400px] mx-auto px-6 pt-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    
                    {/* Sidebar: Progressive Navigator */}
                    <div className="lg:col-span-3">
                        <div className="sticky top-12 space-y-6">
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                                <div className="flex flex-col items-center text-center mb-8">
                                    <div className="w-24 h-24 bg-slate-100 rounded-[2rem] overflow-hidden mb-6 border-4 border-white shadow-lg shadow-slate-200">
                                        <img 
                                            src={`https://ui-avatars.com/api/?name=${user?.name}&background=6366f1&color=fff&size=128`} 
                                            alt="Profile" 
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 leading-tight">{user?.name}</h2>
                                    <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-2">{user?.role}</p>
                                    
                                    <div className="mt-6 w-full">
                                        <input 
                                            type="file" 
                                            id="resume-upload" 
                                            className="hidden" 
                                            accept=".pdf,.doc,.docx,.txt"
                                            onChange={handleResumeUpload}
                                        />
                                        <label 
                                            htmlFor="resume-upload"
                                            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-all ${isParsing ? 'animate-pulse' : ''}`}
                                        >
                                            {isParsing ? 'AI Parsing...' : <><Plus size={14}/> Import Resume</>}
                                        </label>
                                    </div>

                                    <div className="mt-6 w-full border-t border-slate-100 pt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                                <FileText size={12}/> ATS Resume
                                            </span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={profile.auto_generate_resume}
                                                    onChange={(e) => setProfile(prev => ({ ...prev, auto_generate_resume: e.target.checked }))}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                        <button
                                            onClick={handleGenerateResume}
                                            disabled={generatingResume}
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-50"
                                        >
                                            {generatingResume ? 'Generating...' : <><FileText size={14}/> Preview Resume</>}
                                        </button>
                                    </div>

                                    <div className="mt-6 w-full border-t border-slate-100 pt-6">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
                                            <Accessibility size={12}/> PWD ID DOH Registry Verification
                                        </span>
                                        <div className="space-y-3">
                                            <input 
                                                type="text"
                                                value={pwdIdNumber}
                                                onChange={(e) => setPwdIdNumber(e.target.value)}
                                                placeholder="RR-PPMM-BBB-NNNNNNN"
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-slate-700 placeholder:text-slate-350 focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-xs font-bold"
                                                disabled={scanning}
                                            />
                                            <button 
                                                onClick={handleDohVerify}
                                                disabled={scanning}
                                                className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600 text-white text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-green-700 transition-all ${scanning ? 'animate-pulse' : ''}`}
                                            >
                                                {scanning ? 'Verifying DOH Registry...' : <><Accessibility size={14}/> Verify via DOH Registry</>}
                                            </button>
                                        </div>
                                        {scanResult && (
                                            <p className="text-[9px] text-green-600 font-medium text-center mt-2">DOH Record Found. Open modal to apply.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {sections.map(s => (
                                        <button 
                                            key={s.id}
                                            onClick={() => setExpandedSection(s.id)}
                                            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${expandedSection === s.id ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${expandedSection === s.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-50'}`}>
                                                    {s.icon}
                                                </div>
                                                <span className="text-[11px] font-black uppercase tracking-widest">{s.label}</span>
                                            </div>
                                            {isSectionComplete(s) && <CheckCircle2 size={14} className="text-emerald-500" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button 
                                onClick={handleSave}
                                disabled={saving}
                                className={`w-full flex items-center justify-center gap-3 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl ${saving ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100 hover:-translate-y-1'}`}
                            >
                                {saving ? 'Syncing...' : <><Save size={18}/> Update Profile</>}
                            </button>
                            
                            {saveStatus === 'success' && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-xs bg-emerald-50 py-3 rounded-2xl border border-emerald-100">
                                    <CheckCircle2 size={16} /> Changes Synchronized
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Main Content: Progressive Accordion */}
                    <div className="lg:col-span-9 space-y-4">
                        <div className="flex items-center justify-between mb-8 px-4">
                            <div>
                                <h1 className="text-4xl font-black text-slate-800 tracking-tight">Complete your Profile</h1>
                                <p className="text-slate-400 font-medium mt-2">Personalize your data for better AI job matching.</p>
                            </div>
                            <button 
                                onClick={() => navigate('/dashboard')}
                                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-xs text-slate-500 hover:bg-slate-100 transition-all border border-slate-200"
                            >
                                <LayoutDashboard size={16} /> Exit to Dashboard
                            </button>
                        </div>

                        <div className="space-y-4">
                            {sections.map((section) => (
                                <ExpansionPanel 
                                    key={section.id}
                                    section={section}
                                    isOpen={expandedSection === section.id}
                                    onToggle={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                                    onFinish={handleFinishSection}
                                    profile={profile}
                                    setProfile={setProfile}
                                    toggleDisability={toggleDisability}
                                    updateDisabilityEntry={updateDisabilityEntry}
                                    disabilityProfile={disabilityProfile}
                                    setDisabilityProfile={setDisabilityProfile}
                                    educEntries={educEntries}
                                    setEducEntries={setEducEntries}
                                    educStructured={educStructured}
                                    setEducStructured={setEducStructured}
                                    API_BASE_URL={API_BASE_URL}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SuggestionChips = ({ onSelect, suggestions }) => (
    <div className="flex flex-wrap gap-2 mb-4">
        {suggestions.map(s => (
            <button
                key={s}
                onClick={() => onSelect(s)}
                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
            >
                + {s}
            </button>
        ))}
    </div>
);

const ExpansionPanel = ({ section, isOpen, onToggle, onFinish, profile, setProfile, toggleDisability, updateDisabilityEntry, disabilityProfile, setDisabilityProfile, educEntries, setEducEntries, educStructured, setEducStructured, API_BASE_URL }) => {
    const isComplete = Array.isArray(profile[section.field]) 
        ? (profile[section.field] || []).length > 0 
        : (profile[section.field]?.trim() || '').length > 0;

    const appendSuggestion = (field, value) => {
        setProfile(prev => {
            const current = prev[field] || '';
            const separator = current.trim().length > 0 ? (field === 'skills' ? ', ' : '. ') : '';
            return { ...prev, [field]: current.trim() + separator + value };
        });
    };
    
    return (
        <div className={`bg-white rounded-[2.5rem] border-2 transition-all overflow-hidden ${isOpen ? 'border-blue-500 shadow-lg shadow-blue-50/60' : 'border-transparent shadow-sm hover:border-slate-200'}`}>
            <button 
                onClick={onToggle}
                className={`w-full flex items-center justify-between p-8 text-left transition-colors ${isOpen ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}
            >
                <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isOpen ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'bg-slate-50 text-slate-400'}`}>
                        {section.icon}
                    </div>
                    <div>
                        <h3 className={`text-xl font-black transition-colors ${isOpen ? 'text-blue-600' : 'text-slate-800'}`}>{section.label}</h3>
                        {!isOpen && (
                            <p className="text-slate-400 text-xs font-medium mt-1 truncate max-w-[400px]">
                                {profile[section.field] 
                                    ? (Array.isArray(profile[section.field]) 
                                        ? profile[section.field].join(', ') 
                                        : profile[section.field]).substring(0, 80) + (profile[section.field].length > 80 ? '...' : '') 
                                    : `No ${section.label.toLowerCase()} added yet.`}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {isComplete && !isOpen && <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">Complete</div>}
                    <ChevronRight size={20} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-90 text-blue-600' : ''}`} />
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                    >
                        <div className="p-8 pt-4 border-t border-slate-50 space-y-8">
                            {section.id === 'summary' && (
                                <>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Professional Summary</label>
                                            <span className="text-[9px] text-slate-300 font-bold">QUICK TAGS</span>
                                        </div>
                                        <SuggestionChips suggestions={QUICK_SUGGESTIONS.summary} onSelect={(v) => appendSuggestion('summary', v)} />
                                        <textarea 
                                            value={profile.summary}
                                            onChange={(e) => setProfile(prev => ({ ...prev, summary: e.target.value }))}
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-8 text-slate-700 placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none transition-all min-h-[200px] text-lg leading-relaxed shadow-inner"
                                            placeholder="Tell us about your career goals..."
                                        />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Capability Adjustments</label>
                                            <span className="text-[9px] text-slate-300 font-bold">OVERRIDES THE AUTO PRESET</span>
                                        </div>
                                        <p className="text-xs font-medium text-slate-400">
                                            Your disability preset estimates these automatically. Adjust them if they don't match how you actually work — the matcher compares these levels against job demands, never your disability label.
                                        </p>
                                        <CapabilityAdjusters
                                            caps={disabilityProfile.capabilities || {}}
                                            onChange={(caps) => setDisabilityProfile(prev => ({ ...prev, capabilities: caps }))}
                                        />
                                    </div>
                                </>
                            )}

                            {section.id === 'disability' && (
                                <div className="space-y-4">
                                    <p className="text-xs font-medium text-slate-400">
                                        Tell us about your disability in your own words — used only for workplace accommodation planning, never for ranking.
                                    </p>
                                    <DisabilityWizard
                                        profile={profile}
                                        setProfile={setProfile}
                                        disabilityProfile={disabilityProfile}
                                        setDisabilityProfile={setDisabilityProfile}
                                        toggleDisability={toggleDisability}
                                        updateDisabilityEntry={updateDisabilityEntry}
                                    />
                                </div>
                            )}

                            {section.id === 'matching' && (
                                <div className="space-y-6">
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Sliders size={14} className="text-slate-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Advanced — Technical</span>
                                        </div>
                                        <p className="text-xs font-medium text-slate-400 leading-relaxed">
                                            These weights tune how much each signal contributes to your match score. The defaults are calibrated for fairness across all groups — leave them as-is unless you know what you're doing.
                                        </p>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-8">
                                        <WeightSlider label="Skill Alignment" value={profile.skill_weight} onChange={(v) => setProfile(prev => ({ ...prev, skill_weight: v }))} />
                                        <WeightSlider label="Workplace Safety" value={profile.safety_weight} onChange={(v) => setProfile(prev => ({ ...prev, safety_weight: v }))} />
                                        <WeightSlider label="Daily Stamina" value={profile.stamina_weight} onChange={(v) => setProfile(prev => ({ ...prev, stamina_weight: v }))} />
                                    </div>
                                </div>
                            )}

                            {section.id === 'education' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Education History</label>
                                        {!educStructured && (
                                            <button
                                                onClick={() => setEducStructured(true)}
                                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold border border-blue-100 hover:bg-blue-600 hover:text-white transition-all"
                                            >
                                                Convert to Structured Form
                                            </button>
                                        )}
                                    </div>
                                    {educStructured ? (
                                        <EducationEditor
                                            entries={educEntries}
                                            onChange={(entries) => {
                                                setEducEntries(entries);
                                                setProfile(prev => ({ ...prev, education: JSON.stringify(entries) }));
                                            }}
                                            API_BASE_URL={API_BASE_URL}
                                        />
                                    ) : (
                                        <p className="text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                            Free-form education text is accepted, but the structured form (by school level, with verified Philippine schools) gives the matcher a fair baseline. Click "Convert to Structured Form" to switch.
                                        </p>
                                    )}
                                </div>
                            )}

                            {['experience', 'skills', 'projects', 'certs', 'awards'].includes(section.id) && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{section.label} Details</label>
                                        <span className="text-[9px] text-slate-300 font-bold">QUICK TAGS</span>
                                    </div>
                                    <SuggestionChips 
                                        suggestions={QUICK_SUGGESTIONS[section.field === 'certifications' ? 'certifications' : (section.field || section.id)] || []} 
                                        onSelect={(v) => appendSuggestion(section.field, v)} 
                                    />
                                    <textarea 
                                        value={profile[section.field]}
                                        onChange={(e) => setProfile(prev => ({ ...prev, [section.field]: e.target.value }))}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-8 text-slate-700 placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none transition-all min-h-[300px] text-lg leading-relaxed shadow-inner"
                                        placeholder={`Describe your ${section.label.toLowerCase()} in detail...`}
                                    />
                                </div>
                            )}
                            
                            <div className="flex justify-end pt-4">
                                <button 
                                    onClick={() => onFinish(section.id)}
                                    className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all"
                                >
                                    Save & Continue
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};



const CAPABILITY_DIMENSIONS = [
    { key: 'fine_motor', label: 'Fine Motor Dexterity', options: ['Low', 'Medium', 'High'] },
    { key: 'physical', label: 'Physical Exertion', options: ['Low', 'Medium', 'High'] },
    { key: 'cognitive', label: 'Cognitive Load', options: ['Low', 'Medium', 'High'] },
    { key: 'sensory', label: 'Sensory Stimulation', options: ['Low', 'Medium', 'High'] },
    { key: 'social', label: 'Social Interaction', options: ['Minimal', 'Moderate', 'High'] },
    { key: 'visual', label: 'Visual Demand', options: ['Low', 'Medium', 'High'] },
    { key: 'auditory', label: 'Auditory Demand', options: ['Low', 'Medium', 'High'] },
    { key: 'energy', label: 'Energy & Pace', options: ['Low', 'Medium', 'High'] },
    { key: 'preferred_intensity', label: 'Preferred Task Intensity', options: ['Low', 'Medium', 'High'] }
];

const CapabilityAdjusters = ({ caps, onChange }) => {
    const setCap = (key, value) => {
        const next = { ...caps };
        if (value === '') delete next[key];
        else next[key] = value;
        onChange(next);
    };
    return (
        <div className="grid md:grid-cols-2 gap-4">
            {CAPABILITY_DIMENSIONS.map(dim => (
                <div key={dim.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500">{dim.label}</span>
                    <select
                        value={caps[dim.key] || ''}
                        onChange={(e) => setCap(dim.key, e.target.value)}
                        className={`bg-white border rounded-xl px-3 py-2 text-[10px] font-black focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all ${caps[dim.key] ? 'border-blue-300 text-blue-600' : 'border-slate-100 text-slate-400'}`}
                    >
                        <option value="">Auto</option>
                        {dim.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
            ))}
        </div>
    );
};

const AccommodationManager = ({ items, onChange }) => {
    const [text, setText] = useState('');
    const addItem = () => {
        const v = text.trim();
        if (!v) return;
        onChange([...items, v]);
        setText('');
    };
    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                    placeholder="e.g. Screen reader, Ergonomic chair, Flexible breaks..."
                    className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                />
                <button
                    onClick={addItem}
                    className="px-6 py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                    <Plus size={16} />
                </button>
            </div>
            {items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {items.map((item, i) => (
                        <span key={i} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[11px] font-bold border border-blue-100">
                            {item}
                            <button onClick={() => onChange(items.filter((_, xi) => xi !== i))} className="text-blue-300 hover:text-rose-500 transition-colors" aria-label={`Remove ${item}`}>
                                <Trash2 size={13} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

const CATEGORY_META = {
    'Physical': { desc: 'Mobility, limb, and motor conditions' },
    'Visual': { desc: 'Blindness and vision impairments' },
    'Hearing': { desc: 'Deafness and hearing impairments' },
    'Learning': { desc: 'Neurodevelopmental differences (autism, ADHD, dyslexia)' },
    'Intellectual': { desc: 'Cognitive and developmental conditions' },
    'Psychosocial': { desc: 'Mental health conditions' },
    'Chronic_Illness': { desc: 'Long-term health conditions' }
};

const DISABILITY_STEPS = ['Category', 'Subtype', 'Accommodations'];

const DisabilityWizard = ({ profile, setProfile, disabilityProfile, setDisabilityProfile, toggleDisability, updateDisabilityEntry }) => {
    const [step, setStep] = useState(1);
    const [activeCat, setActiveCat] = useState(null);
    const [addedCats, setAddedCats] = useState([]);

    const countFor = (cat) => (profile.disabilities || []).filter(d => String(d).startsWith(`${cat}: `)).length;
    const savedFor = (cat) => (profile.disabilities || []).filter(d => String(d).startsWith(`${cat}: `)).length > 0;
    const doneWithCat = (cat) => {
        if (cat && !addedCats.includes(cat)) setAddedCats(prev => [...prev, cat]);
        setStep(1);
        setActiveCat(null);
    };
    const removeCat = (cat) => {
        setProfile(prev => ({
            ...prev,
            disabilities: (prev.disabilities || []).filter(d => !String(d).startsWith(`${cat}: `))
        }));
        setDisabilityProfile(prev => ({
            ...prev,
            disabilities: (prev.disabilities || []).filter(d => d.category !== cat)
        }));
        setAddedCats(prev => prev.filter(c => c !== cat));
    };

    return (
        <div className="space-y-5">
            {/* Step progress */}
            <div className="flex items-center gap-2">
                {DISABILITY_STEPS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${i + 1 < step ? 'bg-emerald-500 text-white' : i + 1 === step ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${i + 1 === step ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
                        {i < DISABILITY_STEPS.length - 1 && <div className={`w-5 h-0.5 rounded ${i + 1 < step ? 'bg-emerald-400' : 'bg-slate-100'}`} />}
                    </div>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div key="cat" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }} className="grid md:grid-cols-2 gap-3">
                        {Object.keys(SUB_CATEGORIES).map(cat => {
                            const n = countFor(cat);
                            const saved = addedCats.includes(cat) || savedFor(cat);
                            return (
                                <div key={cat} role="button" tabIndex={0} onClick={() => { setActiveCat(cat); setStep(2); }} onKeyDown={(e) => e.key === 'Enter' && setStep(2)}
                                    className={`p-5 text-left rounded-2xl border-2 transition-all cursor-pointer ${saved ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300' : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-sm font-black ${saved ? 'text-emerald-700' : 'text-slate-700'}`}>{cat === 'Chronic_Illness' ? 'Chronic Illness' : cat}</span>
                                        {saved ? (
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-1.5">
                                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                                    {n > 0 && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black">{n}</span>}
                                                </div>
                                                <button type="button" onClick={(e) => { e.stopPropagation(); removeCat(cat); }}
                                                    className="text-[8px] font-black uppercase tracking-widest text-slate-300 hover:text-rose-400 transition-colors">Remove</button>
                                            </div>
                                        ) : <ArrowRight size={16} className="text-slate-300" />}
                                    </div>
                                    <p className="text-[11px] font-medium text-slate-400">{CATEGORY_META[cat]?.desc}</p>
                                </div>
                            );
                        })}
                        {profile.disabilities.length > 0 && (
                            <div className="md:col-span-2 flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{profile.disabilities.length} selected in total</span>
                                <button onClick={() => setStep(3)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
                                    Review Accommodations
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {step === 2 && activeCat && (
                    <motion.div key="sub" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <button onClick={() => { setStep(1); setActiveCat(null); }} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                                <ArrowLeft size={14} /> Categories
                            </button>
                            <span className="text-sm font-black text-slate-700">{activeCat === 'Chronic_Illness' ? 'Chronic Illness' : activeCat}</span>
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{countFor(activeCat)} Selected</span>
                        </div>
                        <div className="p-6 bg-white rounded-2xl border border-slate-100">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {SUB_CATEGORIES[activeCat].map((sub, i) => {
                                    const isOther = sub === 'Other';
                                    const otherPrefix = `${activeCat}: Other`;
                                    const activeItem = (profile.disabilities || []).find(d => d === `${activeCat}: ${sub}` || d.startsWith(`${otherPrefix} (`));
                                    const active = !!activeItem;
                                    const structuredEntry = (disabilityProfile.disabilities || []).find(d => d.category === activeCat && d.subtype === sub);

                                    return (
                                        <motion.div key={sub} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="min-w-0">
                                            <button
                                                onClick={() => toggleDisability(activeCat, sub)}
                                                className={`w-full py-3 px-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 border-2 flex items-center justify-center gap-1.5 ${active ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-600'}`}
                                            >
                                                {sub}
                                                {active && <CheckCircle2 size={12} className="shrink-0" />}
                                            </button>
                                            <AnimatePresence initial={false}>
                                                {active && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                                                        <div className="pt-2.5 space-y-2">
                                                            {isOther ? (
                                                                <input
                                                                    type="text"
                                                                    placeholder="Please specify..."
                                                                    value={activeItem.includes('(') ? activeItem.match(/\((.*)\)/)[1] : ''}
                                                                    onChange={(e) => {
                                                                        const newValue = e.target.value;
                                                                        setProfile(prev => ({
                                                                            ...prev,
                                                                            disabilities: prev.disabilities.map(d =>
                                                                                d === activeItem ? `${activeCat}: Other (${newValue})` : d
                                                                            )
                                                                        }));
                                                                    }}
                                                                    className="w-full bg-blue-50/60 border border-blue-200 rounded-xl px-3 py-2 text-[10px] font-bold text-blue-700 placeholder:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                                />
                                                            ) : (
                                                                <>
                                                                    <select
                                                                        value={structuredEntry?.extent || ''}
                                                                        onChange={(e) => updateDisabilityEntry(activeCat, sub, { extent: e.target.value })}
                                                                        className="w-full bg-blue-50/60 border border-blue-200 rounded-xl px-3 py-2 text-[10px] font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                                    >
                                                                        <option value="">Extent...</option>
                                                                        {(EXTENT_OPTIONS[sub] || EXTENT_OPTIONS.default).map(o => <option key={o} value={o}>{o}</option>)}
                                                                    </select>
                                                                    {activeCat === 'Physical' && LATERALITY_SUBTYPES.includes(sub) && (
                                                                        <select
                                                                            value={structuredEntry?.laterality || ''}
                                                                            onChange={(e) => updateDisabilityEntry(activeCat, sub, { laterality: e.target.value })}
                                                                            className="w-full bg-blue-50/60 border border-blue-200 rounded-xl px-3 py-2 text-[10px] font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                                        >
                                                                            <option value="">Side...</option>
                                                                            {['Left', 'Right', 'Both'].map(o => <option key={o} value={o}>{o}</option>)}
                                                                        </select>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={() => setStep(3)}
                                disabled={countFor(activeCat) === 0}
                                className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Next: Accommodations <ArrowRight size={14} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div key="ctx" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <button onClick={() => { setStep(1); setActiveCat(null); }} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                                <ArrowLeft size={14} /> Categories
                            </button>
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{profile.disabilities.length} Selected</span>
                        </div>
                        {profile.disabilities.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {(profile.disabilities || []).map(d => (
                                    <span key={d} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-bold border border-blue-100">{d}</span>
                                ))}
                            </div>
                        )}
                        <div className="p-5 bg-white rounded-2xl border border-slate-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Workplace Accommodations</label>
                            </div>
                            <AccommodationManager
                                items={disabilityProfile.accommodations || []}
                                onChange={(items) => setDisabilityProfile(prev => ({ ...prev, accommodations: items }))}
                            />
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <button onClick={() => { setStep(1); setActiveCat(null); }} className="px-6 py-3 border-2 border-emerald-600 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center gap-2">
                                <Plus size={14} /> Add Another Entry
                            </button>
                            <button onClick={() => { doneWithCat(activeCat); }} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2">
                                Complete <CheckCircle2 size={14} />
                            </button>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 text-center">That's everything — select Complete, or add another entry if you have one. You can also do this anytime from your profile.</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const toMonthValue = (v) => {
    if (!v) return '';
    if (/^\d{4}$/.test(v)) return `${v}-01`;
    if (/^\d{4}-\d{2}$/.test(v)) return v;
    return '';
};

const isPresent = (v) => !v || !/^\d{4}(-\d{2})?$/.test(v);

const currentMonth = () => new Date().toISOString().slice(0, 7);

const EducationEditor = ({ entries, onChange, API_BASE_URL }) => {
    const updateEntry = (i, patch) => onChange(entries.map((e, xi) => xi === i ? { ...e, ...patch } : e));
    return (
        <div className="space-y-4">
            {entries.map((en, i) => (
                <div key={i} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <select
                            value={en.level || 'College'}
                            onChange={(e) => updateEntry(i, { level: e.target.value })}
                            className="bg-white border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        >
                            {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        {entries.length > 1 && (
                            <button onClick={() => onChange(entries.filter((_, xi) => xi !== i))} className="text-rose-400 hover:text-rose-600 transition-colors" aria-label="Remove education entry">
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                    <SchoolAutocomplete
                        value={en.institution || ''}
                        onChange={(v) => updateEntry(i, { institution: v })}
                        level={['College', 'Masteral/Doctoral'].includes(en.level) ? 'Tertiary' : 'Basic'}
                        API_BASE_URL={API_BASE_URL}
                    />
                    {['College', 'Masteral/Doctoral'].includes(en.level) && (
                        <div className="grid grid-cols-2 gap-3">
                            <input type="text" value={en.degree || ''} onChange={(e) => updateEntry(i, { degree: e.target.value })}
                                className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="Degree (e.g. BS Computer Science)" />
                            <input type="text" value={en.area || ''} onChange={(e) => updateEntry(i, { area: e.target.value })}
                                className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="Area of study (optional)" />
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">Start</label>
                            <input type="month" value={toMonthValue(en.start_date)} onChange={(e) => updateEntry(i, { start_date: e.target.value })}
                                className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">End</label>
                            <input type="month" value={isPresent(en.end_date) ? '' : toMonthValue(en.end_date)} disabled={isPresent(en.end_date)}
                                onChange={(e) => updateEntry(i, { end_date: e.target.value })}
                                className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-300" />
                            <label className="flex items-center gap-1.5 pl-1 text-[10px] font-bold text-slate-400 cursor-pointer select-none">
                                <input type="checkbox" className="accent-blue-600" checked={isPresent(en.end_date)}
                                    onChange={(e) => updateEntry(i, { end_date: e.target.checked ? '' : currentMonth() })} />
                                Present / currently attending
                            </label>
                        </div>
                    </div>
                </div>
            ))}
            <button
                onClick={() => onChange([...entries, { level: 'College', institution: '', degree: '', area: '', start_date: '', end_date: '' }])}
                className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
            >
                <Plus size={14} /> Add Education Entry
            </button>
        </div>
    );
};

const SchoolAutocomplete = ({ value, onChange, level, API_BASE_URL }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [focused, setFocused] = useState(false);
    const [query, setQuery] = useState(value);

    useEffect(() => {
        if (!query.trim() || query.trim().length < 2) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSuggestions([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/schools`, {
                    params: { q: query.trim(), level }
                });
                setSuggestions(res.data.schools || []);
            } catch {
                setSuggestions([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query, level, API_BASE_URL]);

    return (
        <div className="relative">
            <div className="relative">
                <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} aria-hidden="true" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 150)}
                    placeholder="Search Philippine school..."
                    className="w-full bg-white border border-slate-100 rounded-xl pl-10 pr-3 py-2.5 text-xs font-bold text-slate-600 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
            </div>
            {focused && suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-2xl border border-slate-100 shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                    {suggestions.map(s => (
                        <button
                            key={`${s.name}-${s.level}`}
                            type="button"
                            onMouseDown={() => { onChange(s.name); setQuery(s.name); setFocused(false); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors text-xs font-bold text-slate-600"
                        >
                            {s.name}
                            <span className="block text-[9px] font-black uppercase tracking-widest text-slate-300">{s.city} · {s.region}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const WeightSlider = ({ label, value, onChange }) => (
    <div className="space-y-4">
        <div className="flex justify-between items-end">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
            <span className="text-lg font-black text-blue-600">{Math.round(value * 100)}%</span>
        </div>
        <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            value={value} 
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-100 rounded-full appearance-none accent-blue-600 cursor-pointer"
        />
    </div>
);


const ResumeParseModal = ({ data, onClose, onConfirm }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        >
            {/* Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-slate-800">Resume Parsed Successfully</h2>
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">85% Confidence</span>
                        </div>
                        <p className="text-slate-400 text-xs font-medium mt-1">Review the extracted information before saving to your profile.</p>
                    </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                    <Plus size={24} className="rotate-45" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* Summary */}
                <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <User size={14} /> Professional Summary
                    </label>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed">
                        {data?.summary || <span className="text-slate-400 italic">No summary generated.</span>}
                    </div>
                </div>

                {/* Education */}
                <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <GraduationCap size={14} /> Education
                    </label>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed">
                        {data?.education || <span className="text-slate-400 italic">No education history detected.</span>}
                    </div>
                </div>

                {/* Experience */}
                <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <Building2 size={14} /> Work Experience
                    </label>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                        {data?.experience || <span className="text-slate-400 italic">No prior experience listed.</span>}
                    </div>
                </div>

                {/* Skills */}
                <div className="space-y-4">
                    <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <Terminal size={14} /> Extracted Skills
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {data?.skills && data.skills.trim() ? (
                            data.skills.split(',').map(s => s.trim()).filter(Boolean).map(skill => (
                                <span key={skill} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold border border-blue-100">
                                    {skill}
                                </span>
                            ))
                        ) : (
                            <span className="text-xs text-slate-400 italic">No technical skills detected in the document.</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-slate-100 flex items-center justify-end gap-4 bg-slate-50/50">
                <button 
                    onClick={onClose}
                    className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
                >
                    Discard
                </button>
                <button 
                    onClick={onConfirm}
                    className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                >
                    Save to Profile
                </button>
            </div>
        </motion.div>
    </div>
);

const ResumePreviewModal = ({ base64, onClose }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                        <FileText size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">ATS Resume Preview</h2>
                        <p className="text-slate-400 text-xs font-medium mt-1">Your auto-generated ATS-friendly resume.</p>
                    </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                    <Plus size={24} className="rotate-45" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900 flex flex-col">
                <PDFViewer 
                    pdfData={base64}
                    fileName="UPLIFT_ATS_Resume.pdf"
                    className="w-full flex-1 min-h-[550px]"
                />
            </div>
        </motion.div>
    </div>
);

/*
 * ScanResultModal – Official POH PWD ID DOH Registry details.
 */
const ScanResultModal = ({ data, onClose, onConfirm }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden"
        >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">DOH Registry Verified</h2>
                        <p className="text-slate-400 text-xs font-medium mt-1">Official PRPWD National Database Record.</p>
                    </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                    <Plus size={24} className="rotate-45" />
                </button>
            </div>
            <div className="p-8 space-y-4">
                {data.scanned_data && Object.entries(data.scanned_data).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{key.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-bold text-slate-700 text-right">{val || "N/A"}</span>
                    </div>
                ))}
                <p className="text-[9px] text-green-600 font-medium italic mt-4">
                    Note: {data.message || 'Successfully verified against the official Department of Health National Registry.'}
                </p>
            </div>
            <div className="p-8 border-t border-slate-100 flex items-center justify-end gap-4 bg-slate-50/50">
                <button 
                    onClick={onClose}
                    className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
                >
                    Discard
                </button>
                <button 
                    onClick={onConfirm}
                    className="px-12 py-4 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-green-100 hover:bg-green-700 transition-all"
                >
                    Apply to Profile
                </button>
            </div>
        </motion.div>
    </div>
);

export default Profile;
