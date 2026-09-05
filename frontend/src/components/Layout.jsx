import Navbar from './Navbar';
import AccessibilityFab from './AccessibilityFab';
import { useLocation } from 'react-router-dom';

const Layout = ({ children }) => {
    const location = useLocation();
    const isLandingPage = location.pathname === '/';
    const isEmployerPage = location.pathname === '/employer' || location.pathname.startsWith('/employer/');
    const isAdminPage = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
    const showDefaultNavbar = !isLandingPage && !isEmployerPage && !isAdminPage;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <a href="#main-content" className="skip-to-content">Skip to content</a>
            {showDefaultNavbar && <Navbar />}
            <main id="main-content" className="flex-1" aria-live="polite" aria-label="Main content">
                {children}
            </main>
            <AccessibilityFab />
            
            <footer className={`bg-white border-t border-slate-200 py-12 mt-auto ${isEmployerPage ? 'lg:ml-80' : ''} ${isAdminPage ? 'lg:ml-72' : ''}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="font-bold text-xl tracking-tight text-blue-600">UPLIFT</span>
                            </div>
                            <p className="text-slate-500 text-sm max-w-xs">
                                Empowering Persons with Disabilities through intelligent job matching and inclusive career growth.
                            </p>
                        </div>
                        <div className="flex gap-12">
                            <div className="flex flex-col gap-3">
                                <span className="font-bold text-slate-800 text-sm">Platform</span>
                                <a href="#" className="text-slate-500 hover:text-blue-600 text-sm">For Candidates</a>
                                <a href="#" className="text-slate-500 hover:text-blue-600 text-sm">For Employers</a>
                            </div>
                            <div className="flex flex-col gap-3">
                                <span className="font-bold text-slate-800 text-sm">Company</span>
                                <a href="#" className="text-slate-500 hover:text-blue-600 text-sm">About Us</a>
                                <a href="#" className="text-slate-500 hover:text-blue-600 text-sm">Contact</a>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-slate-100 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-slate-400 text-xs">© 2026 UPLIFT Platform. All rights reserved.</p>
                        <div className="flex gap-6">
                            <a href="#" className="text-slate-400 hover:text-slate-600 text-xs">Privacy Policy</a>
                            <a href="#" className="text-slate-400 hover:text-slate-600 text-xs">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Layout;
