/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('upliftToken'));
    const [loading, setLoading] = useState(true);
    const fetchingRef = useRef(false);

    const API_BASE_URL = '/api';

    useEffect(() => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        // Skip auth check if user explicitly logged out
        const loggedOut = sessionStorage.getItem('upliftLogout') === 'true';
        if (loggedOut) {
            sessionStorage.removeItem('upliftLogout');
            fetchingRef.current = false;
            setTimeout(() => setLoading(false), 0);
            return;
        }

        const storedToken = localStorage.getItem('upliftToken');
        const headers = storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {};

        axios.get(`${API_BASE_URL}/auth/me`, { headers })
        .then(res => {
            const freshToken = res.data.token || storedToken;
            if (freshToken) {
                try {
                    localStorage.setItem('upliftToken', freshToken);
                } catch (e) {
                    console.warn('localStorage write failed:', e.message);
                }
                setToken(freshToken);
            }
            setUser(res.data);
        })
        .catch(e => {
            const isAuthError = e.response && (e.response.status === 401 || e.response.status === 403);
            if (isAuthError) {
                localStorage.removeItem('upliftToken');
                setToken(null);
                setUser(null);
            }
        })
        .finally(() => {
            fetchingRef.current = false;
            setLoading(false);
        });
    }, []);

    const login = (newToken, userData) => {
        sessionStorage.removeItem('upliftLogout');
        try {
            localStorage.setItem('upliftToken', newToken);
        } catch (e) {
            console.warn('localStorage write failed:', e.message);
        }
        setToken(newToken);
        setUser(userData);
    };

    const logout = async () => {
        sessionStorage.setItem('upliftLogout', 'true');
        try {
            await axios.post(`${API_BASE_URL}/auth/logout`);
        } catch {
            // Server down is fine — local state is cleared
        }
        localStorage.removeItem('upliftToken');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, API_BASE_URL }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
