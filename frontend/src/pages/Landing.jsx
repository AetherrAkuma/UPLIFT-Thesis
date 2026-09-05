import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import axios from 'axios';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { 
    ShieldCheck, Sparkles, ArrowRight, ArrowLeft, User, Building, 
    Lock, Mail, Eye, EyeOff, X, CheckCircle2, Users, Briefcase, 
    Accessibility, Globe, BarChart3, Heart, GraduationCap, Terminal, Plus, Trash2
} from 'lucide-react';

const DISABILITY_CATEGORIES = {
    'Physical': ['Wheelchair User', 'Amputee', 'Cerebral Palsy', 'Muscular Dystrophy', 'Chronic Pain', 'Other'],
    'Visual': ['Total Blindness', 'Low Vision', 'Color Blindness', 'Other'],
    'Hearing': ['Profoundly Deaf', 'Hard of Hearing', 'Auditory Processing', 'Other'],
    'Learning': ['Autism (ASD)', 'ADHD', 'Dyslexia', 'Dysgraphia', 'Other'],
    'Intellectual': ['Down Syndrome', 'Developmental Delay', 'Other'],
    'Psychosocial': ['Bipolar Disorder', 'Depression', 'Anxiety Disorder', 'PTSD', 'Schizophrenia', 'Other'],
    'Chronic_Illness': ['Cancer Patient/Survivor', 'Rare Disease', 'Speech Impairment', 'Chronic Respiratory', 'Other']
};

const EXTENT_OPTIONS = {
    'Amputee': ['Finger(s)', 'Hand', 'Forearm', 'Upper Arm', 'Leg(s)', 'Toe(s)', 'Other'],
    'default': ['Partial', 'Complete', 'One side', 'Both sides', 'Mild', 'Moderate', 'Severe', 'Other']
};

const EDUCATION_LEVELS = ['Elementary', 'Junior High School', 'Senior High School', 'College', 'Masteral/Doctoral'];

const REG_STEPS = [
    { label: 'General Info', icon: <User size={18} /> },
    { label: 'Disability Type', icon: <Accessibility size={18} /> },
    { label: 'Education', icon: <GraduationCap size={18} /> },
    { label: 'Skills', icon: <Terminal size={18} /> }
];

const Landing = () => {
    const { login, API_BASE_URL } = useAuth();
    const navigate = useNavigate();
    const [authMode, setAuthMode] = useState(null); // 'login', 'register', 'employer'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const authModalRef = useFocusTrap(!!authMode);
    const [regStep, setRegStep] = useState(0);
    const [regDisabilities, setRegDisabilities] = useState([]);
    const [regEducation, setRegEducation] = useState([{ level: 'Senior High School', institution: '', degree: '', area: '', start_date: '', end_date: '' }]);
    const [regSkills, setRegSkills] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        if (mode === 'login' || mode === 'register') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAuthMode(mode);
        }
    }, []);

    const { scrollYProgress } = useScroll();
    const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            const offset = 80; // Offset for sticky header
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = element.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    };

    const resetForms = () => {
        setEmail('');
        setPassword('');
        setName('');
        setError('');
        setSuccess('');
        setRegStep(0);
        setRegDisabilities([]);
        setRegEducation([{ level: 'Senior High School', institution: '', degree: '', area: '', start_date: '', end_date: '' }]);
        setRegSkills('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
            login(res.data.token, res.data.user);
            setAuthMode(null);
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        if (authMode === 'employer') {
            setLoading(true);
            try {
                await axios.post(`${API_BASE_URL}/auth/register/employer`, { email, password, name });
                setSuccess('Organization registered! Please log in to complete your profile.');
                setTimeout(() => setAuthMode('login'), 2500);
            } catch (err) {
                setError(err.response?.data?.detail || 'Registration failed.');
            } finally {
                setLoading(false);
            }
            return;
        }

        // Core-first PWD registration: general info -> disability -> education -> skills
        if (regStep === 0) {
            if (!name.trim() || !email.trim() || !password.trim()) {
                setError('Please complete all fields.');
                return;
            }
            setError('');
            setRegStep(1);
            return;
        }
        if (regStep === 1) {
            if (regDisabilities.length === 0) {
                setError('Select at least one disability type.');
                return;
            }
            setError('');
            setRegStep(2);
            return;
        }
        if (regStep === 2) {
            const valid = regEducation.some(en => en.institution.trim().length > 0);
            if (!valid) {
                setError('Add at least one educational entry with an institution.');
                return;
            }
            setError('');
            setRegStep(3);
            return;
        }
        if (regStep === 3) {
            if (!regSkills.trim()) {
                setError('Technical skills are required.');
                return;
            }
            setError('');
        }

        setLoading(true);
        try {
            const payload = {
                email, password, name,
                role: 'user',
                disability_profile: JSON.stringify({ disabilities: regDisabilities }),
                education: JSON.stringify(regEducation),
                skills: regSkills
            };
            await axios.post(`${API_BASE_URL}/auth/register`, payload);
            setSuccess('Account created! You can now log in.');
            setTimeout(() => { setAuthMode('login'); }, 2500);
        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative bg-slate-50 min-h-screen font-sans">
            {/* Navigation Header */}
            <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-lg shadow-sm py-4' : 'bg-transparent py-6'}`}>
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    <div 
                        className="flex items-center gap-3 cursor-pointer group" 
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                        <div className="w-10 h-10 bg-[#0038A8] rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                            <span className="text-white font-black text-xl italic">U</span>
                        </div>
                        <span className={`text-2xl font-black tracking-tighter ${isScrolled ? 'text-slate-900' : 'text-slate-900'}`}>
                            UPLIFT
                        </span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8">
                        <button onClick={() => navigate('/jobs')} className="text-sm font-black text-[#0038A8] hover:underline transition-all">Browse Jobs</button>
                        <button onClick={() => scrollToSection('mission')} className="text-sm font-bold text-slate-600 hover:text-[#0038A8] transition-colors">Mission</button>
                        <button onClick={() => scrollToSection('impact')} className="text-sm font-bold text-slate-600 hover:text-[#0038A8] transition-colors">Impact</button>
                        <button onClick={() => scrollToSection('features')} className="text-sm font-bold text-slate-600 hover:text-[#0038A8] transition-colors">Technology</button>
                    </div>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => { resetForms(); setAuthMode('login'); }}
                            className="px-6 py-2.5 text-sm font-black text-[#0038A8] hover:bg-blue-50 rounded-full transition-all"
                        >
                            Log In
                        </button>
                        <button 
                            onClick={() => { resetForms(); setAuthMode('register'); }}
                            className="px-6 py-2.5 bg-[#0038A8] text-white text-sm font-black rounded-full shadow-lg shadow-blue-200 hover:scale-105 transition-all"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative pt-40 pb-32 px-6">
                <motion.div 
                    style={{ opacity, scale }}
                    className="max-w-7xl mx-auto text-center"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-[#0038A8] text-[10px] font-black mb-8 border border-blue-100 uppercase tracking-[0.2em]">
                            <Sparkles size={14} className="text-[#CE1126]" /> In Collaboration with NCDA
                        </div>
                        <h1 className="text-5xl md:text-8xl font-black text-slate-900 mb-8 tracking-tight leading-[1.05]">
                            Bridging Talents. <br />
                            <span className="text-[#0038A8] relative">
                                Breaking Barriers.
                                <svg className="absolute -bottom-2 left-0 w-full h-3 text-[#CE1126]" viewBox="0 0 100 10" preserveAspectRatio="none">
                                    <path d="M0 5 Q 25 0, 50 5 T 100 5" fill="none" stroke="currentColor" strokeWidth="4" />
                                </svg>
                            </span>
                        </h1>
                        <p className="text-xl text-slate-500 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
                            UPLIFT is the premier employment platform for Persons with Disabilities in the Philippines. 
                            Powered by semantic AI to match unique capabilities with inclusive employers.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                            <button 
                                onClick={() => { resetForms(); setAuthMode('register'); }}
                                className="group w-full sm:w-auto bg-[#0038A8] hover:bg-blue-800 text-white px-10 py-5 rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-200 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3"
                            >
                                Start Your Journey <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button 
                                onClick={() => navigate('/jobs')}
                                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-200 px-10 py-5 rounded-[2rem] font-black text-lg transition-all hover:border-[#0038A8] hover:text-[#0038A8] flex items-center justify-center gap-2"
                            >
                                <Briefcase size={20} /> Explore Open Jobs
                            </button>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Decorative Elements */}
                <div className="absolute top-1/4 -left-20 w-64 h-64 bg-blue-100/30 rounded-full blur-3xl -z-10" />
                <div className="absolute bottom-0 -right-20 w-96 h-96 bg-red-50/30 rounded-full blur-3xl -z-10" />
            </section>

            {/* Mission Section */}
            <section id="mission" className="py-32 px-6 bg-white relative">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                        >
                            <div className="w-16 h-2 bg-[#CE1126] mb-8" />
                            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 leading-tight">
                                Our Mission for an <br />Inclusive Philippines
                            </h2>
                            <p className="text-lg text-slate-600 mb-8 leading-relaxed italic">
                                "To provide direction and coordinate the efforts of all agencies towards the promotion of rights and the provision of equal opportunities in a barrier-free and inclusive society."
                            </p>
                            <div className="space-y-6">
                                {[
                                    { icon: <ShieldCheck className="text-[#0038A8]" />, title: "Promotion of Rights", desc: "Advocating for the rights of PWDs in every workplace." },
                                    { icon: <Accessibility className="text-[#CE1126]" />, title: "Barrier-Free Access", desc: "Digital and physical accessibility as a core requirement." },
                                    { icon: <Globe className="text-[#0038A8]" />, title: "Equal Opportunity", desc: "Leveling the playing field through intelligent matching." }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-4">
                                        <div className="mt-1">{item.icon}</div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">{item.title}</h4>
                                            <p className="text-sm text-slate-500">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="relative"
                        >
                            <div className="aspect-square bg-slate-100 rounded-[4rem] overflow-hidden shadow-2xl">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#0038A8]/10 to-transparent" />
                                <div className="p-6 md:p-12 h-full flex flex-col justify-center text-center">
                                    <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                                        <h3 className="text-2xl font-black text-slate-900 mb-4">Official Beneficiary</h3>
                                        <div className="flex items-center justify-center gap-4 mb-6">
                                            <div className="w-16 h-16 bg-[#0038A8] rounded-full flex items-center justify-center text-white font-black text-2xl">N</div>
                                            <div className="w-16 h-16 bg-white border-2 border-[#CE1126] rounded-full flex items-center justify-center text-[#CE1126] font-black text-2xl">C</div>
                                            <div className="w-16 h-16 bg-[#CE1126] rounded-full flex items-center justify-center text-white font-black text-2xl">D</div>
                                        </div>
                                        <p className="text-slate-500 font-medium">Supporting the National Council on Disability Affairs</p>
                                    </div>
                                </div>
                            </div>
                            {/* Decorative Floating Card */}
                            <div className="absolute -bottom-10 -left-10 bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 hidden md:block">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0038A8]">
                                        <CheckCircle2 size={24} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</p>
                                        <p className="font-black text-slate-900">100% Accessible</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Impact Statistics Section */}
            <section id="impact" className="py-32 px-6 bg-[#0038A8] text-white overflow-hidden relative">
                <div className="max-w-7xl mx-auto text-center relative z-10">
                    <h2 className="text-3xl md:text-5xl font-black mb-20 tracking-tight">Making a Measurable Impact</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
                        {[
                            { value: "1.4M+", label: "PWDs in PH", icon: <Users /> },
                            { value: "85%", label: "Match Accuracy", icon: <Sparkles /> },
                            { value: "250+", label: "Inclusive Partners", icon: <Building /> },
                            { value: "5k+", label: "Successful Hires", icon: <Briefcase /> }
                        ].map((stat, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <div className="flex justify-center mb-6 text-[#CE1126]">{stat.icon}</div>
                                <div className="text-4xl md:text-5xl font-black mb-2 tracking-tighter">{stat.value}</div>
                                <div className="text-blue-200 font-bold uppercase text-xs tracking-widest">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
                {/* Background Pattern */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-32 px-6 bg-slate-50">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">Built for Empowerment</h2>
                        <p className="text-slate-500 font-medium max-w-2xl mx-auto">Our technology is designed to understand the nuance of capability and accessibility requirements.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Main Feature */}
                        <motion.div 
                            whileHover={{ y: -5 }}
                            className="md:col-span-2 bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col justify-between"
                        >
                            <div>
                                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0038A8] mb-8">
                                    <BarChart3 size={32} />
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 mb-4">Semantic Skill Matching</h3>
                                <p className="text-slate-500 text-lg leading-relaxed max-w-lg">
                                    Unlike traditional keyword matching, our AI understands the underlying skills and potential of every candidate, matching them with roles that truly fit.
                                </p>
                            </div>
                            <div className="mt-12 flex flex-wrap gap-3">
                                {['AI Scoring', 'Capability Analysis', 'Bias Removal'].map((tag, i) => (
                                    <span key={i} className="px-4 py-2 bg-slate-50 rounded-full text-xs font-black text-[#0038A8] uppercase tracking-wider">{tag}</span>
                                ))}
                            </div>
                        </motion.div>

                        {/* Side Feature 1 */}
                        <motion.div 
                            whileHover={{ y: -5 }}
                            className="bg-[#CE1126] p-10 rounded-[3rem] shadow-xl text-white flex flex-col justify-between"
                        >
                            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white mb-8">
                                <Heart size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black mb-4 tracking-tight">Accessibility First</h3>
                                <p className="text-red-100">
                                    Every job post is audited for accessibility features—from wheelchair ramps to assistive software support.
                                </p>
                            </div>
                        </motion.div>

                        {/* Side Feature 2 */}
                        <motion.div 
                            whileHover={{ y: -5 }}
                            className="bg-white border-2 border-[#0038A8] p-10 rounded-[3rem] shadow-xl text-[#0038A8] flex flex-col justify-between"
                        >
                            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-8">
                                <ShieldCheck size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black mb-4 tracking-tight">Data Privacy</h3>
                                <p className="text-slate-500 font-medium">
                                    Your data is encrypted and handled with the highest standards of security and PWD data privacy laws.
                                </p>
                            </div>
                        </motion.div>

                        {/* Long Feature */}
                        <motion.div 
                            whileHover={{ y: -5 }}
                            className="md:col-span-2 bg-[#0038A8] p-10 rounded-[3rem] shadow-xl text-white flex flex-col md:flex-row items-center gap-6 md:gap-10"
                        >
                            <div className="flex-1">
                                <h3 className="text-3xl font-black mb-4">NCDA Direct Integration</h3>
                                <p className="text-blue-100">
                                    Our platform directly integrates with national disability registry standards to ensure legitimate and verified opportunities for everyone.
                                </p>
                            </div>
                            <div className="hidden lg:block w-32 h-32 bg-white/5 rounded-full border-8 border-white/10 flex items-center justify-center">
                                <Globe className="text-white" size={48} />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 px-6 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <div className="w-8 h-8 bg-[#0038A8] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span className="text-white font-black text-sm italic">U</span>
                        </div>
                        <span className="text-xl font-black tracking-tighter text-slate-900">
                            UPLIFT
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm font-medium">© 2026 UPLIFT Thesis Project. Official Partner of NCDA Philippines.</p>
                    <div className="flex gap-8">
                        <a href="#" className="text-slate-400 hover:text-[#0038A8] transition-colors"><Globe size={20} /></a>
                        <a href="#" className="text-slate-400 hover:text-[#CE1126] transition-colors"><Heart size={20} /></a>
                    </div>
                </div>
            </footer>

            {/* Auth Modal Container */}
            <AnimatePresence>
                {authMode && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                        <motion.div 
                            ref={authModalRef}
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className={`bg-white rounded-[3rem] shadow-2xl w-full overflow-hidden relative ${authMode === 'register' ? 'max-w-xl' : 'max-w-md'}`}
                            role="dialog"
                            aria-modal="true"
                            aria-label={authMode === 'login' ? 'Login form' : authMode === 'employer' ? 'Employer registration form' : 'Candidate registration form'}
                        >
                            <button 
                                onClick={() => setAuthMode(null)}
                                className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 transition-colors z-10"
                                aria-label="Close login form"
                            >
                                <X size={24} />
                            </button>
                            
                            <div className="p-6 sm:p-8 lg:p-12">
                                <div className="text-center mb-6 sm:mb-8 lg:mb-10">
                                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl transition-colors ${authMode === 'employer' ? 'bg-red-50 text-[#CE1126] shadow-red-100' : 'bg-blue-50 text-[#0038A8] shadow-blue-100'}`}>
                                        {authMode === 'login' ? <Lock size={36} /> : authMode === 'employer' ? <Building size={36} /> : <User size={36} />}
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                                        {authMode === 'login' ? 'Welcome Back' : authMode === 'employer' ? 'Employer Hub' : 'Create Account'}
                                    </h2>
                                    <p className="text-slate-400 text-sm mt-3 font-medium">
                                        {authMode === 'login' ? 'Log in to continue your journey' : authMode === 'employer' ? 'Apply to post inclusive opportunities' : 'Join our community of talented PWDs'}
                                    </p>
                                </div>

                                {authMode === 'register' ? (
                                    <>
                                        {/* Step Indicator */}
                                        <div className="flex items-center justify-center gap-2 mb-8">
                                            {REG_STEPS.map((s, i) => (
                                                <div key={s.label} className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${i < regStep ? 'bg-emerald-500 text-white' : i === regStep ? 'bg-[#0038A8] text-white shadow-lg shadow-blue-100' : 'bg-slate-100 text-slate-400'}`}>
                                                        {i < regStep ? <CheckCircle2 size={16} /> : s.icon}
                                                    </div>
                                                    <span className={`hidden sm:block text-[9px] font-black uppercase tracking-widest ${i === regStep ? 'text-[#0038A8]' : 'text-slate-400'}`}>{s.label}</span>
                                                    {i < REG_STEPS.length - 1 && <div className={`w-6 h-0.5 rounded ${i < regStep ? 'bg-emerald-400' : 'bg-slate-100'}`} />}
                                                </div>
                                            ))}
                                        </div>

                                        <form onSubmit={handleRegister} className="space-y-6" aria-label="Candidate registration">
                                            {regStep === 0 && (
                                                <>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4" htmlFor="reg-name">Full Name</label>
                                                        <div className="relative">
                                                            <User className="absolute left-6 top-5 text-slate-300" size={20} aria-hidden="true" />
                                                            <input id="reg-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required
                                                                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-5 pl-14 pr-6 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all"
                                                                placeholder="e.g. John Doe" autoComplete="name" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4" htmlFor="reg-email">Email Address</label>
                                                        <div className="relative">
                                                            <Mail className="absolute left-6 top-5 text-slate-300" size={20} aria-hidden="true" />
                                                            <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                                                                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-5 pl-14 pr-6 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all"
                                                                placeholder="name@work.com" autoComplete="email" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4" htmlFor="reg-password">Password</label>
                                                        <div className="relative">
                                                            <Lock className="absolute left-6 top-5 text-slate-300" size={20} aria-hidden="true" />
                                                            <input id="reg-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                                                                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-5 pl-14 pr-14 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all"
                                                                placeholder="••••••••" autoComplete="new-password" />
                                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-5 text-slate-400 hover:text-slate-600 transition-colors" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                                                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {regStep === 1 && (
                                                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                                    <RegDisabilityWizard regDisabilities={regDisabilities} setRegDisabilities={setRegDisabilities} />
                                                </div>
                                            )}

                                            {regStep === 2 && (
                                                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                                    {regEducation.map((en, i) => (
                                                        <div key={i} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <select
                                                                    value={en.level}
                                                                    onChange={(e) => setRegEducation(prev => prev.map((x, xi) => xi === i ? { ...x, level: e.target.value } : x))}
                                                                    className="bg-white border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100">
                                                                    {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                                                                </select>
                                                                {regEducation.length > 1 && (
                                                                    <button type="button" onClick={() => setRegEducation(prev => prev.filter((_, xi) => xi !== i))} className="text-rose-400 hover:text-rose-600 transition-colors" aria-label="Remove education entry">
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <SchoolAutocomplete
                                                                value={en.institution}
                                                                onChange={(v) => setRegEducation(prev => prev.map((x, xi) => xi === i ? { ...x, institution: v } : x))}
                                                                level={['College', 'Masteral/Doctoral'].includes(en.level) ? 'Tertiary' : 'Basic'}
                                                                API_BASE_URL={API_BASE_URL}
                                                            />
                                                            {['College', 'Masteral/Doctoral'].includes(en.level) && (
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <input type="text" value={en.degree} onChange={(e) => setRegEducation(prev => prev.map((x, xi) => xi === i ? { ...x, degree: e.target.value } : x))}
                                                                        className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                                        placeholder="Degree (e.g. BS Computer Science)" />
                                                                    <input type="text" value={en.area} onChange={(e) => setRegEducation(prev => prev.map((x, xi) => xi === i ? { ...x, area: e.target.value } : x))}
                                                                        className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                                                        placeholder="Area of study (optional)" />
                                                                </div>
                                                            )}
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">Start</label>
                                                                    <input type="month" value={toMonthValue(en.start_date)} onChange={(e) => setRegEducation(prev => prev.map((x, xi) => xi === i ? { ...x, start_date: e.target.value } : x))}
                                                                        className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100" />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">End</label>
                                                                    <input type="month" value={isPresent(en.end_date) ? '' : toMonthValue(en.end_date)} disabled={isPresent(en.end_date)}
                                                                        onChange={(e) => setRegEducation(prev => prev.map((x, xi) => xi === i ? { ...x, end_date: e.target.value } : x))}
                                                                        className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-300" />
                                                                    <label className="flex items-center gap-1.5 pl-1 text-[10px] font-bold text-slate-400 cursor-pointer select-none">
                                                                        <input type="checkbox" className="accent-blue-600" checked={isPresent(en.end_date)}
                                                                            onChange={(e) => setRegEducation(prev => prev.map((x, xi) => xi === i ? { ...x, end_date: e.target.checked ? '' : currentMonth() } : x))} />
                                                                        Present / currently attending
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => setRegEducation(prev => [...prev, { level: 'College', institution: '', degree: '', area: '', start_date: '', end_date: '' }])}
                                                        className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
                                                        <Plus size={14} /> Add Education Entry
                                                    </button>
                                                </div>
                                            )}

                                            {regStep === 3 && (
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4" htmlFor="reg-skills">Technical Skills</label>
                                                        <div className="relative">
                                                            <Terminal className="absolute left-6 top-5 text-slate-300" size={20} aria-hidden="true" />
                                                            <textarea id="reg-skills" value={regSkills} onChange={(e) => setRegSkills(e.target.value)} rows={4}
                                                                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-5 pl-14 pr-6 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all resize-none"
                                                                placeholder="e.g. Microsoft Office, Customer Service, Data Entry, Web Development" />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {['Microsoft Office', 'Customer Service', 'Data Entry', 'Public Speaking', 'Graphic Design', 'Web Development', 'Bookkeeping'].map(s => (
                                                            <button key={s} type="button" onClick={() => setRegSkills(prev => prev.trim() ? `${prev.trim()}, ${s}` : s)}
                                                                className="px-3 py-1.5 bg-blue-50 text-[#0038A8] rounded-xl text-[10px] font-bold border border-blue-100 hover:bg-[#0038A8] hover:text-white transition-all">
                                                                + {s}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {error && <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-black text-center uppercase tracking-wider" role="alert">{error}</div>}
                                            {success && <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-[11px] font-black text-center uppercase tracking-wider" role="status">{success}</div>}

                                            <div className="flex gap-3">
                                                {regStep > 0 && (
                                                    <button type="button" onClick={() => { setError(''); setRegStep(regStep - 1); }}
                                                        className="w-1/3 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                                                        <ArrowLeft size={16} /> Back
                                                    </button>
                                                )}
                                                <button type="submit" disabled={loading}
                                                    className={`flex-1 py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 bg-[#0038A8] text-white hover:bg-blue-800 shadow-blue-100 ${regStep === 0 ? 'w-full' : ''}`}>
                                                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="Loading" /> :
                                                     regStep === 3 ? 'Create Account' : <><span>Continue</span><ArrowRight size={18} /></>}
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                ) : (
                                <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-6" aria-label={authMode === 'login' ? 'Login' : 'Registration'}>
                                    {authMode !== 'login' && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4" htmlFor="a11y-name">{authMode === 'employer' ? 'Company Name' : 'Full Name'}</label>
                                            <div className="relative">
                                                <User className="absolute left-6 top-5 text-slate-300" size={20} aria-hidden="true" />
                                                <input 
                                                    id="a11y-name"
                                                    type="text" value={name} onChange={(e) => setName(e.target.value)} required
                                                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-5 pl-14 pr-6 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all"
                                                    placeholder={authMode === 'employer' ? "e.g. Acme Corp" : "e.g. John Doe"}
                                                    autoComplete={authMode === 'employer' ? 'organization' : 'name'}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4" htmlFor="a11y-email">Email Address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-6 top-5 text-slate-300" size={20} aria-hidden="true" />
                                            <input 
                                                id="a11y-email"
                                                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                                                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-5 pl-14 pr-6 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all"
                                                placeholder="name@work.com"
                                                autoComplete="email"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4" htmlFor="a11y-password">Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-6 top-5 text-slate-300" size={20} aria-hidden="true" />
                                            <input 
                                                id="a11y-password"
                                                type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                                                className="w-full bg-slate-50 border-2 border-transparent rounded-2xl py-5 pl-14 pr-14 text-sm font-bold text-slate-700 focus:border-[#0038A8] focus:bg-white focus:outline-none transition-all"
                                                placeholder="••••••••"
                                                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-5 text-slate-400 hover:text-slate-600 transition-colors" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                                            </button>
                                        </div>
                                    </div>

                                    {error && <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-black text-center uppercase tracking-wider" role="alert">{error}</div>}
                                    {success && <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-[11px] font-black text-center uppercase tracking-wider" role="status">{success}</div>}

                                    <button 
                                        type="submit" disabled={loading}
                                        className={`w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 ${
                                            authMode === 'employer' ? 'bg-[#CE1126] text-white hover:bg-red-700' : 'bg-[#0038A8] text-white hover:bg-blue-800 shadow-blue-100'
                                        }`}
                                    >
                                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="Loading" /> : 
                                         authMode === 'login' ? 'Enter Platform' : authMode === 'employer' ? 'Submit Application' : 'Create Profile'}
                                    </button>
                                </form>
                                )}
                                
                                <div className="text-center mt-10">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        {authMode === 'login' ? (
                                            <>New here? <button onClick={() => { resetForms(); setAuthMode('register'); }} className="text-[#0038A8] hover:underline">Create Account</button> or <button onClick={() => { resetForms(); setAuthMode('employer'); }} className="text-[#CE1126] hover:underline">Apply as Employer</button></>
                                        ) : (
                                            <>Already joined? <button onClick={() => { resetForms(); setAuthMode('login'); }} className="text-[#0038A8] hover:underline">Log In</button></>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
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

const RegDisabilityWizard = ({ regDisabilities, setRegDisabilities }) => {
    const [step, setStep] = useState(1);
    const [activeCat, setActiveCat] = useState(null);
    const [addedCats, setAddedCats] = useState([]);

    const countFor = (cat) => regDisabilities.filter(d => d.category === cat).length;
    const toggle = (cat, sub) => setRegDisabilities(prev =>
        prev.some(d => d.category === cat && d.subtype === sub)
            ? prev.filter(d => !(d.category === cat && d.subtype === sub))
            : [...prev, { category: cat, subtype: sub, extent: '', laterality: '' }]
    );
    const update = (cat, sub, patch) => setRegDisabilities(prev =>
        prev.map(d => d.category === cat && d.subtype === sub ? { ...d, ...patch } : d)
    );
    const doneWithCat = (cat) => {
        if (cat && !addedCats.includes(cat)) setAddedCats(prev => [...prev, cat]);
        setStep(1);
        setActiveCat(null);
    };
    const removeCat = (cat) => setRegDisabilities(prev => prev.filter(d => d.category !== cat));

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                {DISABILITY_STEPS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${i + 1 < step ? 'bg-emerald-500 text-white' : i + 1 === step ? 'bg-[#0038A8] text-white' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${i + 1 === step ? 'text-[#0038A8]' : 'text-slate-400'}`}>{label}</span>
                        {i < DISABILITY_STEPS.length - 1 && <div className={`w-5 h-0.5 rounded ${i + 1 < step ? 'bg-emerald-400' : 'bg-slate-100'}`} />}
                    </div>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div key="cat" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }} className="grid md:grid-cols-2 gap-3">
                        {Object.keys(DISABILITY_CATEGORIES).map(cat => {
                            const n = countFor(cat);
                            const saved = addedCats.includes(cat) || n > 0;
                            return (
                                <div key={cat} role="button" tabIndex={0} onClick={() => { setActiveCat(cat); setStep(2); }} onKeyDown={(e) => e.key === 'Enter' && setStep(2)}
                                    className={`p-4 text-left rounded-2xl border-2 transition-all cursor-pointer ${saved ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300' : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}>
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
                        {regDisabilities.length > 0 && (
                            <div className="md:col-span-2 flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{regDisabilities.length} selected in total</span>
                                <button type="button" onClick={() => setStep(3)} className="px-5 py-2.5 bg-[#0038A8] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
                                    Review Accommodations
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {step === 2 && activeCat && (
                    <motion.div key="sub" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <button type="button" onClick={() => { setStep(1); setActiveCat(null); }} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                                <ArrowLeft size={14} /> Categories
                            </button>
                            <span className="text-sm font-black text-slate-700">{activeCat === 'Chronic_Illness' ? 'Chronic Illness' : activeCat}</span>
                            <span className="text-[10px] font-black text-[#0038A8] bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{countFor(activeCat)} Selected</span>
                        </div>
                        <div className="p-6 bg-white rounded-2xl border border-slate-100">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {DISABILITY_CATEGORIES[activeCat].map((sub, i) => {
                                    const entry = regDisabilities.find(d => d.category === activeCat && d.subtype === sub);
                                    const active = !!entry;
                                    return (
                                        <motion.div key={sub} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="min-w-0">
                                            <button type="button" onClick={() => toggle(activeCat, sub)}
                                                className={`w-full py-3 px-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 border-2 flex items-center justify-center gap-1.5 ${active ? 'bg-[#0038A8] border-[#0038A8] text-white shadow-lg shadow-blue-200' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-600'}`}>
                                                {sub}
                                                {active && <CheckCircle2 size={12} className="shrink-0" />}
                                            </button>
                                            <AnimatePresence initial={false}>
                                                {active && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                                                        <div className="pt-2.5 space-y-2">
                                                            <select
                                                                value={entry.extent}
                                                                onChange={(e) => update(activeCat, sub, { extent: e.target.value })}
                                                                className="w-full bg-blue-50/60 border border-blue-200 rounded-xl px-3 py-2 text-[10px] font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                                                                <option value="">Extent...</option>
                                                                {(EXTENT_OPTIONS[sub] || EXTENT_OPTIONS.default).map(o => <option key={o} value={o}>{o}</option>)}
                                                            </select>
                                                            {(activeCat === 'Physical' && ['Amputee', 'Cerebral Palsy', 'Muscular Dystrophy'].includes(sub)) && (
                                                                <select
                                                                    value={entry.laterality}
                                                                    onChange={(e) => update(activeCat, sub, { laterality: e.target.value })}
                                                                    className="w-full bg-blue-50/60 border border-blue-200 rounded-xl px-3 py-2 text-[10px] font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
                                                                    <option value="">Side...</option>
                                                                    {['Left', 'Right', 'Both'].map(o => <option key={o} value={o}>{o}</option>)}
                                                                </select>
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
                            <button type="button" onClick={() => setStep(3)} disabled={countFor(activeCat) === 0}
                                className="px-6 py-3 bg-[#0038A8] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
                                Next: Accommodations <ArrowRight size={14} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div key="ctx" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <button type="button" onClick={() => { setStep(1); setActiveCat(null); }} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                                <ArrowLeft size={14} /> Categories
                            </button>
                            <span className="text-[10px] font-black text-[#0038A8] bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{regDisabilities.length} Selected</span>
                        </div>
                        {regDisabilities.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {regDisabilities.map(d => (
                                    <span key={`${d.category}-${d.subtype}`} className="px-3 py-1.5 bg-blue-50 text-[#0038A8] rounded-xl text-[10px] font-bold border border-blue-100">
                                        {d.category}: {d.subtype}{d.extent ? ` (${d.extent})` : ''}{d.laterality ? `, ${d.laterality}` : ''}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="p-5 bg-white rounded-2xl border border-slate-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Accommodations</label>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400">Add workplace accommodations and capability details anytime from your profile after registering.</p>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <button type="button" onClick={() => { setStep(1); setActiveCat(null); }} className="px-6 py-3 border-2 border-emerald-600 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center gap-2">
                                <Plus size={14} /> Add Another Entry
                            </button>
                            <button type="button" onClick={() => doneWithCat(activeCat)} className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2">
                                Complete <CheckCircle2 size={14} />
                            </button>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 text-center">That's everything — select Complete, or add another entry if you have one.</p>
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

export default Landing;
