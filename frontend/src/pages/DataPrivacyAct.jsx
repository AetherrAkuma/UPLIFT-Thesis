import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Database,
    FileCheck2,
    LockKeyhole,
    Scale,
    ShieldCheck,
    Users
} from 'lucide-react';

const PRIVACY_SECTIONS = [
    {
        icon: Database,
        title: 'Information We Collect',
        candidateText: 'We collect your name, email address, account credentials, disability and accommodation information, education, skills, application details, and any resume or verification information you provide.',
        employerText: 'We collect your organization and contact details, account credentials, company verification information, job postings, and application activity associated with your employer account.'
    },
    {
        icon: FileCheck2,
        title: 'How We Use Your Information',
        text: 'We use personal information to create and secure your account, match candidates with suitable opportunities, support inclusive accommodation planning, process applications, verify accounts, communicate with you, and maintain the security and integrity of UPLIFT.'
    },
    {
        icon: Users,
        title: 'Sharing and Employer Access',
        text: 'Authorized employer accounts may receive relevant candidate profile, skills, disability, accommodation, application, and resume information to support recruitment and matching. Information may also be shared when required by law, a valid legal process, or an authorized government office.'
    },
    {
        icon: LockKeyhole,
        title: 'Retention and Safeguards',
        text: 'Personal information is retained only while needed for the purposes stated in this notice, the operation of your account, and applicable legal obligations. UPLIFT applies administrative and technical access controls and limits use to authorized personnel and account holders.'
    },
    {
        icon: Scale,
        title: 'Your Privacy Rights',
        text: 'Subject to applicable law, you may request access to or correction of your personal information, object to or withdraw consent for processing, request deletion, or receive a copy of information required by law. You may also report concerns to the National Privacy Commission.'
    }
];

const DataPrivacyAct = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [acknowledged, setAcknowledged] = useState(false);

    const accountType = searchParams.get('for') === 'employer' ? 'employer' : 'candidate';
    const employerFlow = searchParams.get('flow') === 'quick' ? 'quick' : 'full';
    const isRegistration = searchParams.get('intent') === 'register';
    const isCandidate = accountType === 'candidate';

    const destination = isCandidate
        ? '/register'
        : employerFlow === 'quick'
            ? '/?mode=employer'
            : '/employer/register';
    const returnPath = isCandidate || employerFlow === 'quick' ? '/' : '/employer/welcome';
    const accountLabel = isCandidate ? 'candidate' : 'employer';
    const continueLabel = isCandidate
        ? 'Continue to Candidate Registration'
        : 'Continue to Employer Registration';

    const handleContinue = () => {
        navigate(destination, { state: { privacyAcknowledged: true } });
    };

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 sm:py-14">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        onClick={() => navigate(returnPath)}
                        className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm transition hover:text-blue-600"
                    >
                        <ArrowLeft size={16} aria-hidden="true" /> Back
                    </button>
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-700">
                        <ShieldCheck size={16} aria-hidden="true" /> Republic Act No. 10173
                    </div>
                </div>

                <article className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-xl">
                    <header className="border-b border-slate-100 bg-slate-900 px-6 py-10 text-white sm:px-10 sm:py-12">
                        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-950/30">
                            <ShieldCheck size={34} aria-hidden="true" />
                        </div>
                        <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-blue-300">Required account step</p>
                        <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Data Privacy Act Waiver and Acknowledgment</h1>
                        <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
                            Please read how UPLIFT collects, uses, safeguards, and shares personal data before creating an {accountLabel} account.
                        </p>
                    </header>

                    <div className="space-y-10 px-6 py-8 sm:px-10 sm:py-10">
                        <section aria-labelledby="privacy-introduction">
                            <h2 id="privacy-introduction" className="text-2xl font-black text-slate-900">Privacy Notice</h2>
                            <p className="mt-4 leading-7 text-slate-600">
                                UPLIFT processes personal data in accordance with the Data Privacy Act of 2012 and its implementing rules and principles. This notice describes the information involved in account creation and the ordinary uses of that information.
                            </p>
                            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                                <strong>Important:</strong> An account does not authorize unrelated use of your information. Processing is limited to the purposes described here, your instructions, account services you request, or another basis permitted by applicable law.
                            </div>
                        </section>

                        <div className="grid gap-5 md:grid-cols-2">
                            {PRIVACY_SECTIONS.map(({ icon: Icon, title, text, candidateText, employerText }) => (
                                <section key={title} className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                        <Icon size={22} aria-hidden="true" />
                                    </div>
                                    <h2 className="text-lg font-black text-slate-900">{title}</h2>
                                    <p className="mt-3 text-sm leading-6 text-slate-600">
                                        {candidateText || employerText ? (isCandidate ? candidateText : employerText) : text}
                                    </p>
                                </section>
                            ))}
                        </div>

                        <section className="rounded-2xl border border-slate-200 p-6" aria-labelledby="privacy-contact">
                            <h2 id="privacy-contact" className="text-lg font-black text-slate-900">Privacy Concerns</h2>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                                To exercise a privacy right or ask about this notice, contact the UPLIFT administrator or the authorized LGU or NCDA deployment office that issued your account through its official support channel.
                            </p>
                        </section>

                        {isRegistration && (
                            <section className="rounded-[1.5rem] bg-blue-50 p-6 ring-1 ring-blue-100 sm:p-8" aria-labelledby="privacy-acknowledgment">
                                <h2 id="privacy-acknowledgment" className="text-xl font-black text-slate-900">Required acknowledgment</h2>
                                <label className="mt-5 flex cursor-pointer items-start gap-4 rounded-2xl bg-white p-5 text-sm leading-6 text-slate-700 shadow-sm ring-1 ring-slate-100">
                                    <input
                                        type="checkbox"
                                        checked={acknowledged}
                                        onChange={(event) => setAcknowledged(event.target.checked)}
                                        className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
                                    />
                                    <span>
                                        I have read this notice and give my informed and unambiguous consent for UPLIFT to collect and process my personal data, including sensitive disability or accommodation information where applicable, for account creation and the services described above. I understand that authorized employer accounts may receive relevant profile and application information for recruitment. I understand that this acknowledgment does not waive or remove any right under Republic Act No. 10173.
                                    </span>
                                </label>

                                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={() => navigate(returnPath)}
                                        className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!acknowledged}
                                        onClick={handleContinue}
                                        className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-7 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        I Agree and Continue <ArrowRight size={18} aria-hidden="true" />
                                    </button>
                                </div>
                                <p className="mt-4 text-right text-xs font-bold text-blue-700">Next: {continueLabel}</p>
                            </section>
                        )}

                        {!isRegistration && (
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => navigate(returnPath)}
                                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-black uppercase tracking-wider text-white transition hover:bg-blue-700"
                                >
                                    Return to UPLIFT <ArrowRight size={18} aria-hidden="true" />
                                </button>
                            </div>
                        )}
                    </div>
                </article>
            </div>
        </div>
    );
};

export default DataPrivacyAct;
