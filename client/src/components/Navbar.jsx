import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const isActive = (path) => {
        return location.pathname === path ? 'nav-link active' : 'nav-link';
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <header className="app-navbar">
            <div className="navbar-brand">
                <Link to="/">汉语 Learning</Link>
            </div>

            {user && (
                <nav className="navbar-links">
                    <Link to="/" className={isActive('/')}>Sentences</Link>
                    <Link to="/words" className={isActive('/words')}>Word List</Link>
                </nav>
            )}

            <div className="navbar-profile">
                {user ? (
                    <div className="user-info">
                        <span className="user-name">Hello, {user.username || user.email}</span>
                        <button className="btn-logout" onClick={handleLogout}>Logout</button>
                    </div>
                ) : (
                    location.pathname !== '/login' && (
                        <Link to="/login" className="btn-login btn-login-link">Login</Link>
                    )
                )}
            </div>
        </header>
    );
}

export default Navbar;