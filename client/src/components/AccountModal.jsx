import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';

function AccountModal({ isOpen, onClose }) {
    const { user, logout, deleteAccount } = useAuth();
    const navigate = useNavigate();
    const [confirming, setConfirming] = useState(false);
    const [emailConfirm, setEmailConfirm] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (isOpen) return;
        setConfirming(false);
        setEmailConfirm('');
        setPassword('');
        setError('');
        setBusy(false);
    }, [isOpen]);

    if (!user) return null;

    const emailMatches = emailConfirm.trim().toLowerCase() === (user.email || '').toLowerCase();
    const canDelete = emailMatches && password.length > 0 && !busy;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleDelete = async (e) => {
        e.preventDefault();
        if (!canDelete) return;

        setBusy(true);
        setError('');
        const result = await deleteAccount(password);
        if (result.success) {
            onClose();
            navigate('/login');
        } else {
            setError(result.message);
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Account">
            <div className="account-summary">
                <div className="account-field">
                    <span className="account-field-label">Username</span>
                    <span className="account-field-value">{user.username || '—'}</span>
                </div>
                <div className="account-field">
                    <span className="account-field-label">Email</span>
                    <span className="account-field-value">{user.email || '—'}</span>
                </div>
            </div>

            <button type="button" className="btn-primary account-logout-btn" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                Log out
            </button>

            {!confirming ? (
                <div className="account-footer">
                    <button
                        type="button"
                        className="account-delete-link"
                        onClick={() => setConfirming(true)}
                    >
                        Delete account
                    </button>
                </div>
            ) : (
                <div className="account-danger-zone">
                    <h4 className="account-danger-title">Delete account</h4>
                    <form onSubmit={handleDelete}>
                        <p className="account-danger-text">
                            This permanently deletes your account and everything only you hold:
                            your saved sentences, word list, stories, decks and all study progress.
                            <strong> There is no way to undo this.</strong>
                        </p>
                        <label className="input-label" htmlFor="account-delete-email">
                            Type <strong>{user.email}</strong> to confirm
                        </label>
                        <input
                            id="account-delete-email"
                            type="text"
                            className="input-field"
                            value={emailConfirm}
                            onChange={(e) => setEmailConfirm(e.target.value)}
                            autoComplete="off"
                            placeholder={user.email}
                        />
                        <label className="input-label account-delete-label" htmlFor="account-delete-password">
                            Enter your password
                        </label>
                        <input
                            id="account-delete-password"
                            type="password"
                            className="input-field"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />

                        {error && <p className="modal-error">{error}</p>}

                        <div className="modal-actions-right">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => { setConfirming(false); setEmailConfirm(''); setPassword(''); setError(''); }}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="btn-warning" disabled={!canDelete}>
                                {busy ? 'Deleting…' : 'Delete my account permanently'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </Modal>
    );
}

export default AccountModal;
