/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useContext, useEffect } from 'react';

const AccessibilityContext = createContext(null);

export const AccessibilityProvider = ({ children }) => {
    const [config, setConfig] = useState(() => {
        const saved = localStorage.getItem('upliftA11y');
        return saved ? JSON.parse(saved) : {
            theme: 'default',
            fontScale: 1.0,
            dyslexiaFont: false,
            readingGuide: false,
            largeCursor: false
        };
    });



    const applyA11y = () => {
        const { theme, fontScale, dyslexiaFont, largeCursor, readingGuide } = config;
        
        // Theme Management
        const html = document.documentElement;
        html.classList.remove('high-contrast', 'grayscale-theme', 'dark-mode');
        if (theme === 'high-contrast') html.classList.add('high-contrast');
        if (theme === 'grayscale') html.classList.add('grayscale-theme');
        if (theme === 'dark') html.classList.add('dark-mode');

        // Font Scale
        html.style.setProperty('--scale-factor', fontScale);

        // Dyslexia Font
        document.body.classList.toggle('dyslexia-font', dyslexiaFont);

        // Large Cursor
        document.body.classList.toggle('large-cursor', largeCursor);

        // Reading Guide
        let guide = document.getElementById('uplift-reading-guide');
        if (readingGuide) {
            if (!guide) {
                guide = document.createElement('div');
                guide.id = 'uplift-reading-guide';
                guide.className = 'reading-guide';
                document.body.appendChild(guide);
                
                const moveGuide = (e) => {
                    guide.style.top = `${e.clientY}px`;
                };
                window.addEventListener('mousemove', moveGuide);
                guide._cleanup = () => window.removeEventListener('mousemove', moveGuide);
            }
        } else {
            if (guide) {
                if (guide._cleanup) guide._cleanup();
                guide.remove();
            }
        }
    };

    useEffect(() => {
        localStorage.setItem('upliftA11y', JSON.stringify(config));
        applyA11y();
    }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateConfig = (newConfig) => {
        setConfig(prev => ({ ...prev, ...newConfig }));
    };

    const resetA11y = () => {
        setConfig({
            theme: 'default',
            fontScale: 1.0,
            dyslexiaFont: false,
            readingGuide: false,
            largeCursor: false
        });
    };

    return (
        <AccessibilityContext.Provider value={{ config, updateConfig, resetA11y }}>
            {children}
        </AccessibilityContext.Provider>
    );
};

export const useAccessibility = () => useContext(AccessibilityContext);
