import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
    Building2, ShieldCheck, TrendingUp, ChevronRight, 
    Zap, Sparkles, Globe, Brain
} from 'lucide-react';

const EmployerLanding = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white font-sans selection:bg-blue-100 selection:text-[#0038A8]">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="w-10 h-10 bg-[#0038A8] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                            <Building2 size={24} />
                        </div>
                        <span className="font-black text-2xl tracking-tighter text-slate-900">UPLIFT</span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-10">
                        <a href="#features" className="text-sm font-bold text-slate-500 hover:text-[#0038A8] transition-colors">Platform</a>
                        <a href="#impact" className="text-sm font-bold text-slate-500 hover:text-[#0038A8] transition-colors">Impact</a>
                        <a href="#pricing" className="text-sm font-bold text-slate-500 hover:text-[#0038A8] transition-colors">Enterprise</a>
                    </div>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/employer/login')}
                            className="text-sm font-black uppercase tracking-widest text-slate-500 hover:text-[#0038A8] transition-all"
                        >
                            Log In
                        </button>
                        <button 
                            onClick={() => navigate('/employer/register')}
                            className="px-6 py-3 bg-[#0038A8] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.1em] hover:bg-blue-800 transition-all shadow-xl shadow-blue-100"
                        >
                            Become a Partner
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-40 pb-32 px-6">
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                    <motion.div 
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full mb-8">
                            <Sparkles size={16} className="text-[#0038A8]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#0038A8]">AI-Driven Inclusive Hiring</span>
                        </div>
                        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[0.9] mb-8">
                            Transform Your Workforce with <span className="text-[#0038A8]">Inclusive Intelligence.</span>
                        </h1>
                        <p className="text-xl text-slate-500 mb-10 leading-relaxed max-w-lg font-medium">
                            UPLIFT connects progressive organizations with highly skilled PWD talent through 12-dimensional vocational DNA matching.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={() => navigate('/employer/register')}
                                className="group px-8 py-5 bg-slate-900 text-white rounded-3xl text-sm font-black uppercase tracking-widest hover:bg-[#0038A8] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-slate-200"
                            >
                                Start 3-Step Onboarding <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button className="px-8 py-5 bg-white border border-slate-200 text-slate-600 rounded-3xl text-sm font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
                                Watch Impact Demo
                            </button>
                        </div>
                    </motion.div>

                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative"
                    >
                        <div className="absolute -inset-10 bg-gradient-to-tr from-blue-100/50 to-red-100/30 blur-3xl -z-10 rounded-full" />
                        <div className="bg-white rounded-[3rem] p-4 shadow-2xl border border-slate-100 rotate-2">
                            <div className="bg-slate-950 rounded-[2.5rem] p-10 text-white overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-8 opacity-20">
                                    <TrendingUp size={120} />
                                </div>
                                <div className="flex items-center gap-3 mb-10">
                                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                                        <ShieldCheck size={28} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Match Accuracy</p>
                                        <p className="text-2xl font-black italic">98.4% Fit Rate</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="h-2 bg-slate-800 rounded-full w-full">
                                        <motion.div initial={{ width: 0 }} animate={{ width: '92%' }} className="h-full bg-blue-500 rounded-full" />
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Accessibility Compliance Index</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Feature Grid */}
            <section id="features" className="py-32 bg-slate-50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-2xl mx-auto mb-20">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#0038A8] mb-4">The UPLIFT Advantage</h2>
                        <h3 className="text-4xl font-black text-slate-900 tracking-tight">Beyond Traditional Hiring.</h3>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <FeatureCard 
                            icon={<Brain size={24} />} 
                            title="Vocational DNA Matching" 
                            desc="We analyze 12 sensory and physical dimensions to ensure candidates aren't just qualified, but comfortably suited for the environment."
                        />
                        <FeatureCard 
                            icon={<Globe size={24} />} 
                            title="National Compliance" 
                            desc="Full alignment with NCDA standards and ADA regulations. Built-in tools for mandatory inclusive hiring documentation."
                        />
                        <FeatureCard 
                            icon={<Zap size={24} />} 
                            title="Instant Accessibility Audits" 
                            desc="Our AI identifies hidden barriers in your job descriptions and suggests ergonomic optimizations in real-time."
                        />
                    </div>
                </div>
            </section>

            {/* Impact Section */}
            <section id="impact" className="py-32 px-6">
                <div className="max-w-7xl mx-auto bg-slate-900 rounded-[4rem] p-20 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-600/20 to-transparent -z-0" />
                    <div className="relative z-10 max-w-xl">
                        <h2 className="text-5xl font-black mb-8 leading-tight">Empower talent, <span className="text-blue-400">elevate your culture.</span></h2>
                        <p className="text-lg text-slate-400 mb-10 font-medium">
                            Companies hiring through UPLIFT report a 35% higher retention rate and a significant increase in overall team empathy and productivity.
                        </p>
                        <div className="flex items-center gap-12">
                            <div>
                                <p className="text-4xl font-black text-white mb-1">500+</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Partner Companies</p>
                            </div>
                            <div>
                                <p className="text-4xl font-black text-white mb-1">₱12M+</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Economic Impact</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#0038A8] rounded-lg flex items-center justify-center text-white">
                            <Building2 size={18} />
                        </div>
                        <span className="font-black text-xl tracking-tighter text-slate-900">UPLIFT</span>
                    </div>
                    <p className="text-sm font-bold text-slate-400">© 2026 UPLIFT Thesis Project. NCDA Authorized Portal.</p>
                    <div className="flex gap-8">
                        <a href="#" className="text-xs font-black uppercase tracking-widest text-slate-500">Privacy</a>
                        <a href="#" className="text-xs font-black uppercase tracking-widest text-slate-500">Terms</a>
                        <a href="#" className="text-xs font-black uppercase tracking-widest text-slate-500">Support</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc }) => (
    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 hover:border-blue-100 hover:shadow-2xl hover:shadow-blue-100/50 transition-all group">
        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-8 group-hover:bg-[#0038A8] group-hover:text-white transition-all">
            {icon}
        </div>
        <h4 className="text-xl font-black text-slate-800 mb-4">{title}</h4>
        <p className="text-slate-500 font-medium leading-relaxed">{desc}</p>
    </div>
);

export default EmployerLanding;
