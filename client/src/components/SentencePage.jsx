import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import SentenceForm from './SentenceForm';
import SentenceList from './SentenceList';
import BulkUploadForm from './BulkUploadForm';
import HanziText from './HanziText';
import Modal from './Modal';

const API_URL = 'http://localhost:5001/api/sentences';
const AUDIO_BASE_URL = 'http://localhost:5001/uploads/';

function SentencePage() {
    const navigate = useNavigate();
    const [sentences, setSentences] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all', 'due', 'difficult'
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('single');
    const [searchTerm, setSearchTerm] = useState("");
    const [editingSentence, setEditingSentence] = useState(null);
    const [editForm, setEditForm] = useState({ pinyin: '', englishTranslation: '' });
    const [editError, setEditError] = useState(null);

    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset pagination when filter or search changes
    useEffect(() => {
        setSentences([]);
        setPage(1);
        setHasMore(true);
    }, [filter, debouncedSearch]);

    const fetchSentences = useCallback(async (pageNum, currentFilter, currentSearch) => {
        setIsLoading(true);
        setError(null);
        try {
            const query = new URLSearchParams({
                filter: currentFilter,
                page: pageNum,
                limit: 20,
            });
            if (currentSearch) query.set('search', currentSearch);

            const response = await axios.get(`${API_URL}?${query}`, { withCredentials: true });
            const { sentences: newSentences, hasMore: moreAvailable } = response.data;

            setSentences(prev => {
                return pageNum === 1 ? newSentences : [...prev, ...newSentences];
            });
            setHasMore(moreAvailable);
        } catch (err) {
            console.error(err); 
             if (err.response && err.response.status === 401) navigate('/login');
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchSentences(page, filter, debouncedSearch);
    }, [fetchSentences, page, filter, debouncedSearch]);

    const displaySentences = sentences;

    const handleOpenModal = (mode) => {
        setModalMode(mode);
        setIsModalOpen(true);
    };

    const addSentence = async (formData) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.post(API_URL, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true,
            });
            setSentences(prev => [response.data, ...prev]);
            setIsModalOpen(false);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                navigate('/login');
                return;
            }
            console.error("Failed to add sentence:", err);
            setError(err.response?.data?.message || "Failed to add sentence.");
        } finally {
             setIsLoading(false);
        }
    };

    const openEditModal = (sentence) => {
        setEditingSentence(sentence);
        setEditForm({
            pinyin: sentence.pinyin || '',
            englishTranslation: sentence.englishTranslation || '',
        });
        setEditError(null);
    };

    const saveEditedSentence = async (event) => {
        event.preventDefault();
        setEditError(null);
        try {
            const response = await axios.put(
                `${API_URL}/${editingSentence.id}`,
                editForm,
                { withCredentials: true }
            );
            const updated = response.data;
            setSentences(prev => prev.map(s => (
                s.id === updated.id ? { ...s, ...updated } : s
            )));
            setEditingSentence(null);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                navigate('/login');
                return;
            }
            console.error("Failed to update sentence:", err);
            setEditError(err.response?.data?.message || "Failed to update sentence.");
        }
    };

    const handleBulkComplete = (newSentences) => {
        if (newSentences && newSentences.length > 0) {
            setSentences(prev => [...newSentences, ...prev]);
        }
        setIsModalOpen(false);
    };

    const deleteSentence = async (id) => {
        if(!window.confirm("Are you sure?")) return;
        try {
             await axios.delete(`${API_URL}/${id}`, { withCredentials: true });
             setSentences(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            if (err.response && err.response.status === 401) navigate('/login');
            console.error(err);
        }
    }

    //  const markAsPracticed = async (id) => {
    //     try {
    //         const response = await axios.patch(`${API_URL}/${id}/practice`, {}, { withCredentials: true });
    //         const updatedSentence = response.data;
    //         setSentences(prev => prev.map(s => s.id === id ? updatedSentence : s));
    //     } catch (err) { 
    //         if (err.response && err.response.status === 401) navigate('/login');
    //         console.error(err); 
    //     }
    // };
    
    const toggleDifficult = async (id, currentDifficulty) => {
        try {
            const desiredState = typeof currentDifficulty === 'boolean' ? currentDifficulty : true; 

            const response = await axios.patch(
                `${API_URL}/${id}/difficult`,
                { difficult: desiredState },
                { withCredentials: true }
            );

            setSentences(prev => prev.map(s => {
                if (s.id === id) {
                    const updated = { ...s };
                    updated.progress = { ...(s.progress || {}), ...response.data };
                    return updated;
                }
                return s;
            }));
        } catch (err) {
            if (err.response && err.response.status === 401) navigate('/login');
            console.error("Failed to toggle difficulty:", err);
        }
    };

    return (
        <div>
            {/* Header Section */}
            <div className="content-header">
                <div className="header-top">
                    <div className="header-title">
                        <h2>My Sentences</h2>
                        <p>Manage and review your saved Mandarin phrases</p>
                    </div>
                    <div className="action-buttons">
                        <button className="btn-outline" onClick={() => handleOpenModal('bulk')}>
                            <span className="material-symbols-outlined">upload</span>
                            <span>Bulk Upload</span>
                        </button>
                        <button className="btn-primary" onClick={() => handleOpenModal('single')}>
                            <span className="material-symbols-outlined">add</span>
                            <span>New Sentence</span>
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="toolbar">
                    <div className="search-wrapper">
                         <span className="material-symbols-outlined search-icon">search</span>
                         <input 
                            className="search-input" 
                            type="text" 
                            placeholder="Search by character, pinyin, or translation..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                         />
                    </div>
                    
                    <div className="filter-pills">
                        <button 
                            className={`pill-btn ${filter === 'all' ? 'active' : ''}`} 
                            onClick={() => setFilter('all')}
                        >
                            All Sentences
                        </button>
                        <button 
                            className={`pill-btn ${filter === 'due' ? 'active' : ''}`} 
                            onClick={() => setFilter('due')}
                        >
                            Due for Review
                        </button>
                        <button 
                            className={`pill-btn ${filter === 'difficult' ? 'active' : ''}`} 
                            onClick={() => setFilter('difficult')}
                        >
                            Difficult
                        </button>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                {modalMode === 'single' ? (
                    <SentenceForm
                        onAddSentence={addSentence}
                        isLoading={isLoading}
                    />
                ) : (
                    <BulkUploadForm
                        onUploadComplete={handleBulkComplete}
                        onCancel={() => setIsModalOpen(false)}
                    />
                )}
                {error && modalMode === 'single' && <p className="modal-error">{error}</p>}
            </Modal>

            <Modal
                isOpen={!!editingSentence}
                onClose={() => setEditingSentence(null)}
                title="Edit Sentence"
            >
                {editingSentence && (
                    <form onSubmit={saveEditedSentence} className="word-edit-form">
                        <HanziText as="p" className="hanzi-font edit-sentence-hanzi" text={editingSentence.chineseText} />

                        <div className="word-edit-group">
                            <label className="login-label" htmlFor="edit-pinyin">Pinyin</label>
                            <input
                                id="edit-pinyin"
                                type="text"
                                className="login-input"
                                value={editForm.pinyin}
                                onChange={e => setEditForm({ ...editForm, pinyin: e.target.value })}
                                autoFocus
                            />
                        </div>

                        <div className="word-edit-group">
                            <label className="login-label" htmlFor="edit-english">English Translation</label>
                            <input
                                id="edit-english"
                                type="text"
                                className="login-input"
                                value={editForm.englishTranslation}
                                onChange={e => setEditForm({ ...editForm, englishTranslation: e.target.value })}
                            />
                        </div>

                        {editError && <p className="modal-error">{editError}</p>}

                        <div className="word-edit-actions">
                            <button type="button" className="btn-outline" onClick={() => setEditingSentence(null)}>Cancel</button>
                            <button type="submit" className="btn-primary">Save Changes</button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Grid */}
            {isLoading && page === 1 ? (
                 <div className="loading-message">Loading...</div>
            ) : (
                <SentenceList 
                    sentences={displaySentences}
                    onDeleteSentence={deleteSentence}
                    onToggleDifficult={toggleDifficult}
                    onEditSentence={openEditModal}
                    audioBaseUrl={AUDIO_BASE_URL}
                />
            )}

            {/* Load More */}
            {hasMore && (
                <div className="load-more-wrapper">
                    <button className="btn-load-more" onClick={() => setPage(p => p + 1)} disabled={isLoading}>
                        <span>{isLoading ? 'Loading...' : 'Load More Sentences'}</span>
                        <span className="material-symbols-outlined">expand_more</span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default SentencePage;