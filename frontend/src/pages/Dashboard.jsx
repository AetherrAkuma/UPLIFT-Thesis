/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    Search, Sparkles, SlidersHorizontal, CheckCircle2, 
    AlertCircle, FileText, Bot, ArrowRight, X, Building2, 
    ChevronDown, Shield, Activity, Lightbulb, Briefcase,
    Scale, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- SUB-COMPONENTS ---

const ProfileProgressCard = ({ user, onEdit }) => {
    // 1. Comprehensive Disability check (supports array, legacy strings, and structured profile)
    let hasDisability = false;
    if (Array.isArray(user?.disabilities) && user.disabilities.length > 0) {
        hasDisability = true;
    } else if (typeof user?.disabilities === 'string' && user.disabilities.trim().length > 0) {
        try {
            const parsed = JSON.parse(user.disabilities);
            hasDisability = Array.isArray(parsed) ? parsed.length > 0 : true;
        } catch {
            hasDisability = user.disabilities.trim().length > 0;
        }
    }
    if (!hasDisability && user?.disability_profile) {
        try {
            const dp = typeof user.disability_profile === 'object' 
                ? user.disability_profile 
                : JSON.parse(user.disability_profile || '{}');
            hasDisability = !!(
                (Array.isArray(dp.disabilities) && dp.disabilities.length > 0) ||
                (Array.isArray(dp.categories) && dp.categories.length > 0)
            );
        } catch {
            // ignore
        }
    }

    // 2. Comprehensive Education check (supports array and string)
    let hasEducation = false;
    if (Array.isArray(user?.education) && user.education.length > 0) {
        hasEducation = true;
    } else if (typeof user?.education === 'string' && user.education.trim().length > 0) {
        try {
            const parsed = JSON.parse(user.education);
            hasEducation = Array.isArray(parsed) ? parsed.length > 0 : true;
        } catch {
            hasEducation = user.education.trim().length > 0;
        }
    }

    // 3. Technical Skills check
    let hasSkills = false;
    if (Array.isArray(user?.skills) && user.skills.length > 0) {
        hasSkills = true;
    } else if (typeof user?.skills === 'string' && user.skills.trim().length > 0) {
        hasSkills = true;
    }

    const core = [
        { label: 'Disability Type', done: hasDisability },
        { label: 'Education History', done: hasEducation },
        { label: 'Technical Skills', done: hasSkills }
    ];
    const optional = [
        { label: 'Summary', done: !!(user?.summary && String(user.summary).trim().length > 0) },
        { label: 'Experience', done: !!(user?.experience && String(user.experience).trim().length > 0) },
        { label: 'Projects', done: !!(user?.projects && String(user.projects).trim().length > 0) },
        { label: 'Certifications', done: !!(user?.certifications && String(user.certifications).trim().length > 0) },
        { label: 'Awards', done: !!(user?.awards && String(user.awards).trim().length > 0) },
        { label: 'Physical Capabilities', done: !!(user?.physical_capabilities && String(user.physical_capabilities).trim().length > 0) }
    ];

    const coreDone = core.filter(c => c.done).length;
    const optDone = optional.filter(c => c.done).length;
    const pct = Math.round(((coreDone / core.length) * 0.7 + (optDone / optional.length) * 0.3) * 100);
    const coreComplete = coreDone === core.length;

    return (
        <div className="mb-16 bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Profile Strength</h3>
                        <span className="text-2xl font-black text-[#0038A8]">{pct}%</span>
                    </div>
                    <div className="h-3.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, ease: "circOut" }}
                            className={`h-full rounded-full shadow-sm ${coreComplete ? 'bg-emerald-500' : 'bg-[#0038A8]'}`}
                        />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {core.map(c => (
                            <span key={c.label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${c.done ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                {c.done ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />} {c.label}
                            </span>
                        ))}
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-slate-50 text-slate-500 border-slate-100">
                            + {optDone}/{optional.length} optional details
                        </span>
                    </div>
                </div>
                <button
                    onClick={onEdit}
                    className="flex items-center gap-2 px-6 py-3 bg-[#0038A8] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-800 hover:-translate-y-0.5 transition-all"
                >
                    {coreComplete ? 'Refine Profile' : 'Complete Profile'} <ArrowRight size={14} />
                </button>
            </div>
            {!coreComplete && (
                <p className="mt-4 text-[10px] font-bold text-slate-400">
                    Completing the core fields (disability type, education, skills) gives the matcher a fair baseline — optional details simply enrich the match.
                </p>
            )}
        </div>
    );
};

const ScoreBar = ({ label, score, color }) => (
    <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center px-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
            <span className="text-xs font-black text-slate-800">{score.toFixed(0)}%</span>
        </div>
        <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
            <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 1, ease: "circOut" }}
                className={`${color} h-full rounded-full shadow-sm relative`} 
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20" />
            </motion.div>
        </div>
    </div>
);

const DetailBox = ({ title, items, color, icon, isBadge }) => {
    const colorClasses = {
        emerald: "bg-emerald-50 border-emerald-100 text-emerald-800",
        red: "bg-red-50 border-red-100 text-red-800",
        blue: "bg-blue-50 border-blue-100 text-blue-800",
        amber: "bg-amber-50 border-amber-100 text-amber-900"
    };

    return (
        <div className={`p-5 rounded-3xl border-2 ${colorClasses[color]} transition-transform hover:scale-[1.02]`}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 opacity-70">
                {icon} {title}
            </p>
            {isBadge ? (
                <div className="flex flex-wrap gap-2">
                    {items?.map((item, i) => item && (
                        <span key={i} className="px-3 py-1.5 bg-white/60 rounded-xl text-[11px] font-bold shadow-sm border border-white/80">
                            {item.trim()}
                        </span>
                    ))}
                </div>
            ) : (
                <ul className="text-xs font-medium space-y-2.5">
                    {items?.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 leading-relaxed">
                            <span className="mt-1 opacity-40 shrink-0">•</span> {item}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const ExplainItem = ({ ex }) => {
    const verdictStyles = {
        'Good fit': { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', row: 'border-emerald-100' },
        'Close match': { badge: 'bg-amber-100 text-amber-700 border-amber-200', row: 'border-amber-100' },
        'Needs support': { badge: 'bg-rose-100 text-rose-700 border-rose-200', row: 'border-rose-100' }
    };
    const vs = verdictStyles[ex?.verdict_label] || verdictStyles['Good fit'];
    const [open, setOpen] = useState(false);
    return (
        <div className={`rounded-2xl border bg-white/70 ${vs.row}`}>
            <button type="button" onClick={() => setOpen(!open)} className="w-full p-4 text-left">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-black text-slate-700 leading-snug">
                        <span className="uppercase tracking-wider">{ex.dimension}</span>
                        <span className="font-semibold text-slate-500 block mt-1 normal-case">{ex.decision}</span>
                    </p>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${vs.badge}`}>{ex.verdict_label}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-2 leading-relaxed">{ex.reason}</p>
                <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest mt-3 ${open ? 'text-blue-600' : 'text-slate-400'}`}>
                    <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                    {open ? 'Hide the inputs' : 'Inspect the inputs the model used'}
                </span>
            </button>
            {open && (
                <div className="px-4 pb-4 -mt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="bg-slate-50 rounded-xl p-3 text-[9px] font-bold text-slate-400">
                            From the job posting
                            <p className="font-black text-slate-700 mt-0.5 leading-snug">{ex.inputs?.job_posting}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 text-[9px] font-bold text-slate-400">
                            From your profile
                            <p className="font-black text-slate-700 mt-0.5 leading-snug">{ex.inputs?.your_profile}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 text-[9px] font-bold text-slate-400">
                            Where this came from
                            <p className="font-black text-slate-700 mt-0.5 leading-snug">{ex.inputs?.source}</p>
                        </div>
                    </div>
                    <p className="text-[9px] font-medium text-slate-400 mt-2.5 leading-relaxed">{ex.rule}</p>
                </div>
            )}
        </div>
    );
};

const SummaryCard = ({ title, summary, highlights, color, icon }) => {
    const colorClasses = {
        emerald: "bg-emerald-50/70 border-emerald-100 text-emerald-900",
        rose: "bg-rose-50/70 border-rose-100 text-rose-900",
        amber: "bg-amber-50/70 border-amber-100 text-amber-950",
        blue: "bg-blue-50/70 border-blue-100 text-blue-900"
    };
    const titleColors = {
        emerald: "text-emerald-700",
        rose: "text-rose-700",
        amber: "text-amber-800",
        blue: "text-blue-700"
    };

    return (
        <div className={`p-6 rounded-3xl border-2 ${colorClasses[color] || colorClasses.blue} transition-all hover:shadow-sm`}>
            <div className="flex items-center gap-2 mb-3">
                <span className={titleColors[color] || titleColors.blue}>{icon}</span>
                <h4 className={`font-black uppercase tracking-widest text-[10px] ${titleColors[color] || titleColors.blue}`}>
                    {title}
                </h4>
            </div>
            {summary ? (
                <p className="text-xs font-bold leading-relaxed mb-4 text-slate-800 bg-white/60 p-3 rounded-2xl border border-black/5">
                    {summary}
                </p>
            ) : null}
            {highlights && highlights.length > 0 ? (
                <div className="space-y-2 pt-2">
                    {highlights.map((h, i) => (
                        <div key={i} className="flex items-start gap-2.5 bg-white/70 p-2.5 rounded-xl border border-black/5 text-[11px] font-semibold text-slate-700 leading-snug">
                            <span>{h}</span>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

const SuitabilitySection = ({ match, data }) => {
    const [showBreakdown, setShowBreakdown] = useState(false);
    const item = match || data || {};
    const narrative = item.suitability_summary || item.narrative;
    const explanations = item.explanations || [];

    return (
        <div className="bg-amber-50/80 rounded-3xl p-6 border-2 border-amber-100 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-amber-700" />
                    <h4 className="font-black uppercase tracking-widest text-[10px] text-amber-800">
                        Workplace Suitability Summary
                    </h4>
                </div>
                {item.metrics?.ontology_score != null && (
                    <span className="px-3 py-1 bg-amber-200/60 text-amber-900 rounded-full text-[10px] font-black tracking-wider">
                        {item.metrics.ontology_score}% Match
                    </span>
                )}
            </div>

            {narrative && (
                <p className="text-xs font-medium text-slate-700 leading-relaxed bg-white/80 p-4 rounded-2xl border border-amber-100/80">
                    {narrative}
                </p>
            )}

            {explanations.length > 0 && (
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={() => setShowBreakdown(!showBreakdown)}
                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-800 hover:text-amber-950 transition-colors py-1.5 px-3 bg-amber-100/60 rounded-xl"
                    >
                        <ChevronDown size={14} className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
                        {showBreakdown ? 'Hide Detailed Dimension Analysis' : 'Inspect Operational Dimension Breakdown'}
                    </button>

                    {showBreakdown && (
                        <div className="space-y-3 mt-4 pt-3 border-t border-amber-200/50">
                            {explanations.map((ex, i) => (
                                <ExplainItem key={i} ex={ex} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const FairnessBadge = ({ fairness, match }) => {
    if (!fairness) return null;
    const reweighing = fairness.reweighing;
    const report = fairness.group_report;
    const hasCorrection = match?.metrics?.fairness_adjustment != null;
    return (
        <div className="flex items-center gap-2">
            {hasCorrection && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                    <Scale size={10} />
                    {match.metrics.fairness_adjustment > 0 ? '+' : ''}{match.metrics.fairness_adjustment}% Adj
                </span>
            )}
            {reweighing && !hasCorrection && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                    <Scale size={10} />
                    Fairness {reweighing.correction_applied > 0 ? '+' : ''}{reweighing.correction_applied}%
                </span>
            )}
            {report && report.system_group_averages && Object.keys(report.system_group_averages).length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                    <TrendingUp size={10} />
                    {report.your_disability}: {report.your_avg}%
                </span>
            )}
        </div>
    );
};

const ScoreChip = ({ label, score, color }) => {
    const colors = {
        emerald: "text-emerald-600 bg-emerald-50",
        blue: "text-blue-600 bg-blue-50",
        indigo: "text-indigo-600 bg-indigo-50",
        amber: "text-amber-700 bg-amber-50"
    };
    return (
        <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium">{label}</span>
            <span className={`px-2 py-0.5 rounded-lg font-black text-[10px] ${colors[color]}`}>{score.toFixed(0)}%</span>
        </div>
    );
};

const SuitabilityIndexPanel = ({ idx }) => {
    if (!idx || !idx.pillars) return null;
    const barColors = ['bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-indigo-500'];
    return (
        <div className="bg-indigo-50 rounded-2xl p-6 border-2 border-indigo-100">
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-black uppercase tracking-widest text-[9px] text-indigo-700 flex items-center gap-2">
                    <Building2 size={14} aria-hidden="true" /> Workplace Suitability Index
                </h4>
                <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[11px] font-black shadow-md shadow-indigo-200">
                    {idx.index}%
                </span>
            </div>
            <p className="text-[10px] font-medium text-indigo-900/70 leading-relaxed mb-4">{idx.definition}</p>
            <div className="space-y-3">
                {idx.pillars.map((p, i) => (
                    <div key={p.key} className="bg-white rounded-xl p-3.5 border border-indigo-50">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                                {p.label}
                                <span className="text-slate-400 font-bold"> · weight {Math.round(p.weight * 100)}%</span>
                            </span>
                            <span className="text-[10px] font-black text-slate-500">{p.score}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                            <div className={`h-full ${barColors[i % barColors.length]} rounded-full transition-all`} style={{ width: `${p.score}%` }} />
                        </div>
                        <p className="text-[9px] font-bold text-indigo-900/60 leading-relaxed">{p.legal_basis}</p>
                        {p.evidence.map((e, j) => (
                            <p key={j} className="text-[9px] font-medium text-slate-500 mt-1 leading-relaxed">• {e}</p>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

const AIAnalysisSidebar = ({ job, data, loading, onClose, fairness }) => {
    const navigate = useNavigate();
    return (
        <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-full md:w-[450px] h-full bg-white shadow-2xl z-[100] flex flex-col border-l border-slate-100"
        >
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">UPLIFT Assistant</h2>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online Analysis
                        </span>
                    </div>
                </div>
                        <button onClick={onClose} className="p-3 rounded-xl hover:bg-slate-200 transition-colors text-slate-400" aria-label="Close analysis panel">
                                    <X size={20} aria-hidden="true" />
                                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mt-1">
                        <Bot size={16} />
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-700 leading-relaxed max-w-[85%] border border-slate-100">
                        Analyzing <strong>{job.job_title}</strong> at <strong>{job.employer}</strong> against your profile...
                    </div>
                </div>

                {loading ? (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mt-1">
                            <Bot size={16} />
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-500 flex items-center gap-3 border border-slate-100">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                            Generating Expert Report
                        </div>
                    </div>
                ) : data && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        {fairness?.group_report?.system_group_averages && Object.keys(fairness.group_report.system_group_averages).length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <Scale size={16} className="text-indigo-500" />
                                    <h4 className="font-black uppercase tracking-widest text-[9px] text-indigo-500">Fairness Group Comparison</h4>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-indigo-800 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">
                                        <span className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                            Your Group ({fairness.group_report.your_disability})
                                        </span>
                                        <span>{fairness.group_report.your_avg}%</span>
                                    </div>
                                    {Object.entries(fairness.group_report.system_group_averages)
                                        .filter(([cat]) => cat !== fairness.group_report.your_disability)
                                        .slice(0, 4)
                                        .map(([cat, stats]) => (
                                            <div key={cat} className="flex items-center justify-between text-xs text-slate-600 px-3 py-1.5">
                                                <span>{cat}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">{stats.avg}%</span>
                                                    {fairness.group_report.disparity_vs_other_groups?.[cat] != null && (
                                                        <span className={`text-[10px] font-black ${fairness.group_report.disparity_vs_other_groups[cat] > 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                                                            {fairness.group_report.disparity_vs_other_groups[cat] > 0 ? '+' : ''}{fairness.group_report.disparity_vs_other_groups[cat]}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                                <p className="text-[9px] text-slate-400 mt-3 px-1 leading-relaxed">
                                    Scores are compared against historical match data across all disability groups. Negative disparity = your group scores lower on average vs that group.
                                </p>
                            </motion.div>
                        )}

                        {fairness?.reweighing && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <Scale size={16} className="text-emerald-600" />
                                    <h4 className="font-black uppercase tracking-widest text-[9px] text-emerald-600">Fairness Correction Applied</h4>
                                </div>
                                <p className="text-xs text-emerald-800 leading-relaxed">
                                    AIF360 Reweighing adjusted your scores by <strong>{fairness.reweighing.correction_applied > 0 ? '+' : ''}{fairness.reweighing.correction_applied}%</strong> to ensure equitable treatment across disability groups.
                                </p>
                            </motion.div>
                        )}
                        
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-black uppercase tracking-widest text-[9px] text-slate-400">Live Analytical Metrics</h4>
                                <div className="flex gap-1">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                                    <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <ScoreChip label="Workplace Safety Alignment" score={job.metrics.safety_score} color="emerald" />
                                <ScoreChip label="Technical Skill Relevance" score={job.metrics.skill_score} color="blue" />
                                <ScoreChip label="Sustainability & Stamina" score={job.metrics.stamina_score} color="indigo" />
                                <ScoreChip label="Workplace Suitability (Ontology)" score={job.metrics.ontology_score || 100.0} color="amber" />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 leading-relaxed">
                                How this number was reached: each metric compares the job's requirements against your capability profile,
                                then the four metrics are averaged into the overall score. Every comparison is listed below.
                            </p>
                        </div>

                        <SuitabilityIndexPanel idx={data?.suitability_index} />

                        <SuitabilitySection data={data} />

                        <div className="grid grid-cols-1 gap-4">
                            <SummaryCard 
                                title="Vocational Advantages & Fit (Pros)"
                                summary={data.pros_summary || data.analysis?.performance}
                                highlights={data.strengths}
                                color="emerald"
                                icon={<CheckCircle2 size={16} />}
                            />
                            <SummaryCard 
                                title="Considerations & Accommodations (Cons)"
                                summary={data.cons_summary || data.analysis?.challenges}
                                highlights={data.barriers}
                                color="rose"
                                icon={<AlertCircle size={16} />}
                            />
                        </div>

                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden group">
                            <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                                <Shield size={200} />
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-emerald-500/20 rounded-2xl text-emerald-400">
                                            <Shield size={20} />
                                        </div>
                                        <h4 className="font-black uppercase tracking-[0.2em] text-[10px] text-emerald-400">Expert Physical Compatibility</h4>
                                    </div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cross-Examined</span>
                                </div>
                                <p className="text-slate-300 text-base leading-relaxed font-medium">
                                    {data.analysis.compatibility}
                                </p>
                            </div>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-slate-100 shadow-2xl shadow-slate-200/50 group">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-blue-50 rounded-2xl text-blue-600">
                                    <Activity size={20} />
                                </div>
                                <h4 className="font-black uppercase tracking-[0.2em] text-[10px] text-slate-400">Performance Forecast</h4>
                            </div>
                            <p className="text-slate-600 text-base leading-relaxed font-semibold italic">
                                "{data.analysis.performance}"
                            </p>
                        </motion.div>

                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-blue-600 rounded-[2.5rem] p-6 md:p-10 text-white shadow-[0_20px_50px_rgba(37,99,235,0.3)] relative overflow-hidden">
                            <div className="absolute -bottom-10 -right-10 opacity-20 rotate-12">
                                <Lightbulb size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                    <h4 className="font-black uppercase tracking-[0.2em] text-[10px] opacity-70">Strategic Recommendations</h4>
                                </div>
                                <p className="text-white text-base leading-relaxed font-black">
                                    {data.analysis.advice}
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </div>

            <div className="p-8 border-t border-slate-100">
                <button 
                    onClick={() => navigate(`/job/${job.job_id || job.id}`)}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                    aria-label={`See more about ${job.job_title} at ${job.employer}`}
                >
                    See More
                </button>
            </div>
        </motion.div>
    );
};

const MatchCard = ({ match, isOpen, onToggle, onAnalyze, fairness, showAiMatch }) => {
    const navigate = useNavigate();
    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
            <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex gap-6">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 text-2xl font-black shrink-0">
                            {match.employer.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-xl font-black text-slate-800">{match.job_title || match.title}</h3>
                                {showAiMatch && (
                                    <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                                        {match.metrics.final_accessibility_percentage.toFixed(0)}% Fit
                                    </span>
                                )}
                                {match.suitability_index && (
                                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100" title={match.suitability_index.definition}>
                                        Index {match.suitability_index.index}%
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-slate-500">
                                <span className="flex items-center gap-1.5"><Building2 size={14} className="text-slate-300"/> {match.employer}</span>
                                <span className="flex items-center gap-1.5"><SlidersHorizontal size={14} className="text-slate-300"/> {match.job_type || 'Full-time'}</span>
                            </div>
                            {showAiMatch && <FairnessBadge fairness={fairness} match={match} />}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-4 self-end md:self-start">
                        {showAiMatch ? (
                            <div className="text-right hidden sm:block">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Suitability Score</p>
                                <div className="flex gap-1 justify-end">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className={`w-3 h-1.5 rounded-full ${i < Math.round(match.metrics.final_accessibility_percentage/20) ? 'bg-blue-500' : 'bg-slate-100'}`} />
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                            {showAiMatch && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                    aria-label="Why this job matched your profile"
                                >
                                    <Sparkles size={14} aria-hidden="true" /> Why this matched?
                                </button>
                            )}
                            <button 
                                onClick={onToggle}
                                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all transform active:scale-95 group/btn"
                                aria-expanded={isOpen}
                                aria-label={isOpen ? "Collapse details" : "Expand details"}
                            >
                                <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                                    <ChevronDown size={18} aria-hidden="true" />
                                </motion.div>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-50">
                    {showAiMatch && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 mb-6">
                                <ScoreBar label="Skill Relevance" score={match.metrics.skill_score} color="bg-blue-500" />
                                <ScoreBar label="Safety Alignment" score={match.metrics.safety_score} color="bg-indigo-500" />
                                <ScoreBar label="Stamina & Pacing" score={match.metrics.stamina_score} color="bg-emerald-500" />
                                <ScoreBar label="Workplace Suitability" score={match.metrics.ontology_score || 100.0} color="bg-amber-500" />
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 leading-relaxed -mt-3 mb-6">
                                How this score was reached: each metric compares the job's requirements against your capability profile
                                (safety, skills, stamina, workplace suitability) and averages them into the % fit above. Every comparison
                                is shown in the sections below, with the job's requirement, your capability, and the rule applied.
                            </p>

                            <p className="text-xs text-slate-500 italic flex-1 flex items-center gap-2 mb-6">
                                <Bot size={14} className="text-blue-400" />
                                {match.ai_insights?.split('.')[0] || "Personalized AI analysis available below"}.
                            </p>
                        </>
                    )}

                    <div className="flex items-center justify-end gap-3">
                        <button 
                            onClick={() => navigate(`/job/${match.job_id}`)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border border-slate-200"
                            aria-label={`See more details about ${match.job_title || match.title} at ${match.employer}`}
                        >
                            See More
                            <ArrowRight size={14} aria-hidden="true" />
                        </button>
                        <button 
                            onClick={() => navigate(`/apply/${match.job_id}`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 shadow-md shadow-blue-100 flex items-center gap-2"
                            aria-label={`Apply directly for ${match.job_title || match.title} at ${match.employer}`}
                        >
                            Apply Now
                        </button>
                    </div>
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="pt-8 space-y-8">
                                                                {showAiMatch && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <SummaryCard 
                                                title="Core Strengths & Advantages (Pros)" 
                                                summary={match.pros_summary}
                                                highlights={match.strengths}
                                                color="emerald" 
                                                icon={<CheckCircle2 size={16} />} 
                                            />
                                            <SummaryCard 
                                                title="Considerations & Potential Friction (Cons)" 
                                                summary={match.cons_summary}
                                                highlights={match.barriers}
                                                color="rose" 
                                                icon={<AlertCircle size={16} />} 
                                            />
                                        </div>
                                        <SuitabilitySection match={match} />
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <DetailBox 
                                        title="Physical Requirements" 
                                        items={match.physical_requirements ? [match.physical_requirements] : ["No specific physical requirements listed."]} 
                                        color="blue" 
                                        icon={<Shield size={16} className="text-blue-500" />} 
                                    />
                                    <DetailBox 
                                        title="Technical Skills Needed" 
                                        items={match.structured_skills?.split(",")} 
                                        color="blue" 
                                        icon={<Briefcase size={16} className="text-blue-500" />}
                                        isBadge={true}
                                    />
                                </div>
                                {showAiMatch && (
                                    <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 text-white shadow-2xl relative overflow-hidden group/analysis">
                                        <div className="absolute top-0 right-0 p-6 md:p-10 opacity-[0.03] group-hover/analysis:opacity-[0.08] transition-opacity">
                                            <Bot size={150} />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                                                        <FileText size={20} />
                                                    </div>
                                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">UPLIFT Expert Analysis</h4>
                                                </div>
                                            </div>
                                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                                                <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
                                                    Unlock a comprehensive 4-part expert report including physical compatibility cross-examination, performance forecasts, and strategic vocational advice.
                                                </p>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                                                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/40 flex items-center gap-3 group/btn"
                                                    aria-label="Generate deep analysis report for this job"
                                                >
                                                    Generate Deep Report
                                                    <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD ---

const Dashboard = () => {
    const { user, token, API_BASE_URL } = useAuth();
    const navigate = useNavigate();
    const [matches, setMatches] = useState([]);
    const [searching, setSearching] = useState(false);
    const [openDetails, setOpenDetails] = useState({});
    const [analysisJob, setAnalysisJob] = useState(null);
    const [analysisData, setAnalysisData] = useState(null);
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [useProfileContext, setUseProfileContext] = useState(() => {
        const saved = localStorage.getItem('dashboard_use_profile_context');
        return saved !== null ? saved === 'true' : false;
    });
    const [fairness, setFairness] = useState(null);

    useEffect(() => {
        localStorage.setItem('dashboard_use_profile_context', useProfileContext);
    }, [useProfileContext]);
    const [selectedJobType, setSelectedJobType] = useState('All');
    const [selectedEnvironment, setSelectedEnvironment] = useState('All');
    const [selectedLocation, setSelectedLocation] = useState('All');
    const [selectedStamina, setSelectedStamina] = useState('All');

    const locationsList = ['All', ...new Set(matches.map(match => match.location).filter(Boolean))];

    const filteredMatches = matches.filter(match => {
        const q = searchQuery.toLowerCase().trim();
        if (q) {
            const matchesQuery = (
                (match.job_title || '').toLowerCase().includes(q) ||
                (match.employer || '').toLowerCase().includes(q) ||
                (match.location || '').toLowerCase().includes(q) ||
                (match.job_description || '').toLowerCase().includes(q) ||
                (match.structured_skills || '').toLowerCase().includes(q) ||
                (match.matched_skills || []).some(s => String(s).toLowerCase().includes(q))
            );
            if (!matchesQuery) return false;
        }
        if (selectedJobType !== 'All' && match.job_type !== selectedJobType) return false;
        if (selectedEnvironment !== 'All') {
            if (selectedEnvironment === 'Remote' && !match.remote_friendly) return false;
            if (selectedEnvironment === 'Indoor' && match.work_environment !== 'Indoor') return false;
            if (selectedEnvironment === 'Outdoor' && match.work_environment !== 'Outdoor') return false;
        }
        if (selectedLocation !== 'All' && match.location !== selectedLocation) return false;
        if (selectedStamina !== 'All' && match.stamina_required !== selectedStamina) return false;
        return true;
    });

    const handleSearch = async (e, overrideContext = null) => {
        if (e) e.preventDefault();
        setSearching(true);
        const ctxToUse = overrideContext !== null ? overrideContext : useProfileContext;
        try {
            const res = await axios.post(`${API_BASE_URL}/pwd/suitability-match`, {
                search_query: searchQuery,
                use_profile_context: ctxToUse
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setMatches(res.data.matches || []);
            if (res.data.fairness) {
                setFairness(res.data.fairness);
            }
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setSearching(false);
        }
    };

    useEffect(() => {
        if (user && user.role === 'employer') {
            navigate('/employer');
        } else if (token) {
            handleSearch();
        }
    }, [user, token, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleAnalyzeJob = async (job) => {
        setAnalysisJob(job);
        setLoadingAnalysis(true);
        setAnalysisData(null);
        try {
            const res = await axios.get(`${API_BASE_URL}/pwd/job-analysis/${job.job_id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setAnalysisData(res.data);
        } catch (err) {
            console.error("Analysis failed", err);
        } finally {
            setLoadingAnalysis(false);
        }
    };

    const toggleDetails = (id) => {
        setOpenDetails(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-12 relative">
            <AnimatePresence>
                {analysisJob && (
                    <AIAnalysisSidebar 
                        job={analysisJob} 
                        data={analysisData} 
                        loading={loadingAnalysis} 
                        onClose={() => setAnalysisJob(null)}
                        fairness={fairness}
                    />
                )}
            </AnimatePresence>

            <header className="mb-12 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 mb-2">Hello, {user?.name.split(' ')[0]} 👋</h1>
                    <p className="text-slate-500">Find jobs that truly fit your unique capabilities.</p>
                </div>
                <button 
                    onClick={() => navigate('/applications')}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm group"
                >
                    <Briefcase size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    My Applications
                </button>
            </header>

            <ProfileProgressCard user={user} onEdit={() => navigate('/profile')} />

            <div className="relative mb-16">
                <div className="bg-white rounded-[3.5rem] p-6 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-6 md:p-12 opacity-[0.03] pointer-events-none">
                        <Bot size={240} />
                    </div>
                    <div className="relative z-10 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-600 text-[10px] font-black uppercase tracking-widest mb-6 border border-blue-100 transition-all">
                            {useProfileContext ? (
                                <><Sparkles size={12} className="animate-pulse text-[#0038A8]" /> AI-Powered Career Matching</>
                            ) : (
                                <><Search size={12} className="text-[#CE1126]" /> Manual Keyword Search</>
                            )}
                        </div>
                        <h2 className="text-4xl font-black text-slate-800 leading-tight mb-4 transition-all">
                            {useProfileContext ? (
                                <>Ready to discover your <span className="text-blue-600">perfect role?</span></>
                            ) : (
                                <>Search Open <span className="text-blue-600">Opportunities</span></>
                            )}
                        </h2>
                        <p className="text-slate-500 text-lg font-medium mb-10 leading-relaxed transition-all">
                            {useProfileContext ? (
                                "Our AI engine uses your Progressive Profile (Skills, Education, and Physical Capabilities) to find the most sustainable and safe job opportunities for you."
                            ) : (
                                "Perform a direct, manual keyword search across all approved postings. Toggle 'Enable AI suitability match' below to activate semantic AI matching."
                            )}
                        </p>
                        <div className="w-full mt-8">
                            <form onSubmit={handleSearch} className="w-full space-y-6">
                                <div className="flex flex-col sm:flex-row items-stretch gap-4">
                                    <div className="relative flex-1">
                                        <input 
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search by keywords, title, location, or skills..."
                                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-8 py-5 pr-14 text-slate-700 placeholder:text-slate-350 focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-sm font-bold shadow-inner"
                                            disabled={searching}
                                        />
                                        {searchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearchQuery('');
                                                }}
                                                className="absolute right-5 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                                                title="Clear search"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <button 
                                        type="submit"
                                        disabled={searching}
                                        className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2"
                                        aria-label={searching ? "Searching..." : "Search jobs"}
                                    >
                                        {searching ? (
                                            <div className="flex gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        ) : (
                                            <><Search size={18} /> Search</>
                                        )}
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-2">
                                    {/* Job Type Select */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Job Type</label>
                                        <select 
                                            value={selectedJobType}
                                            onChange={(e) => setSelectedJobType(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                                        >
                                            <option value="All">All Types</option>
                                            <option value="Full-time">Full-time</option>
                                            <option value="Part-time">Part-time</option>
                                            <option value="Contract">Contract</option>
                                        </select>
                                    </div>

                                    {/* Work Setup Select */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Work Setup</label>
                                        <select 
                                            value={selectedEnvironment}
                                            onChange={(e) => setSelectedEnvironment(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                                        >
                                            <option value="All">All Setups</option>
                                            <option value="Remote">Remote Friendly</option>
                                            <option value="Indoor">On-Site (Indoor)</option>
                                            <option value="Outdoor">Outdoor</option>
                                        </select>
                                    </div>

                                    {/* Location Select */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Location</label>
                                        <select 
                                            value={selectedLocation}
                                            onChange={(e) => setSelectedLocation(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                                        >
                                            {locationsList.map(loc => (
                                                <option key={loc} value={loc}>{loc === 'All' ? 'All Locations' : loc}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Stamina Required Select */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Stamina Load</label>
                                        <select 
                                            value={selectedStamina}
                                            onChange={(e) => setSelectedStamina(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                                        >
                                            <option value="All">All Stamina</option>
                                            <option value="Low">Low Stamina</option>
                                            <option value="Medium">Medium Stamina</option>
                                            <option value="High">High Stamina</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-6 pl-4 pt-2">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={useProfileContext}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setUseProfileContext(checked);
                                                handleSearch(null, checked);
                                            }}
                                            className="sr-only peer"
                                            disabled={searching}
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Enable AI suitability match (pacing & capability analysis)</span>
                                    </label>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6" role="region" aria-live="polite" aria-busy={searching} aria-label="Job match results">
                {filteredMatches.length > 0 ? (
                    filteredMatches.map((match) => (
                        <MatchCard 
                            key={match.job_id} 
                            match={match} 
                            isOpen={openDetails[match.job_id]} 
                            onToggle={() => toggleDetails(match.job_id)} 
                            onAnalyze={() => handleAnalyzeJob(match)}
                            fairness={fairness}
                            showAiMatch={useProfileContext}
                        />
                    ))
                ) : !searching && (
                    <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <Sparkles className="text-blue-200" size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-400">Ready to discover your fit?</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
