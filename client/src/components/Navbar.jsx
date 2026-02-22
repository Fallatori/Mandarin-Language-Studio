import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
    const location = useLocation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const isActive = (path) => {
        return location.pathname === path ? 'nav-item active' : 'nav-item';
    };

    const handleLogout = async () => {
        if(confirm("Log out?")){
             await logout();
             navigate('/login');
        }
    };

    if (!user) return null;

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="logo-container">
                    <div className="logo-icon">
                        <span className="material-symbols-outlined">translate</span>
                    </div>
                    <div className="logo-text">
                        <h1 className="font-bold">Mandarin</h1>
                        <p>Language Studio</p>
                    </div>
                </div>

                <nav className="nav-menu">
                    <Link to="/" className={isActive('/')}>
                        <span className="material-symbols-outlined">list_alt</span>
                        <span>Sentences</span>
                    </Link>
                    <Link to="/words" className={isActive('/words')}>
                        <span className="material-symbols-outlined">book_2</span>
                        <span>Word List</span>
                    </Link>
                    <Link to="/cards" className={isActive('/cards')}>
                        <span className="material-symbols-outlined">history</span>
                        <span>Recap</span>
                    </Link>
                    <Link to="/decks" className={isActive('/decks')}>
                        <span className="material-symbols-outlined">layers</span>
                        <span>Decks</span>
                    </Link>
                </nav>
            </div>

            <div className="sidebar-footer">
                <div className="user-profile" onClick={handleLogout} title="Click to Logout">
                    <div className="user-avatar">
                        <span className="material-symbols-outlined" style={{color:'#64748b'}}>person</span>
                    </div>
                    <div className="user-details">
                        <p className="name">{user.username || 'User'}</p>
                        <p className="role">Learner</p>
                    </div>
                    <span className="material-symbols-outlined" style={{marginLeft:'auto', color:'#64748b', fontSize:'1.2rem'}}>logout</span>
                </div>
            </div>
            
        </aside>
    );
}

export default Navbar;