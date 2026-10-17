import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    User, Mail, Phone, MapPin, Lock, Eye, EyeOff, 
    Check, AlertCircle, X, Shield, KeyRound, Loader2 
} from 'lucide-react';

const ProfileSettingsModal = ({ isOpen, onClose }) => {
    const { user, token, login, API_BASE_URL } = useAuth();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'password'

    // Profile form states
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [address, setAddress] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileError, setProfileError] = useState('');

    // Password form states
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    // Prepopulate data when modal opens or user changes
    useEffect(() => {
        if (user && isOpen) {
            setName(user.name || '');
            setEmail(user.email || '');
            setContactNumber(user.contact_number || '');
            setAddress(user.address || '');
            setProfileError('');
            setPasswordError('');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
    }, [user, isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setProfileError('');

        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        const trimmedContact = contactNumber.trim();
        const trimmedAddress = address.trim();

        if (!trimmedName || trimmedName.length < 2) {
            setProfileError('Full name must be at least 2 characters long.');
            return;
        }

        if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
            setProfileError('Please provide a valid email address.');
            return;
        }

        setSavingProfile(true);
        try {
            const res = await axios.put(`${API_BASE_URL}/auth/profile-settings`, {
                name: trimmedName,
                email: trimmedEmail,
                contact_number: trimmedContact,
                address: trimmedAddress
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.data?.user && res.data?.token) {
                login(res.data.token, res.data.user);
            }
            toast.success('Profile details updated successfully!');
            onClose();
        } catch (err) {
            const msg = err.response?.data?.detail || 'Failed to update profile settings.';
            setProfileError(msg);
            toast.error(msg);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSavePassword = async (e) => {
        e.preventDefault();
        setPasswordError('');

        if (!oldPassword) {
            setPasswordError('Please enter your current password.');
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            setPasswordError('New password must be at least 6 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match.');
            return;
        }

        setSavingPassword(true);
        try {
            await axios.post(`${API_BASE_URL}/auth/change-password`, {
                old_password: oldPassword,
                new_password: newPassword
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            toast.success('Password changed successfully!');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
            onClose();
        } catch (err) {
            const msg = err.response?.data?.detail || 'Failed to change password. Please check your current password.';
            setPasswordError(msg);
            toast.error(msg);
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <AnimatePresence>
            <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-settings-title"
            >
                {/* Backdrop click */}
                <div 
                    className="fixed inset-0" 
                    onClick={onClose} 
                    aria-hidden="true" 
                />

                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 my-8"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="relative px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-slate-50/60">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-[#0038A8] flex items-center justify-center shadow-sm">
                                    <KeyRound size={20} />
                                </div>
                                <div>
                                    <h2 id="profile-settings-title" className="text-lg font-black text-slate-800 tracking-tight">
                                        Profile Settings
                                    </h2>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Manage your account identity, contact details, and password
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                aria-label="Close modal"
                                id="profile-settings-close-btn"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mt-5">
                            <button
                                type="button"
                                onClick={() => setActiveTab('profile')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    activeTab === 'profile'
                                        ? 'bg-[#0038A8] text-white shadow-sm shadow-blue-200'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                                id="tab-profile-info"
                            >
                                <User size={15} />
                                <span>General Info</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('password')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    activeTab === 'password'
                                        ? 'bg-[#0038A8] text-white shadow-sm shadow-blue-200'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                                id="tab-password-change"
                            >
                                <Lock size={15} />
                                <span>Password & Security</span>
                            </button>
                        </div>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6">
                        {activeTab === 'profile' ? (
                            <form onSubmit={handleSaveProfile} className="space-y-4">
                                {profileError && (
                                    <div className="flex items-center gap-2 p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                                        <AlertCircle size={16} className="shrink-0" />
                                        <span>{profileError}</span>
                                    </div>
                                )}

                                {/* Full Name */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="settings-name">
                                        Full Name <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="settings-name"
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter your full name"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0038A8] focus:bg-white transition"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Email Address */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="settings-email">
                                        Email Address <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="settings-email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="name@example.com"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0038A8] focus:bg-white transition"
                                            required
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Used for account sign in and official platform notifications.
                                    </p>
                                </div>

                                {/* Contact Number */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="settings-contact">
                                        Contact Number
                                    </label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="settings-contact"
                                            type="tel"
                                            value={contactNumber}
                                            onChange={(e) => setContactNumber(e.target.value)}
                                            placeholder="e.g. 0917 123 4567 or +63 917 123 4567"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0038A8] focus:bg-white transition"
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Potential employers will use this number to reach out for interview invitations.
                                    </p>
                                </div>

                                {/* Address */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="settings-address">
                                        Address / Location
                                    </label>
                                    <div className="relative">
                                        <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="settings-address"
                                            type="text"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="e.g. Quezon City, Metro Manila, Philippines"
                                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0038A8] focus:bg-white transition"
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Helps compute distance and location suitability for physical and hybrid jobs.
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingProfile}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0038A8] hover:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-200 transition-all disabled:opacity-60 active:scale-95"
                                        id="settings-save-profile-btn"
                                    >
                                        {savingProfile ? (
                                            <>
                                                <Loader2 size={15} className="animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Check size={15} />
                                                <span>Save Profile Changes</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleSavePassword} className="space-y-4">
                                {passwordError && (
                                    <div className="flex items-center gap-2 p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                                        <AlertCircle size={16} className="shrink-0" />
                                        <span>{passwordError}</span>
                                    </div>
                                )}

                                {/* Current Password */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="settings-old-password">
                                        Current Password <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="settings-old-password"
                                            type={showOldPassword ? "text" : "password"}
                                            value={oldPassword}
                                            onChange={(e) => setOldPassword(e.target.value)}
                                            placeholder="Enter your current password"
                                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0038A8] focus:bg-white transition"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowOldPassword(!showOldPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                            aria-label={showOldPassword ? "Hide current password" : "Show current password"}
                                        >
                                            {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* New Password */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="settings-new-password">
                                        New Password <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="settings-new-password"
                                            type={showNewPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Enter your new password (min. 6 characters)"
                                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0038A8] focus:bg-white transition"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                            aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                                        >
                                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Must be at least 6 characters long.
                                    </p>
                                </div>

                                {/* Confirm New Password */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="settings-confirm-password">
                                        Confirm New Password <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="settings-confirm-password"
                                            type={showConfirmPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Re-enter your new password"
                                            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0038A8] focus:bg-white transition"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                            aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                                        >
                                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    {newPassword && confirmPassword && (
                                        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                                            {newPassword === confirmPassword ? (
                                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                                    <Check size={13} /> Passwords match
                                                </span>
                                            ) : (
                                                <span className="text-rose-500 font-semibold flex items-center gap-1">
                                                    <AlertCircle size={13} /> Passwords do not match
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingPassword}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0038A8] hover:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-200 transition-all disabled:opacity-60 active:scale-95"
                                        id="settings-save-password-btn"
                                    >
                                        {savingPassword ? (
                                            <>
                                                <Loader2 size={15} className="animate-spin" />
                                                <span>Updating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Shield size={15} />
                                                <span>Update Password</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ProfileSettingsModal;
