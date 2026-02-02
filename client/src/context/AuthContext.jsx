import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Add loading state

    useEffect(() => {
        const checkLoggedIn = async () => {
            try {
                const response = await axios.get('http://localhost:5001/api/auth/me', { withCredentials: true });
                setUser(response.data.data.user);
            } catch (error) {
                // If 401/403, user is not logged in, which is fine
                setUser(null);
            } finally {
                setLoading(false);
            }
        };
        checkLoggedIn();
    }, []);

    const login = async (email, password) => {
        try {
            const response = await axios.post('http://localhost:5001/api/auth/login', { email, password }, { withCredentials: true });
            const userData = response.data.data.user;
            setUser(userData);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.data?.result || "Login failed" };
        }
    };

    const register = async (username, email, password) => {
        try {
            await axios.post('http://localhost:5001/api/auth/register', { username, email, password }, { withCredentials: true });
            const userData = { username, email }; 
            setUser(userData);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.data?.result || "Registration failed" };
        }
    };

    const logout = async () => {
        try {
            await axios.post('http://localhost:5001/api/auth/logout', {}, { withCredentials: true });
        } catch (e) {
            console.error("Logout error", e);
        }
        setUser(null);
    };

    if (loading) {
        return <div style={{color: 'white', padding: '20px'}}>Loading...</div>; // Prevent redirect flash
    }

    return (
        <AuthContext.Provider value={{ user, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);