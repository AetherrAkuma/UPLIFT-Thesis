import { useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Building2, Mail, Lock, User, CheckCircle2, ChevronRight, 
    ChevronLeft, Upload, ShieldCheck, Globe, MapPin, 
    Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const EmployerOnboarding = () => {
    const navigate = useNavigate();
    const { login, API_BASE_URL } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Form States
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '', // Contact Person
        company_name: '',
        company_type: 'Private',
        location: '',
        industry: '',
        proof_filename: ''
    });

    const updateData = (fields) => setFormData(prev => ({ ...prev, ...fields }));

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            // 1. Register Account
            await axios.post(`${API_BASE_URL}/auth/register/employer`, {
                email: formData.email,
                password: formData.password,
                name: formData.company_name, // User name as company name
                role: 'employer'
            });

            // 2. Login immediately to get token
            const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
                email: formData.email,
                password: formData.password
            });
            
            const { token } = loginRes.data;
            
            // 3. Submit Verification Data (Company Profile + Proof)
            await axios.post(`${API_BASE_URL}/employer/verify`, {
                company_name: formData.company_name,
                company_type: formData.company_type,
                location: formData.location,
                industry: formData.industry,
                contact_person: formData.name,
                proof_filename: formData.proof_filename || "registration_permit_placeholder.pdf"
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // 4. Update auth state in context
            login(token, loginRes.data.user);
            
            // 5. Final Step
            setStep(4);
        } catch (err) {
            setError(err.response?.data?.detail || "Onboarding failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-blue-100">
            {/* Aesthetic Header with Progress Bar */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-8 py-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/employer/welcome')}>
                        <div className="w-8 h-8 bg-[#0038A8] rounded-lg flex items-center justify-center text-white">
                            <Building2 size={20} />
                        </div>
                        <span className="font-black text-xl tracking-tighter text-slate-900 uppercase">UPLIFT <span className="text-[#0038A8]">AI</span> <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] rounded-md tracking-widest">EMPLOYER</span></span>
                    </div>

                    {/* Enhanced Progress Bar */}
                    <div className="flex items-center gap-4 w-full max-w-2xl">
                        {[1, 2, 3].map((s) => (
                            <Fragment key={s}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-500 ${step >= s ? 'bg-[#0038A8] text-white shadow-lg shadow-blue-100' : 'bg-slate-100 text-slate-400'}`}>
                                        {step > s ? <CheckCircle2 size={16} /> : s}
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-500 ${step >= s ? 'text-slate-900' : 'text-slate-300'}`}>
                                        {s === 1 ? 'Account' : s === 2 ? 'Profile' : 'Verification'}
                                    </span>
                                </div>
                                {s < 3 && <div className="flex-1 h-px bg-slate-100 relative">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: step > s ? '100%' : '0%' }}
                                        className="absolute inset-0 bg-[#0038A8] transition-all duration-500"
                                    />
                                </div>}
                            </Fragment>
                        ))}
                    </div>

                    <div className="hidden md:block">
                        <button onClick={() => navigate('/employer/login')} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[#0038A8] transition-colors">Sign In</button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-xl">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <StepHeader 
                                    icon={<User className="text-[#0038A8]" />} 
                                    title="Administrative Access" 
                                    desc="Establish your organizational gateway to inclusive talent." 
                                />
                                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                                    <Input icon={<Mail size={18}/>} placeholder="Work Email" type="email" value={formData.email} onChange={(e) => updateData({ email: e.target.value })} required />
                                    <Input icon={<Lock size={18}/>} placeholder="Password" type="password" value={formData.password} onChange={(e) => updateData({ password: e.target.value })} required />
                                    <Input icon={<User size={18}/>} placeholder="Full Name (Contact Person)" value={formData.name} onChange={(e) => updateData({ name: e.target.value })} required />
                                    <button className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-[#0038A8] transition-all flex items-center justify-center gap-3">
                                        Company Details <ChevronRight size={18} />
                                    </button>
                                </form>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <StepHeader 
                                    icon={<Building2 className="text-[#0038A8]" />} 
                                    title="Company Intelligence" 
                                    desc="Define your organizational sensory profile." 
                                />
                                <div className="space-y-4">
                                    <Input icon={<Building2 size={18}/>} placeholder="Company Legal Name" value={formData.company_name} onChange={(e) => updateData({ company_name: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <select 
                                            value={formData.company_type} 
                                            onChange={(e) => updateData({ company_type: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-[1.5rem] p-4 text-sm font-bold text-slate-600 focus:outline-none focus:border-[#0038A8]"
                                        >
                                            <option>Private</option>
                                            <option>Government</option>
                                            <option>NGO</option>
                                            <option>Academic</option>
                                        </select>
                                        <Input icon={<Globe size={18}/>} placeholder="Industry" value={formData.industry} onChange={(e) => updateData({ industry: e.target.value })} />
                                    </div>
                                    <Input icon={<MapPin size={18}/>} placeholder="Headquarters Location" value={formData.location} onChange={(e) => updateData({ location: e.target.value })} />
                                    
                                    <div className="flex gap-4 pt-4">
                                        <button onClick={handleBack} className="flex-1 py-5 bg-white border border-slate-200 text-slate-400 rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                                            <ChevronLeft size={16} /> Back
                                        </button>
                                        <button onClick={handleNext} className="flex-[2] py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-[#0038A8] transition-all flex items-center justify-center gap-2">
                                            Verification <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <StepHeader 
                                    icon={<ShieldCheck className="text-[#0038A8]" />} 
                                    title="Trust & Security" 
                                    desc="Authorize your workspace with official documentation." 
                                />
                                <div className="space-y-6">
                                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-12 text-center group hover:border-[#0038A8] transition-all cursor-pointer">
                                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0038A8] mx-auto mb-4 group-hover:scale-110 transition-transform">
                                            <Upload size={28} />
                                        </div>
                                        <p className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">Upload Document</p>
                                        <p className="text-xs font-bold text-slate-400">PDF, JPG, or PNG (Max 5MB)</p>
                                        <input type="file" className="hidden" />
                                    </div>

                                    {error && <p className="text-center text-red-500 text-xs font-bold bg-red-50 p-4 rounded-2xl">{error}</p>}

                                    <div className="flex gap-4">
                                        <button onClick={handleBack} className="flex-1 py-5 bg-white border border-slate-200 text-slate-400 rounded-[2rem] font-black text-[10px] uppercase tracking-widest">Back</button>
                                        <button 
                                            onClick={handleSubmit}
                                            disabled={loading}
                                            className="flex-[2] py-5 bg-[#0038A8] text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-blue-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-100 disabled:opacity-50"
                                        >
                                            {loading ? "Processing..." : "Complete Application"} <Sparkles size={18} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                                <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-600 mx-auto mb-8 shadow-xl shadow-emerald-100">
                                    <CheckCircle2 size={48} />
                                </div>
                                <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Application Submitted!</h2>
                                <p className="text-slate-500 font-medium mb-10 max-w-sm mx-auto">
                                    Our team will review your organization's verification documents within 24-48 hours. You will receive an email once authorized.
                                </p>
                                <button 
                                    onClick={() => navigate('/employer')}
                                    className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-[#0038A8] transition-all"
                                >
                                    Go to Status Portal
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

const StepHeader = ({ icon, title, desc }) => (
    <div className="text-center mb-10">
        <div className="w-14 h-14 bg-white rounded-2xl shadow-xl shadow-slate-100 flex items-center justify-center mx-auto mb-6">
            {icon}
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight uppercase">{title}</h2>
        <p className="text-slate-500 font-medium text-sm">{desc}</p>
    </div>
);

const Input = ({ icon, ...props }) => (
    <div className="relative group">
        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0038A8] transition-colors">
            {icon}
        </div>
        <input 
            {...props}
            className="w-full bg-white border border-slate-200 rounded-[1.5rem] py-5 pl-14 pr-8 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#0038A8] focus:shadow-xl focus:shadow-blue-100/50 transition-all"
        />
    </div>
);

export default EmployerOnboarding;
