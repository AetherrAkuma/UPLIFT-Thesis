import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Building2, Mail, Lock, ChevronRight, AlertCircle, 
    ShieldCheck, ArrowLeft, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TurnstileWidget from '../components/TurnstileWidget';

const EmployerLogin = () => {
    const navigate = useNavigate();
    const { login, API_BASE_URL } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [failedAttempts, setFailedAttempts] = useState(() => {
        return parseInt(sessionStorage.getItem('uplift_failed_logins_employer') || '0', 10);
    });
    const [requireTurnstile, setRequireTurnstile] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState('');
    const turnstileRef = useRef(null);

    const isChallengeActive = failedAttempts >= 3 || requireTurnstile;

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (isChallengeActive && !turnstileToken) {
            setError('Please complete the security verification challenge before continuing.');
            return;
        }

        setLoading(true);
        
        try {
            const payload = {
                email,
                password,
                remember_me: rememberMe,
                turnstile_token: turnstileToken || undefined
            };
            const res = await axios.post(`${API_BASE_URL}/auth/login`, payload);
            const { user, token } = res.data;
            
            if (user.role !== 'employer' && user.role !== 'admin') {
                setError("This portal is for authorized employers only.");
                setLoading(false);
                return;
            }
            
            sessionStorage.removeItem('uplift_failed_logins_employer');
            setFailedAttempts(0);
            setRequireTurnstile(false);
            setTurnstileToken('');

            login(token, user, rememberMe);
            if (user.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/employer');
            }
        } catch (err) {
            const nextAttempts = (err.response?.data?.failed_attempts !== undefined)
                ? err.response.data.failed_attempts
                : failedAttempts + 1;
            setFailedAttempts(nextAttempts);
            sessionStorage.setItem('uplift_failed_logins_employer', nextAttempts.toString());

            if (err.response?.data?.require_turnstile || nextAttempts >= 3) {
                setRequireTurnstile(true);
            }

            if (turnstileRef.current?.reset) {
                turnstileRef.current.reset();
            }
            setTurnstileToken('');

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

                            <div className="flex items-center justify-between px-2 pt-1">
                                <label htmlFor="employer-remember-me" className="flex items-center gap-2.5 cursor-pointer select-none group">
                                    <input 
                                        id="employer-remember-me"
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded-md border-slate-300 text-[#0038A8] focus:ring-[#0038A8] accent-[#0038A8] cursor-pointer transition-all"
                                    />
                                    <span className="text-xs font-bold text-slate-500 group-hover:text-slate-700 transition-colors">
                                        Remember me <span className="text-slate-400 font-medium">(for 30 days)</span>
                                    </span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => navigate('/?mode=forgot')}
                                    className="text-xs font-bold text-[#0038A8] hover:text-blue-700 hover:underline transition-colors focus:outline-none"
                                >
                                    Forgot password?
                                </button>
                            </div>

                            {error && (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 text-xs font-bold">
                                    <AlertCircle size={16} /> {error}
                                </div>
                            )}

                            {isChallengeActive && (
                                <div className="p-4 bg-amber-50/90 border border-amber-200/80 rounded-2xl space-y-2">
                                    <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                                        <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                                        <span>Security verification required due to failed login attempts.</span>
                                    </div>
                                    <TurnstileWidget
                                        ref={turnstileRef}
                                        action="employer_login"
                                        onVerify={(tok) => {
                                            setTurnstileToken(tok);
                                            setError('');
                                        }}
                                        onExpire={() => setTurnstileToken('')}
                                    />
                                </div>
                            )}

                            <button 
                                disabled={loading || (isChallengeActive && !turnstileToken)}
                                className="w-full py-5 bg-[#0038A8] text-white rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-blue-800 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Authenticating..." : "Authorize Portal"} <ChevronRight size={18} />
                            </button>


                            <p className="text-center text-xs font-bold text-slate-400">
                                Don't have a partner account? 
                                <button type="button" onClick={() => navigate('/privacy?intent=register&for=employer&flow=full')} className="text-[#0038A8] ml-2 hover:underline">Apply Now</button>
                            </p>
                        </form>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default EmployerLogin;
