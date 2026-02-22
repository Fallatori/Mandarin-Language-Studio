import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import SentenceForm from './SentenceForm';
import SentenceList from './SentenceList';
import BulkUploadForm from './BulkUploadForm';

const API_URL = 'http://localhost:5001/api/sentences';
const AUDIO_BASE_URL = 'http://localhost:5001/uploads/';

function SentencePage() {
    const navigate = useNavigate();
    const [sentences, setSentences] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('single');
    const [searchTerm, setSearchTerm] = useState("");

    // Reset pagination when filter changes
    useEffect(() => {
        setSentences([]);
        setPage(1);
        setHasMore(true);
    }, [filter]);

    const fetchSentences = useCallback(async (pageNum) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_URL}?filter=${filter}&page=${pageNum}&limit=20`, { withCredentials: true });
            const { sentences: newSentences, hasMore: moreAvailable } = response.data;

            setSentences(prev => pageNum === 1 ? newSentences : [...prev, ...newSentences]);
            setHasMore(moreAvailable);
        } catch (err) {
            console.error(err);
             if (err.response && err.response.status === 401) navigate('/login');
        } finally {
            setIsLoading(false);
        }
    }, [filter, navigate]);

    useEffect(() => {
        fetchSentences(page);
    }, [fetchSentences, page]);

    // Simple client-side search filtering
    const displaySentences = sentences.filter(s => {
        if (!searchTerm) return true;
        const low = searchTerm.toLowerCase();
        return (
            (s.chineseText && s.chineseText.includes(searchTerm)) ||
            (s.englishTranslation && s.englishTranslation.toLowerCase().includes(low)) ||
            (s.pinyin && s.pinyin.toLowerCase().includes(low))
        );
    });

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

            {/* Modal Logic */}
             {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
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
                        {error && modalMode === 'single' && <p style={{color:'red', marginTop: '10px'}}>{error}</p>}
                    </div>
                </div>
            )}

            {/* Grid */}
            <SentenceList 
                sentences={displaySentences}
                onDeleteSentence={deleteSentence}
                onToggleDifficult={toggleDifficult}
                audioBaseUrl={AUDIO_BASE_URL}
            />

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