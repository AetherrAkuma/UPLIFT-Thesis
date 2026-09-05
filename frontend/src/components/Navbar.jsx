import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ChevronDown, Accessibility, Search, Building, Settings2, Briefcase } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm transition-colors duration-300" aria-label="Main navigation">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-2" aria-label="Home">
                            <Accessibility className="text-blue-600 w-6 h-6" aria-hidden="true" />
                            <span className="font-bold text-xl tracking-tight text-blue-600">UPLIFT</span>
                        </Link>
                        
                        {user && (
                            <div className="hidden md:flex gap-6 text-sm font-medium text-slate-500" role="list">
                                {user.role === 'user' && (
                                    <Link to="/dashboard" role="listitem" className={`hover:text-blue-600 flex items-center gap-1 ${location.pathname === '/dashboard' ? 'text-blue-600' : ''}`}>
                                        <Search size={16} aria-hidden="true" /> Jobs
                                    </Link>
                                )}
                                {user.role === 'employer' && (
                                    <Link to="/employer" role="listitem" className={`hover:text-blue-600 flex items-center gap-1 ${location.pathname === '/employer' ? 'text-blue-600' : ''}`}>
                                        <Building size={16} aria-hidden="true" /> Employer Portal
                                    </Link>
                                )}
                                {user.role === 'admin' && (
                                    <Link to="/admin" role="listitem" className={`hover:text-blue-600 flex items-center gap-1 ${location.pathname === '/admin' ? 'text-blue-600' : ''}`}>
                                        <Settings2 size={16} aria-hidden="true" /> Admin
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        {!user ? (
                            <div className="flex items-center">
                                <button 
                                    onClick={() => navigate('/?mode=login')}
                                    className="text-slate-600 hover:text-blue-600 font-medium text-sm px-4" 
                                    aria-label="Log in to your account"
                                >
                                    Log in
                                </button>
                                <button 
                                    onClick={() => navigate('/?mode=register')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-5 py-2 rounded-lg transition-colors shadow-sm" 
                                    aria-label="Create a new account"
                                >
                                    Sign up
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <button 
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-2 hover:bg-slate-50 px-2 py-1 rounded-lg transition"
                                    aria-expanded={dropdownOpen}
                                    aria-haspopup="true"
                                    aria-label="User menu"
                                >
                                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm" aria-hidden="true">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 hidden sm:block">{user.name}</span>
                                    <ChevronDown size={14} className="text-slate-400" aria-hidden="true" />
                                </button>
                                
                                {dropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50" role="menu" aria-label="User menu options">
                                        <div className="px-4 py-2 border-b border-slate-100 mb-1">
                                            <p className="text-sm font-bold text-slate-800">{user.name}</p>
                                            <p className="text-xs text-slate-500">{user.email}</p>
                                        </div>
                                        {user.role === 'user' && (
                                            <>
                                                <Link to="/profile" role="menuitem" className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                    <User size={16} className="text-slate-400" aria-hidden="true" /> Customize Profile
                                                </Link>
                                                <Link to="/applications" role="menuitem" className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                    <Briefcase size={16} className="text-slate-400" aria-hidden="true" /> Job Application Status
                                                </Link>
                                            </>
                                        )}
                                        {user.role === 'employer' && (
                                            <>
                                                <Link to="/employer" role="menuitem" className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                    <Building size={16} className="text-slate-400" aria-hidden="true" /> Employer Portal
                                                </Link>
                                            </>
                                        )}
                                        {user.role === 'admin' && (
                                            <>
                                                <Link to="/admin" role="menuitem" className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                                    <Settings2 size={16} className="text-slate-400" aria-hidden="true" /> Admin Panel
                                                </Link>
                                            </>
                                        )}
                                        <hr className="my-1 border-slate-100" />
                                        <button 
                                            onClick={handleLogout}
                                            role="menuitem"
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                            <LogOut size={16} className="text-red-400" aria-hidden="true" /> Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
