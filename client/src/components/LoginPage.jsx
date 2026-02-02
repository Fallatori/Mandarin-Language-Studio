import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        let result;
        if (isLogin) {
            result = await login(email, password);
        } else {
            result = await register(username, email, password);
        }

        if (result.success) {
            navigate('/');
        } else {
            setError(result.message);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', background: '#333', borderRadius: '8px' }}>
            <h2 style={{color: '#fff'}}>{isLogin ? 'Login' : 'Register'}</h2>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {!isLogin && (
                    <div>
                        <label style={{color: '#ccc'}}>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </div>
                )}
                <div>
                    <label style={{color: '#ccc'}}>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{color: '#ccc'}}>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
            </form>
            <p style={{ marginTop: '15px', color: '#ccc' }}>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button 
                    onClick={() => { setIsLogin(!isLogin); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#646cff', padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
                >
                    {isLogin ? 'Register' : 'Login'}
                </button>
            </p>
        </div>
    );
}

export default LoginPage;