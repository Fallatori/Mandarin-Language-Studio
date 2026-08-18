import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
    const location = useLocation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [usage, setUsage] = useState(null);

    const isActive = (path) => {
        return location.pathname === path ? 'nav-item active' : 'nav-item';
    };

    const handleLogout = async () => {
        if(confirm("Log out?")){
             await logout();
             navigate('/login');
        }
    };

    useEffect(() => {
        if (!user) return;
        axios
            .get('http://localhost:5001/api/sentences/translation-usage', { withCredentials: true })
            .then((response) => setUsage(response.data))
            .catch((err) => console.error('Failed to load translation usage:', err));
    }, [user, location.pathname]);

    if (!user) return null;

    const usagePercent = usage && usage.limit > 0
        ? Math.min(100, (usage.characterCount / usage.limit) * 100)
        : 0;

    const featureLabels = { word: 'Words', sentence: 'Sentences', story: 'Stories' };
    const featureBreakdown = usage
        ? Object.entries(usage.byFeature || {})
            .sort((a, b) => b[1] - a[1])
            .map(([feature, count]) => `${featureLabels[feature] || feature}: ${count.toLocaleString()} chars`)
            .join(' · ')
        : '';

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
                    <Link to="/stories" className={isActive('/stories')}>
                        <span className="material-symbols-outlined">auto_stories</span>
                        <span>Stories</span>
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
                {usage && (
                    <div className="translation-usage" title={`${usage.characterCount.toLocaleString()} of ${usage.limit.toLocaleString()} characters translated this month, shared across all users`}>
                        <div className="translation-usage-label">Translation this month</div>
                        <div className="translation-usage-count">{usage.characterCount.toLocaleString()} / {usage.limit.toLocaleString()} chars</div>
                        <div className="translation-usage-track">
                            <div
                                className={`translation-usage-fill${usagePercent >= 90 ? ' near-limit' : ''}`}
                                style={{ width: `${usagePercent}%` }}
                            />
                        </div>
                        {featureBreakdown && (
                            <div className="translation-usage-breakdown">{featureBreakdown}</div>
                        )}
                    </div>
                )}
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