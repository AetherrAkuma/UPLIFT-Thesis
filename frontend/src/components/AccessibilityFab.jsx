import { useState, useEffect, useCallback } from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { Accessibility, X, Sun, Moon, Contrast, Droplet, Plus, Minus, Type, MousePointer2, RotateCcw, Volume2, Square, Eye } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

const AccessibilityFab = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { config, updateConfig, resetA11y } = useAccessibility();
    const [isReading, setIsReading] = useState(false);
    const panelRef = useFocusTrap(isOpen);

    const close = useCallback(() => setIsOpen(false), []);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, close]);

    const themes = [
        { id: 'default', name: 'Default', icon: <Sun size={18} />, label: 'Default theme' },
        { id: 'dark', name: 'Dark Mode', icon: <Moon size={18} />, label: 'Dark mode theme' },
        { id: 'high-contrast', name: 'Contrast', icon: <Contrast size={18} />, label: 'High contrast theme' },
        { id: 'grayscale', name: 'Grayscale', icon: <Droplet size={18} />, label: 'Grayscale theme' },
    ];

    const toggleReadPage = () => {
        if (isReading) {
            window.speechSynthesis.cancel();
            setIsReading(false);
        } else {
            const text = document.body.innerText;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => setIsReading(false);
            window.speechSynthesis.speak(utterance);
            setIsReading(true);
        }
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 transition-all hover:scale-110 active:scale-95"
                aria-label="Open Accessibility Menu"
                aria-expanded={isOpen}
                aria-controls="a11y-panel"
            >
                <Accessibility size={28} aria-hidden="true" />
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-end p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div 
                        ref={panelRef}
                        id="a11y-panel"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Accessibility settings"
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col p-6"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                <Accessibility className="text-blue-600" aria-hidden="true" /> Accessibility Suite
                            </h2>
                            <button onClick={close} className="text-slate-400 hover:text-slate-600" aria-label="Close accessibility menu">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar space-y-8">
                            {/* Visual Theme */}
                            <section aria-label="Visual theme options">
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-slate-400" id="a11y-theme-label">Visual Theme</p>
                                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="a11y-theme-label">
                                    {themes.map(t => (
                                        <button 
                                            key={t.id}
                                            onClick={() => updateConfig({ theme: t.id })}
                                            role="radio"
                                            aria-checked={config.theme === t.id}
                                            aria-label={t.label}
                                            className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${config.theme === t.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}
                                        >
                                            {t.icon}
                                            <span className="text-[10px] font-bold">{t.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Font Scaling */}
                            <section aria-label="Font size controls">
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-slate-400">Font Scaling</p>
                                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                    <button 
                                        onClick={() => updateConfig({ fontScale: Math.max(0.8, config.fontScale - 0.1) })}
                                        aria-label="Decrease font size"
                                        className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center font-bold text-lg text-slate-600 transition-colors shadow-sm"
                                    >
                                        <Minus size={18} aria-hidden="true" />
                                    </button>
                                    <span className="text-sm font-bold text-slate-700" aria-live="polite" aria-atomic="true">{Math.round(config.fontScale * 100)}%</span>
                                    <button 
                                        onClick={() => updateConfig({ fontScale: Math.min(1.8, config.fontScale + 0.1) })}
                                        aria-label="Increase font size"
                                        className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center font-bold text-lg text-slate-600 transition-colors shadow-sm"
                                    >
                                        <Plus size={18} aria-hidden="true" />
                                    </button>
                                </div>
                            </section>

                            {/* Typography & Aids */}
                            <section aria-label="Reading aids">
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-slate-400">Aids & Tools</p>
                                <div className="space-y-2">
                                    <button 
                                        onClick={() => updateConfig({ dyslexiaFont: !config.dyslexiaFont })}
                                        aria-pressed={config.dyslexiaFont}
                                        className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${config.dyslexiaFont ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-500'}`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-2"><Type size={16} aria-hidden="true"/> Dyslexia Friendly</span>
                                        {config.dyslexiaFont && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                                    </button>
                                    <button 
                                        onClick={() => updateConfig({ readingGuide: !config.readingGuide })}
                                        aria-pressed={config.readingGuide}
                                        className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${config.readingGuide ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-500'}`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-2"><Eye size={16} aria-hidden="true"/> Reading Guide</span>
                                        {config.readingGuide && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                                    </button>
                                    <button 
                                        onClick={() => updateConfig({ largeCursor: !config.largeCursor })}
                                        aria-pressed={config.largeCursor}
                                        className={`w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${config.largeCursor ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-500'}`}
                                    >
                                        <span className="text-xs font-bold flex items-center gap-2"><MousePointer2 size={16} aria-hidden="true"/> Large Cursor</span>
                                        {config.largeCursor && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                                    </button>
                                </div>
                            </section>

                            {/* Audio Support */}
                            <section aria-label="Audio support">
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-slate-400">Audio Support</p>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={toggleReadPage}
                                        aria-label={isReading ? 'Stop reading page aloud' : 'Read page aloud'}
                                        className={`flex-1 ${isReading ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white p-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors`}
                                    >
                                        {isReading ? <Square size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
                                        {isReading ? 'Stop Reading' : 'Read Page'}
                                    </button>
                                </div>
                            </section>
                        </div>

                        <button 
                            onClick={resetA11y}
                            className="mt-6 w-full text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors py-2 flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={12} aria-hidden="true" /> Reset to Default
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AccessibilityFab;
