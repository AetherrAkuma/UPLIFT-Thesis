import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    Lock, Eye, EyeOff, 
    Check, AlertCircle, X, Shield, KeyRound, Loader2 
} from 'lucide-react';

const ProfileSettingsModal = ({ isOpen, onClose }) => {
    const { token, API_BASE_URL } = useAuth();
    const toast = useToast();

    // Password form states
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showOldPassword, setShowOldPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    // Reset password fields when modal opens or closes
    useEffect(() => {
        if (isOpen) {
            setPasswordError('');
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowOldPassword(false);
            setShowNewPassword(false);
            setShowConfirmPassword(false);
        }
    }, [isOpen]);

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
                aria-labelledby="password-settings-title"
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
                    className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 my-8"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="relative px-6 pt-6 pb-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-slate-50/60">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-[#0038A8] flex items-center justify-center shadow-sm">
                                    <KeyRound size={20} />
                                </div>
                                <div>
                                    <h2 id="password-settings-title" className="text-lg font-black text-slate-800 tracking-tight">
                                        Password & Security
                                    </h2>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Update and manage your account password
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
                    </div>

                    {/* Modal Body */}
                    <div className="p-6">
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
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ProfileSettingsModal;
