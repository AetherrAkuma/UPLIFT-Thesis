import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Building2, Mail, Lock, ChevronRight, AlertCircle, 
    ShieldCheck, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const EmployerLogin = () => {
    const navigate = useNavigate();
    const { login, API_BASE_URL } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
            const { user, token } = res.data;
            
            if (user.role !== 'employer' && user.role !== 'admin') {
                setError("This portal is for authorized employers only.");
                setLoading(false);
                return;
            }
            
            login(token, user);
            if (user.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/employer');
            }
        } catch (err) {
            setError(err.response?.data?.detail || "Login failed. Check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans overflow-hidden">
            <div className="flex-1 flex lg:flex-row flex-col">
                {/* Left Side - Visual */}
                <div className="lg:w-1/2 bg-slate-900 relative p-20 flex flex-col justify-between overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-600/30 via-transparent to-transparent opacity-50" />
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-12 cursor-pointer" onClick={() => navigate('/employer/welcome')}>
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                                <Building2 size={20} />
                            </div>
                            <span className="font-black text-xl tracking-tighter text-white uppercase">UPLIFT <span className="text-blue-500">AI</span> <span className="ml-2 text-[10px] text-slate-500 tracking-[0.2em]">EMPLOYER</span></span>
                        </div>
                        <h2 className="text-5xl font-black text-white leading-tight max-w-sm">
                            Access your <span className="text-blue-400">inclusive talent </span> ecosystem.
                        </h2>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-blue-400 backdrop-blur-md border border-white/10">
                                <ShieldCheck size={20} />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                NCDA Authorized Employer Portal <br/> Secure Vocational DNA Access
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="lg:w-1/2 flex items-center justify-center p-12 bg-slate-50">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-md"
                    >
                        <button 
                            onClick={() => navigate('/employer/welcome')}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#0038A8] transition-all mb-12"
                        >
                            <ArrowLeft size={14} /> Back to Welcome
                        </button>

                        <div className="mb-10">
                            <h3 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Employer Login</h3>
                            <p className="text-slate-500 font-medium">Manage your jobs and candidates.</p>
                        </div>

                        <form className="space-y-6" onSubmit={handleLogin}>
                            <div className="space-y-4">
                                <div className="relative group">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0038A8] transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <input 
                                        type="email" placeholder="Work Email" value={email} onChange={(e) => setEmail(e.target.value)} required
                                        className="w-full bg-white border border-slate-200 rounded-[1.5rem] py-5 pl-14 pr-8 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#0038A8] transition-all"
                                    />
                                </div>
                                <div className="relative group">
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0038A8] transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input 
                                        type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
                                        className="w-full bg-white border border-slate-200 rounded-[1.5rem] py-5 pl-14 pr-8 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#0038A8] transition-all"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-xs font-bold">
                                    <AlertCircle size={16} /> {error}
                                </div>
                            )}

                            <button 
                                disabled={loading}
                                className="w-full py-5 bg-[#0038A8] text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-blue-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-100 disabled:opacity-50"
                            >
                                {loading ? "Authenticating..." : "Authorize Portal"} <ChevronRight size={18} />
                            </button>

                            <p className="text-center text-xs font-bold text-slate-400">
                                Don't have a partner account? 
                                <button type="button" onClick={() => navigate('/employer/register')} className="text-[#0038A8] ml-2 hover:underline">Apply Now</button>
                            </p>
                        </form>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default EmployerLogin;
