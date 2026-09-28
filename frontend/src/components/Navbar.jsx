import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
    User, LogOut, ChevronDown, Accessibility, Search, Building, 
    Settings2, Briefcase, Menu, X, ShieldCheck, Home 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Automatically close menus on route change
    useEffect(() => {
        setMobileMenuOpen(false);
        setDropdownOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm transition-colors duration-300" aria-label="Main navigation">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Brand */}
                    <div className="flex items-center gap-6 sm:gap-8">
                        <Link to="/" className="flex items-center gap-2 group" aria-label="Home">
                            <Accessibility className="text-[#0038A8] w-6 h-6 transition-transform group-hover:scale-110" aria-hidden="true" />
                            <span className="font-black text-xl tracking-tight text-[#0038A8]">UPLIFT</span>
                        </Link>
                        
                        {/* Desktop Links */}
                        {user && (
                            <div className="hidden md:flex gap-6 text-sm font-semibold text-slate-500" role="list">
                                {user.role === 'user' && (
                                    <Link to="/dashboard" role="listitem" className={`hover:text-[#0038A8] flex items-center gap-1.5 transition-colors ${location.pathname === '/dashboard' ? 'text-[#0038A8] font-black' : ''}`}>
                                        <Search size={16} aria-hidden="true" /> Jobs
                                    </Link>
                                )}
                                {user.role === 'employer' && (
                                    <Link to="/employer" role="listitem" className={`hover:text-[#0038A8] flex items-center gap-1.5 transition-colors ${location.pathname === '/employer' ? 'text-[#0038A8] font-black' : ''}`}>
                                        <Building size={16} aria-hidden="true" /> Employer Portal
                                    </Link>
                                )}
                                {user.role === 'admin' && (
                                    <Link to="/admin" role="listitem" className={`hover:text-[#0038A8] flex items-center gap-1.5 transition-colors ${location.pathname === '/admin' ? 'text-[#0038A8] font-black' : ''}`}>
                                        <Settings2 size={16} aria-hidden="true" /> Admin
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {!user ? (
                            <>
                                <div className="hidden sm:flex items-center gap-2">
                                    <button 
                                        onClick={() => navigate('/?mode=login')}
                                        className="text-slate-600 hover:text-[#0038A8] font-bold text-sm px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors" 
                                        aria-label="Log in to your account"
                                    >
                                        Log in
                                    </button>
                                    <button 
                                        onClick={() => navigate('/privacy?intent=register&for=candidate')}
                                        className="bg-[#0038A8] hover:bg-blue-800 text-white font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-200 active:scale-95" 
                                        aria-label="Create a new account"
                                    >
                                        Sign up
                                    </button>
                                </div>
                                {/* Mobile Hamburger for guest */}
                                <button 
                                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                    className="md:hidden p-2 rounded-xl text-slate-600 hover:text-[#0038A8] hover:bg-slate-100 transition-colors"
                                    aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
                                    aria-expanded={mobileMenuOpen}
                                >
                                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                {/* User Dropdown on Desktop / Quick Info */}
                                <div className="relative">
                                    <button 
                                        onClick={() => setDropdownOpen(!dropdownOpen)}
                                        className="flex items-center gap-2 hover:bg-slate-50 p-1.5 sm:px-3 sm:py-2 rounded-xl transition"
                                        aria-expanded={dropdownOpen}
                                        aria-haspopup="true"
                                        aria-label="User menu"
                                    >
                                        <div className="w-8 h-8 bg-blue-100 text-[#0038A8] rounded-full flex items-center justify-center font-black text-xs" aria-hidden="true">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 hidden sm:block max-w-[120px] truncate">{user.name}</span>
                                        <ChevronDown size={14} className="text-slate-400 hidden sm:block" aria-hidden="true" />
                                    </button>
                                    
                                    {dropdownOpen && (
                                        <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50" role="menu" aria-label="User menu options">
                                            <div className="px-4 py-2.5 border-b border-slate-100 mb-1">
                                                <p className="text-xs font-black text-slate-800 truncate">{user.name}</p>
                                                <p className="text-[11px] font-semibold text-slate-400 truncate">{user.email}</p>
                                            </div>
                                            {user.role === 'user' && (
                                                <>
                                                    <Link to="/profile" role="menuitem" className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5">
                                                        <User size={16} className="text-slate-400" aria-hidden="true" /> Customize Profile
                                                    </Link>
                                                    <Link to="/applications" role="menuitem" className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5">
                                                        <Briefcase size={16} className="text-slate-400" aria-hidden="true" /> Job Applications
                                                    </Link>
                                                </>
                                            )}
                                            {user.role === 'employer' && (
                                                <Link to="/employer" role="menuitem" className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5">
                                                    <Building size={16} className="text-slate-400" aria-hidden="true" /> Employer Portal
                                                </Link>
                                            )}
                                            {user.role === 'admin' && (
                                                <Link to="/admin" role="menuitem" className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5">
                                                    <Settings2 size={16} className="text-slate-400" aria-hidden="true" /> Admin Panel
                                                </Link>
                                            )}
                                            <hr className="my-1.5 border-slate-100" />
                                            <button 
                                                onClick={handleLogout}
                                                role="menuitem"
                                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5"
                                            >
                                                <LogOut size={16} className="text-rose-400" aria-hidden="true" /> Logout
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Mobile Menu Button for logged in user */}
                                <button 
                                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                    className="md:hidden p-2 rounded-xl text-slate-600 hover:text-[#0038A8] hover:bg-slate-100 transition-colors"
                                    aria-label={mobileMenuOpen ? "Close menu" : "Open navigation menu"}
                                    aria-expanded={mobileMenuOpen}
                                >
                                    {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Drawer */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="md:hidden border-t border-slate-100 bg-white px-4 py-4 space-y-2 shadow-xl"
                    >
                        {!user ? (
                            <div className="space-y-2">
                                <Link 
                                    to="/" 
                                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#0038A8] transition-colors"
                                >
                                    <Home size={18} className="text-slate-400" /> Home
                                </Link>
                                <Link 
                                    to="/jobs" 
                                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#0038A8] transition-colors"
                                >
                                    <Search size={18} className="text-slate-400" /> Browse Jobs
                                </Link>
                                <Link 
                                    to="/privacy" 
                                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#0038A8] transition-colors"
                                >
                                    <ShieldCheck size={18} className="text-slate-400" /> Data Privacy & Inclusion
                                </Link>
                                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => navigate('/?mode=login')}
                                        className="w-full py-3 text-center rounded-xl bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors"
                                    >
                                        Log In
                                    </button>
                                    <button 
                                        onClick={() => navigate('/privacy?intent=register&for=candidate')}
                                        className="w-full py-3 text-center rounded-xl bg-[#0038A8] text-white font-black text-xs uppercase tracking-wider hover:bg-blue-800 transition-colors shadow-sm"
                                    >
                                        Sign Up
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {user.role === 'user' && (
                                    <>
                                        <Link 
                                            to="/dashboard" 
                                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-colors ${
                                                location.pathname === '/dashboard' 
                                                    ? 'bg-blue-50 text-[#0038A8] font-black' 
                                                    : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Search size={18} className="text-[#0038A8]" /> Discover Jobs
                                        </Link>
                                        <Link 
                                            to="/profile" 
                                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-colors ${
                                                location.pathname === '/profile' 
                                                    ? 'bg-blue-50 text-[#0038A8] font-black' 
                                                    : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <User size={18} className="text-[#0038A8]" /> Customize Profile
                                        </Link>
                                        <Link 
                                            to="/applications" 
                                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-colors ${
                                                location.pathname === '/applications' 
                                                    ? 'bg-blue-50 text-[#0038A8] font-black' 
                                                    : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Briefcase size={18} className="text-[#0038A8]" /> Job Applications
                                        </Link>
                                    </>
                                )}
                                {user.role === 'employer' && (
                                    <Link 
                                        to="/employer" 
                                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#0038A8] transition-colors"
                                    >
                                        <Building size={18} className="text-[#0038A8]" /> Employer Portal
                                    </Link>
                                )}
                                {user.role === 'admin' && (
                                    <Link 
                                        to="/admin" 
                                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#0038A8] transition-colors"
                                    >
                                        <Settings2 size={18} className="text-[#0038A8]" /> Admin Portal
                                    </Link>
                                )}
                                <div className="pt-2 border-t border-slate-100">
                                    <button 
                                        onClick={handleLogout}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-50 text-rose-600 font-bold text-xs uppercase tracking-wider hover:bg-rose-100 transition-colors"
                                    >
                                        <LogOut size={16} /> Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default Navbar;
