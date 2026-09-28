import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { 
    User, Mail, Lock, Eye, EyeOff, Accessibility, GraduationCap, 
    Terminal, ArrowRight, ArrowLeft, CheckCircle2, Plus, Trash2, 
    Sparkles, ShieldCheck, Check, AlertCircle, X, ChevronRight,
    Award, HelpCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DISABILITY_CATEGORIES = {
    'Physical': ['Wheelchair User', 'Amputee', 'Cerebral Palsy', 'Muscular Dystrophy', 'Chronic Pain', 'Other'],
    'Visual': ['Total Blindness', 'Low Vision', 'Color Blindness', 'Other'],
    'Hearing': ['Profoundly Deaf', 'Hard of Hearing', 'Auditory Processing', 'Other'],
    'Learning': ['Autism (ASD)', 'ADHD', 'Dyslexia', 'Dysgraphia', 'Other'],
    'Intellectual': ['Down Syndrome', 'Developmental Delay', 'Other'],
    'Psychosocial': ['Bipolar Disorder', 'Depression', 'Anxiety Disorder', 'PTSD', 'Schizophrenia', 'Other'],
    'Chronic_Illness': ['Cancer Patient/Survivor', 'Rare Disease', 'Speech Impairment', 'Chronic Respiratory', 'Other']
};

const CATEGORY_META = {
    'Physical': { desc: 'Mobility, limb, manual dexterity, or motor conditions', icon: '♿' },
    'Visual': { desc: 'Total blindness, low vision, or color vision differences', icon: '👁️' },
    'Hearing': { desc: 'Deafness, hard of hearing, or auditory processing conditions', icon: '🦻' },
    'Learning': { desc: 'Autism (ASD), ADHD, dyslexia, dysgraphia, or neurodiversity', icon: '🧠' },
    'Intellectual': { desc: 'Cognitive development or learning developmental conditions', icon: '💡' },
    'Psychosocial': { desc: 'Depression, anxiety disorder, PTSD, bipolar or mood differences', icon: '🌱' },
    'Chronic_Illness': { desc: 'Long-term health, respiratory, speech or systemic conditions', icon: '🩺' }
};

const EXTENT_OPTIONS = {
    'Amputee': ['Finger(s)', 'Hand', 'Forearm', 'Upper Arm', 'Leg(s)', 'Toe(s)', 'Other'],
    'default': ['Partial', 'Complete', 'One side', 'Both sides', 'Mild', 'Moderate', 'Severe', 'Other']
};

const EDUCATION_LEVELS = [
    'Senior High School',
    'College',
    'Masteral/Doctoral',
    'Vocational / Technical',
    'Junior High School',
    'Elementary'
];

const SUGGESTED_SKILLS = [
    'Microsoft Office', 'Customer Service', 'Data Entry', 'Web Development',
    'Bookkeeping', 'Graphic Design', 'Virtual Assistance', 'Copywriting',
    'Social Media Management', 'Quality Assurance', 'Technical Support', 'Project Coordination'
];

const STEPS = [
    { id: 1, title: 'Account', label: 'Credentials', icon: User, desc: 'Your login and personal information' },
    { id: 2, title: 'Disability Profile', label: 'Accommodations', icon: Accessibility, desc: 'Tailors inclusive matching and access' },
    { id: 3, title: 'Education', label: 'Academic Path', icon: GraduationCap, desc: 'Schools, degrees, and milestones' },
    { id: 4, title: 'Skills', label: 'Capabilities', icon: Terminal, desc: 'Highlight what you do best' },
    { id: 5, title: 'Review', label: 'Confirm & Launch', icon: Sparkles, desc: 'Verify details before creating account' }
];

const toMonthValue = (v) => {
    if (!v) return '';
    if (/^\d{4}$/.test(v)) return `${v}-01`;
    if (/^\d{4}-\d{2}$/.test(v)) return v;
    return '';
};

const isPresent = (v) => !v || !/^\d{4}(-\d{2})?$/.test(v);
const currentMonth = () => new Date().toISOString().slice(0, 7);

// Philippine School Autocomplete
const SchoolAutocomplete = ({ value, onChange, level, API_BASE_URL }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [focused, setFocused] = useState(false);
    const [query, setQuery] = useState(value || '');

    useEffect(() => {
        setQuery(value || '');
    }, [value]);

    useEffect(() => {
        if (!query.trim() || query.trim().length < 2) {
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
        <div className="relative w-full">
            <div className="relative">
                <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        onChange(e.target.value);
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 200)}
                    placeholder="Search Philippine school or university..."
                    className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-[#0038A8] focus:bg-white transition-all"
                    aria-label="Philippine School or Institution"
                />
            </div>
            {focused && suggestions.length > 0 && (
                <div className="absolute z-30 mt-2 w-full bg-white rounded-2xl border border-slate-200 shadow-2xl max-h-56 overflow-y-auto custom-scrollbar">
                    {suggestions.map((s, idx) => (
                        <button
                            key={`${s.name}-${s.level}-${idx}`}
                            type="button"
                            onMouseDown={() => {
                                onChange(s.name);
                                setQuery(s.name);
                                setFocused(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50/80 border-b border-slate-50 last:border-none transition-colors"
                        >
                            <p className="text-sm font-bold text-slate-800">{s.name}</p>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{s.city} · {s.region} {s.level ? `(${s.level})` : ''}</p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const Register = () => {
    const navigate = useNavigate();
    const { login, API_BASE_URL } = useAuth();

    // Step state (1 to 5, and 6 is success)
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Step 1: Account Info
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Step 2: Disability Profile
    const [regDisabilities, setRegDisabilities] = useState([]);
    const [activeCategory, setActiveCategory] = useState(null);

    // Step 3: Education
    const [regEducation, setRegEducation] = useState([
        { level: 'College', institution: '', degree: '', area: '', start_date: '', end_date: '' }
    ]);

    // Step 4: Skills
    const [regSkills, setRegSkills] = useState('');
    const [skillInput, setSkillInput] = useState('');

    // Password strength evaluation
    const passwordStrength = useMemo(() => {
        if (!password) return { score: 0, label: '', color: '' };
        let score = 0;
        if (password.length >= 8) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500', textColor: 'text-rose-600' };
        if (score <= 3) return { score: 2, label: 'Fair', color: 'bg-amber-500', textColor: 'text-amber-600' };
        return { score: 3, label: 'Strong', color: 'bg-emerald-500', textColor: 'text-emerald-600' };
    }, [password]);

    // Skills array conversion for interactive tags
    const skillsList = useMemo(() => {
        return regSkills
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
    }, [regSkills]);

    const addSkill = (skillToAdd) => {
        const trimmed = skillToAdd.trim();
        if (!trimmed) return;
        if (!skillsList.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
            const updated = skillsList.length > 0 ? `${skillsList.join(', ')}, ${trimmed}` : trimmed;
            setRegSkills(updated);
        }
        setSkillInput('');
    };

    const removeSkill = (skillToRemove) => {
        const filtered = skillsList.filter(s => s.toLowerCase() !== skillToRemove.toLowerCase());
        setRegSkills(filtered.join(', '));
    };

    // Disability handlers
    const toggleDisability = (category, subtype) => {
        setRegDisabilities(prev => {
            const exists = prev.some(d => d.category === category && d.subtype === subtype);
            if (exists) {
                return prev.filter(d => !(d.category === category && d.subtype === subtype));
            } else {
                return [...prev, { category, subtype, extent: '', laterality: '' }];
            }
        });
    };

    const updateDisabilityItem = (category, subtype, patch) => {
        setRegDisabilities(prev =>
            prev.map(d => (d.category === category && d.subtype === subtype ? { ...d, ...patch } : d))
        );
    };

    const removeCategoryAll = (category) => {
        setRegDisabilities(prev => prev.filter(d => d.category !== category));
    };

    // Step Navigation validation
    const handleNext = () => {
        setError('');

        if (currentStep === 1) {
            if (!name.trim()) {
                setError('Please enter your full name.');
                return;
            }
            if (!email.trim() || !email.includes('@')) {
                setError('Please provide a valid email address.');
                return;
            }
            if (!password.trim() || password.length < 6) {
                setError('Password must be at least 6 characters long.');
                return;
            }
            setCurrentStep(2);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (currentStep === 2) {
            if (regDisabilities.length === 0) {
                setError('Please select at least one disability condition or accommodation category.');
                return;
            }
            setCurrentStep(3);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (currentStep === 3) {
            const valid = regEducation.some(en => en.institution.trim().length > 0);
            if (!valid) {
                setError('Please enter at least one educational institution or school.');
                return;
            }
            setCurrentStep(4);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (currentStep === 4) {
            if (!regSkills.trim()) {
                setError('Please add at least one technical or professional skill.');
                return;
            }
            setCurrentStep(5);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
    };

    const handleBack = () => {
        setError('');
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // Final Submission
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const payload = {
                email: email.trim(),
                password: password,
                name: name.trim(),
                role: 'user',
                disability_profile: JSON.stringify({ disabilities: regDisabilities }),
                education: JSON.stringify(regEducation),
                skills: regSkills.trim()
            };

            // 1. Create account
            await axios.post(`${API_BASE_URL}/auth/register`, payload);

            // 2. Immediate automatic login for frictionless candidate UX
            try {
                const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
                    email: email.trim(),
                    password: password
                });
                login(loginRes.data.token, loginRes.data.user);
            } catch {
                // If auto-login fails for any reason, prompt them to sign in
                setSuccessMessage('Account created! Please sign in with your new credentials.');
            }

            // 3. Move to celebration step
            setCurrentStep(6);
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration encountered an error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/70 flex flex-col font-sans selection:bg-blue-100 text-slate-800">
            {/* Top Onboarding Header */}
            <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-8 py-4 transition-all">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    <Link to="/" className="flex items-center gap-2.5 group focus:outline-none">
                        <div className="w-10 h-10 bg-[#0038A8] text-white rounded-xl flex items-center justify-center font-black shadow-md shadow-blue-900/10 group-hover:scale-105 transition-transform">
                            U
                        </div>
                        <div>
                            <span className="font-black text-xl tracking-tight text-slate-900 flex items-center gap-1.5">
                                UPLIFT <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-[#0038A8] font-black border border-blue-100">CANDIDATE</span>
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 block -mt-1">Inclusive Career Engine</span>
                        </div>
                    </Link>

                    {currentStep <= 5 && (
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                                Step <span className="text-slate-900 font-black">{currentStep}</span> of 5
                            </span>
                            <Link 
                                to="/?mode=login" 
                                className="text-xs font-bold text-slate-600 hover:text-[#0038A8] px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                                Already have an account? <span className="text-[#0038A8] font-black">Log In</span>
                            </Link>
                        </div>
                    )}
                </div>
            </header>

            {/* Stepper Progress Bar (Only during registration steps 1-5) */}
            {currentStep <= 5 && (
                <div className="bg-white border-b border-slate-100 py-3 px-4 sm:px-8">
                    <div className="max-w-4xl mx-auto">
                        {/* Progress percentage bar */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-3">
                            <motion.div 
                                className="h-full bg-[#0038A8]" 
                                initial={{ width: '20%' }}
                                animate={{ width: `${(currentStep / 5) * 100}%` }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                            />
                        </div>

                        {/* Interactive Step Nodes */}
                        <nav aria-label="Registration Progress" className="flex items-center justify-between">
                            {STEPS.map((s) => {
                                const isComplete = s.id < currentStep;
                                const isCurrent = s.id === currentStep;
                                const IconComponent = s.icon;

                                return (
                                    <div 
                                        key={s.id} 
                                        className="flex items-center gap-2 cursor-default select-none"
                                        aria-current={isCurrent ? 'step' : undefined}
                                    >
                                        <div 
                                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                                                isComplete 
                                                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' 
                                                    : isCurrent 
                                                        ? 'bg-[#0038A8] text-white shadow-md shadow-blue-200 scale-105' 
                                                        : 'bg-slate-100 text-slate-400'
                                            }`}
                                        >
                                            {isComplete ? <Check size={16} strokeWidth={3} /> : <IconComponent size={15} />}
                                        </div>
                                        <div className="hidden md:block text-left">
                                            <p className={`text-xs font-black leading-tight ${isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {s.title}
                                            </p>
                                            <p className="text-[10px] font-semibold text-slate-400">
                                                {s.label}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
                <AnimatePresence mode="wait">
                    {/* STEP 1: Account Credentials */}
                    {currentStep === 1 && (
                        <motion.section
                            key="step1"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                            className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100/60 p-6 sm:p-10"
                        >
                            <div className="max-w-xl mx-auto">
                                <div className="text-center mb-8">
                                    <div className="w-14 h-14 bg-blue-50 text-[#0038A8] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100/60">
                                        <User size={28} />
                                    </div>
                                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                        Create Your Candidate Account
                                    </h1>
                                    <p className="text-slate-500 text-sm mt-2 font-medium">
                                        Join UPLIFT to connect with verified employers and discover personalized, accessible job opportunities.
                                    </p>
                                </div>

                                <div className="space-y-5">
                                    {/* Full Name */}
                                    <div className="space-y-1.5">
                                        <label htmlFor="reg-name" className="text-xs font-black uppercase tracking-wider text-slate-600 block pl-1">
                                            Full Name <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                                            <input
                                                id="reg-name"
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="e.g. Juan dela Cruz"
                                                autoComplete="name"
                                                required
                                                className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-[#0038A8] focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-1.5">
                                        <label htmlFor="reg-email" className="text-xs font-black uppercase tracking-wider text-slate-600 block pl-1">
                                            Email Address <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                                            <input
                                                id="reg-email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="you@example.com"
                                                autoComplete="email"
                                                required
                                                className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-[#0038A8] focus:bg-white transition-all"
                                            />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between pl-1">
                                            <label htmlFor="reg-password" className="text-xs font-black uppercase tracking-wider text-slate-600 block">
                                                Password <span className="text-rose-500">*</span>
                                            </label>
                                            {password && (
                                                <span className={`text-[11px] font-black uppercase tracking-wider ${passwordStrength.textColor}`}>
                                                    Strength: {passwordStrength.label}
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                                            <input
                                                id="reg-password"
                                                type={showPassword ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="At least 6 characters"
                                                autoComplete="new-password"
                                                required
                                                className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl pl-11 pr-12 py-3.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-[#0038A8] focus:bg-white transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                        {/* Strength bar */}
                                        {password && (
                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                                                <div 
                                                    className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                                                    style={{ width: `${(passwordStrength.score / 3) * 100}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Privacy reassurance pill */}
                                    <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100/80 flex items-start gap-3">
                                        <ShieldCheck className="text-[#0038A8] shrink-0 mt-0.5" size={18} />
                                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                                            Your data is protected under Republic Act No. 10173 (Data Privacy Act of 2012). Your information is strictly utilized to match you with inclusive employment.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.section>
                    )}

                    {/* STEP 2: Disability Profile & Accommodations */}
                    {currentStep === 2 && (
                        <motion.section
                            key="step2"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                            className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100/60 p-6 sm:p-10"
                        >
                            <div className="max-w-2xl mx-auto">
                                <div className="text-center mb-8">
                                    <div className="w-14 h-14 bg-blue-50 text-[#0038A8] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100/60">
                                        <Accessibility size={28} />
                                    </div>
                                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                        Your Disability & Accessibility Profile
                                    </h1>
                                    <p className="text-slate-500 text-sm mt-2 font-medium">
                                        Select the categories and conditions that apply to you. This enables our recommendation engine to verify workplace readiness and match you with accommodating roles.
                                    </p>
                                </div>

                                {/* Categories Grid */}
                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                                            1. Select Category
                                        </span>
                                        {regDisabilities.length > 0 && (
                                            <span className="text-xs font-black px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                                                {regDisabilities.length} Condition{regDisabilities.length > 1 ? 's' : ''} Selected
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {Object.keys(DISABILITY_CATEGORIES).map((cat) => {
                                            const count = regDisabilities.filter(d => d.category === cat).length;
                                            const isActive = activeCategory === cat;
                                            const isSelected = count > 0;
                                            const meta = CATEGORY_META[cat] || { desc: '', icon: '♿' };

                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                                                    className={`p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between ${
                                                        isActive 
                                                            ? 'border-[#0038A8] bg-blue-50/40 ring-2 ring-blue-100 shadow-sm' 
                                                            : isSelected 
                                                                ? 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-400' 
                                                                : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl" role="img" aria-hidden="true">{meta.icon}</span>
                                                            <span className={`text-sm font-black ${isSelected ? 'text-emerald-800' : 'text-slate-800'}`}>
                                                                {cat === 'Chronic_Illness' ? 'Chronic Illness' : cat}
                                                            </span>
                                                        </div>
                                                        {count > 0 ? (
                                                            <span className="px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[10px] font-black">
                                                                {count}
                                                            </span>
                                                        ) : (
                                                            <ChevronRight size={16} className="text-slate-300 mt-1" />
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                                        {meta.desc}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Active Category Drill-down */}
                                <AnimatePresence mode="wait">
                                    {activeCategory && (
                                        <motion.div
                                            key={activeCategory}
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mb-6"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h2 className="text-sm font-black text-slate-900">
                                                        Specific Conditions: <span className="text-[#0038A8]">{activeCategory === 'Chronic_Illness' ? 'Chronic Illness' : activeCategory}</span>
                                                    </h2>
                                                    <p className="text-xs text-slate-500 font-medium">Select all that apply and define extent if needed.</p>
                                                </div>
                                                {regDisabilities.some(d => d.category === activeCategory) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCategoryAll(activeCategory)}
                                                        className="text-xs font-bold text-rose-500 hover:text-rose-700 hover:underline"
                                                    >
                                                        Clear {activeCategory}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {DISABILITY_CATEGORIES[activeCategory].map((sub) => {
                                                    const entry = regDisabilities.find(d => d.category === activeCategory && d.subtype === sub);
                                                    const isChecked = !!entry;

                                                    return (
                                                        <div 
                                                            key={sub}
                                                            className={`p-3.5 rounded-xl border transition-all ${
                                                                isChecked 
                                                                    ? 'bg-white border-[#0038A8] shadow-sm ring-1 ring-blue-100' 
                                                                    : 'bg-white/80 border-slate-200 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => toggleDisability(activeCategory, sub)}
                                                                    className="w-4 h-4 rounded text-[#0038A8] focus:ring-blue-500 accent-[#0038A8]"
                                                                />
                                                                <span className="text-xs font-bold text-slate-800">{sub}</span>
                                                            </label>

                                                            {/* Extent & Laterality if checked */}
                                                            {isChecked && (
                                                                <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                                                                    <div>
                                                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                                                            Extent / Severity
                                                                        </label>
                                                                        <select
                                                                            value={entry.extent}
                                                                            onChange={(e) => updateDisabilityItem(activeCategory, sub, { extent: e.target.value })}
                                                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                                        >
                                                                            <option value="">Select extent...</option>
                                                                            {(EXTENT_OPTIONS[sub] || EXTENT_OPTIONS.default).map(o => (
                                                                                <option key={o} value={o}>{o}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>

                                                                    {activeCategory === 'Physical' && ['Amputee', 'Cerebral Palsy', 'Muscular Dystrophy'].includes(sub) && (
                                                                        <div>
                                                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                                                                Side / Laterality
                                                                            </label>
                                                                            <select
                                                                                value={entry.laterality}
                                                                                onChange={(e) => updateDisabilityItem(activeCategory, sub, { laterality: e.target.value })}
                                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                                            >
                                                                                <option value="">Select side...</option>
                                                                                {['Left', 'Right', 'Both'].map(o => (
                                                                                    <option key={o} value={o}>{o}</option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Selected Badges Summary */}
                                {regDisabilities.length > 0 && (
                                    <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4">
                                        <p className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-2">
                                            Currently Added to Your Profile:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {regDisabilities.map((d) => (
                                                <span 
                                                    key={`${d.category}-${d.subtype}`}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 rounded-xl text-xs font-bold border border-emerald-200 shadow-sm"
                                                >
                                                    <span className="text-[#0038A8] font-black">{d.category}:</span> {d.subtype}
                                                    {d.extent && <span className="text-slate-400 font-semibold">({d.extent})</span>}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleDisability(d.category, d.subtype)}
                                                        className="text-slate-400 hover:text-rose-500 ml-1 transition-colors"
                                                        aria-label={`Remove ${d.subtype}`}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.section>
                    )}

                    {/* STEP 3: Education Background */}
                    {currentStep === 3 && (
                        <motion.section
                            key="step3"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                            className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100/60 p-6 sm:p-10"
                        >
                            <div className="max-w-2xl mx-auto">
                                <div className="text-center mb-8">
                                    <div className="w-14 h-14 bg-blue-50 text-[#0038A8] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100/60">
                                        <GraduationCap size={28} />
                                    </div>
                                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                        Educational Background
                                    </h1>
                                    <p className="text-slate-500 text-sm mt-2 font-medium">
                                        Add your formal schooling, degrees, or certifications. This helps match you with roles corresponding to your academic level.
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    {regEducation.map((en, i) => (
                                        <div key={i} className="p-6 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4 relative">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-6 h-6 rounded-full bg-[#0038A8] text-white flex items-center justify-center text-xs font-black">
                                                        {i + 1}
                                                    </span>
                                                    <select
                                                        value={en.level}
                                                        onChange={(e) => setRegEducation(prev => prev.map((x, idx) => idx === i ? { ...x, level: e.target.value } : x))}
                                                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                    >
                                                        {EDUCATION_LEVELS.map(l => (
                                                            <option key={l} value={l}>{l}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {regEducation.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setRegEducation(prev => prev.filter((_, idx) => idx !== i))}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                                        aria-label="Remove education entry"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* School Autocomplete */}
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block pl-1">
                                                    School / Institution Name <span className="text-rose-500">*</span>
                                                </label>
                                                <SchoolAutocomplete
                                                    value={en.institution}
                                                    onChange={(val) => setRegEducation(prev => prev.map((x, idx) => idx === i ? { ...x, institution: val } : x))}
                                                    level={['College', 'Masteral/Doctoral'].includes(en.level) ? 'Tertiary' : 'Basic'}
                                                    API_BASE_URL={API_BASE_URL}
                                                />
                                            </div>

                                            {/* Degree & Area if higher ed */}
                                            {['College', 'Masteral/Doctoral', 'Vocational / Technical'].includes(en.level) && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block pl-1">
                                                            Degree / Certificate
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={en.degree}
                                                            onChange={(e) => setRegEducation(prev => prev.map((x, idx) => idx === i ? { ...x, degree: e.target.value } : x))}
                                                            placeholder="e.g. BS Computer Science"
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block pl-1">
                                                            Major / Field of Study
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={en.area}
                                                            onChange={(e) => setRegEducation(prev => prev.map((x, idx) => idx === i ? { ...x, area: e.target.value } : x))}
                                                            placeholder="e.g. Information Technology"
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Start and End Dates */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block pl-1">
                                                        Start Date
                                                    </label>
                                                    <input
                                                        type="month"
                                                        value={toMonthValue(en.start_date)}
                                                        onChange={(e) => setRegEducation(prev => prev.map((x, idx) => idx === i ? { ...x, start_date: e.target.value } : x))}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-between pl-1">
                                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                                                            End Date
                                                        </label>
                                                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={isPresent(en.end_date)}
                                                                onChange={(e) => setRegEducation(prev => prev.map((x, idx) => idx === i ? { ...x, end_date: e.target.checked ? '' : currentMonth() } : x))}
                                                                className="rounded text-[#0038A8] focus:ring-blue-500 accent-[#0038A8]"
                                                            />
                                                            Currently Attending
                                                        </label>
                                                    </div>
                                                    <input
                                                        type="month"
                                                        value={isPresent(en.end_date) ? '' : toMonthValue(en.end_date)}
                                                        disabled={isPresent(en.end_date)}
                                                        onChange={(e) => setRegEducation(prev => prev.map((x, idx) => idx === i ? { ...x, end_date: e.target.value } : x))}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => setRegEducation(prev => [...prev, { level: 'College', institution: '', degree: '', area: '', start_date: '', end_date: '' }])}
                                        className="w-full py-3.5 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 text-xs font-black uppercase tracking-wider hover:border-[#0038A8] hover:text-[#0038A8] hover:bg-blue-50/40 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={16} /> Add Another Education Milestone
                                    </button>
                                </div>
                            </div>
                        </motion.section>
                    )}

                    {/* STEP 4: Skills & Core Competencies */}
                    {currentStep === 4 && (
                        <motion.section
                            key="step4"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                            className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100/60 p-6 sm:p-10"
                        >
                            <div className="max-w-2xl mx-auto">
                                <div className="text-center mb-8">
                                    <div className="w-14 h-14 bg-blue-50 text-[#0038A8] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100/60">
                                        <Terminal size={28} />
                                    </div>
                                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                        Skills & Core Competencies
                                    </h1>
                                    <p className="text-slate-500 text-sm mt-2 font-medium">
                                        Add your key technical proficiencies, tools, and workplace capabilities. You can type freely or click suggested skills below.
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    {/* Skills Tag Input */}
                                    <div className="space-y-2">
                                        <label htmlFor="skill-input-field" className="text-xs font-black uppercase tracking-wider text-slate-600 block pl-1">
                                            Add Skills (Press Enter or comma) <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Terminal className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                                                <input
                                                    id="skill-input-field"
                                                    type="text"
                                                    value={skillInput}
                                                    onChange={(e) => setSkillInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ',') {
                                                            e.preventDefault();
                                                            addSkill(skillInput);
                                                        }
                                                    }}
                                                    placeholder="Type a skill and press Enter (e.g. Python, Excel, Customer Support)..."
                                                    className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-[#0038A8] focus:bg-white transition-all"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => addSkill(skillInput)}
                                                className="px-5 py-3.5 bg-[#0038A8] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-blue-800 transition-all flex items-center gap-1.5 shadow-sm shadow-blue-200"
                                            >
                                                <Plus size={16} /> Add
                                            </button>
                                        </div>
                                    </div>

                                    {/* Interactive Skill Badges */}
                                    {skillsList.length > 0 && (
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                                                    Added Skills ({skillsList.length})
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setRegSkills('')}
                                                    className="text-xs font-bold text-rose-500 hover:text-rose-700"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {skillsList.map((skill) => (
                                                    <span
                                                        key={skill}
                                                        className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white text-[#0038A8] rounded-xl text-xs font-bold border border-blue-200 shadow-sm"
                                                    >
                                                        {skill}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSkill(skill)}
                                                            className="text-slate-400 hover:text-rose-500 transition-colors"
                                                            aria-label={`Remove skill ${skill}`}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Suggested Skills */}
                                    <div>
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-500 block mb-3 pl-1">
                                            Quick-Add Popular In-Demand Skills:
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {SUGGESTED_SKILLS.map((s) => {
                                                const alreadyAdded = skillsList.some(item => item.toLowerCase() === s.toLowerCase());
                                                return (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        disabled={alreadyAdded}
                                                        onClick={() => addSkill(s)}
                                                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                                            alreadyAdded
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 opacity-60 cursor-default'
                                                                : 'bg-white text-slate-700 border-slate-200 hover:border-[#0038A8] hover:text-[#0038A8] hover:bg-blue-50/50'
                                                        }`}
                                                    >
                                                        {alreadyAdded ? <Check size={14} /> : <Plus size={14} />} {s}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.section>
                    )}

                    {/* STEP 5: Review & Confirmation */}
                    {currentStep === 5 && (
                        <motion.section
                            key="step5"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                            className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100/60 p-6 sm:p-10"
                        >
                            <div className="max-w-2xl mx-auto">
                                <div className="text-center mb-8">
                                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                                        <Sparkles size={28} />
                                    </div>
                                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                                        Review Your Registration Details
                                    </h1>
                                    <p className="text-slate-500 text-sm mt-2 font-medium">
                                        Confirm your profile summary below before creating your account. You can tap "Edit" on any section to adjust your responses.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {/* Account Summary */}
                                    <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <User size={16} className="text-[#0038A8]" />
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-600">Account Details</span>
                                            </div>
                                            <p className="text-sm font-bold text-slate-900">{name}</p>
                                            <p className="text-xs font-semibold text-slate-500">{email}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            className="text-xs font-black text-[#0038A8] hover:underline"
                                        >
                                            Edit
                                        </button>
                                    </div>

                                    {/* Disability Summary */}
                                    <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start justify-between">
                                        <div className="flex-1 pr-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Accessibility size={16} className="text-[#0038A8]" />
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-600">Disability Profile</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {regDisabilities.map((d) => (
                                                    <span key={`${d.category}-${d.subtype}`} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                                                        {d.category}: {d.subtype} {d.extent ? `(${d.extent})` : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(2)}
                                            className="text-xs font-black text-[#0038A8] hover:underline"
                                        >
                                            Edit
                                        </button>
                                    </div>

                                    {/* Education Summary */}
                                    <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start justify-between">
                                        <div className="flex-1 pr-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <GraduationCap size={16} className="text-[#0038A8]" />
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-600">Education Background</span>
                                            </div>
                                            <div className="space-y-1.5 mt-1">
                                                {regEducation.map((en, idx) => (
                                                    <div key={idx} className="text-xs text-slate-700">
                                                        <span className="font-bold">{en.institution || 'Unspecified'}</span>
                                                        <span className="text-slate-400"> — {en.level}{en.degree ? ` (${en.degree})` : ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(3)}
                                            className="text-xs font-black text-[#0038A8] hover:underline"
                                        >
                                            Edit
                                        </button>
                                    </div>

                                    {/* Skills Summary */}
                                    <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start justify-between">
                                        <div className="flex-1 pr-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Terminal size={16} className="text-[#0038A8]" />
                                                <span className="text-xs font-black uppercase tracking-wider text-slate-600">Skills</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {skillsList.map((skill) => (
                                                    <span key={skill} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-[#0038A8]">
                                                        {skill}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(4)}
                                            className="text-xs font-black text-[#0038A8] hover:underline"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.section>
                    )}

                    {/* STEP 6: Celebratory Success Screen with Auto-Redirect */}
                    {currentStep === 6 && (
                        <motion.section
                            key="step6"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.35 }}
                            className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-8 sm:p-14 text-center max-w-xl mx-auto"
                        >
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-100 border border-emerald-100">
                                <CheckCircle2 size={42} />
                            </div>

                            <span className="text-xs font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                                Registration Completed
                            </span>

                            <h1 className="text-3xl font-black text-slate-900 mt-4 tracking-tight">
                                Welcome to UPLIFT, {name.split(' ')[0]}!
                            </h1>

                            <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                                {successMessage || 'Your account is ready. We have prepared your inclusive candidate profile and match index.'}
                            </p>

                            <div className="mt-8 space-y-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/dashboard')}
                                    className="w-full py-4 rounded-2xl bg-[#0038A8] text-white font-black text-sm uppercase tracking-wider hover:bg-blue-800 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                                >
                                    Proceed to Jobs & Dashboard <ArrowRight size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/profile')}
                                    className="w-full py-3.5 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-all"
                                >
                                    Customize Additional Accommodations
                                </button>
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>

                {/* Navigation and Error Footer for Steps 1-5 */}
                {currentStep <= 5 && (
                    <div className="max-w-2xl mx-auto mt-6">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-3"
                                role="alert"
                            >
                                <AlertCircle size={18} className="shrink-0 text-rose-600" />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        <div className="flex items-center gap-3">
                            {currentStep > 1 && (
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-wider bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                                >
                                    <ArrowLeft size={16} /> Back
                                </button>
                            )}

                            {currentStep < 5 ? (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-wider bg-[#0038A8] text-white hover:bg-blue-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
                                >
                                    Continue to {STEPS[currentStep].title} <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={handleSubmit}
                                    className="flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Complete Registration <Sparkles size={16} />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Register;
