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
    const [sortOrder] = useState('desc');
    const [filter, setFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('single'); // 'single' or 'bulk'

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

            setSentences(prev => {
                const updatedList = pageNum === 1 ? newSentences : [...prev, ...newSentences];
                return sortSentences(updatedList, sortOrder);
            });
            setHasMore(moreAvailable);
        } catch (err) {
            console.error("Failed to fetch sentences:", err);
            if (err.response && err.response.status === 401) {
                navigate('/login');
            }
            setError("Failed to load sentences. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    }, [sortOrder, filter, navigate]);

    useEffect(() => {
        fetchSentences(page);
    }, [fetchSentences, page]);

    const sortSentences = (sentencesToSort, order) => {
        return [...sentencesToSort].sort((a, b) => {
            const dateA = a.lastPracticedAt ? new Date(a.lastPracticedAt) : null;
            const dateB = b.lastPracticedAt ? new Date(b.lastPracticedAt) : null;
            if (dateA === null && dateB === null) return 0;
            if (dateA === null) return order === 'desc' ? 1 : -1;
            if (dateB === null) return order === 'desc' ? -1 : 1;
            if (order === 'desc') return dateB - dateA;
            else return dateA - dateB;
        });
    };

    const addSentence = async (formData) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.post(API_URL, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                withCredentials: true,
            });
            setSentences(prev => sortSentences([...prev, response.data], sortOrder));
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
            setSentences(prev => sortSentences([...prev, ...newSentences], sortOrder));
        }
        setIsModalOpen(false);
    };

    const handleOpenModal = (mode) => {
        setModalMode(mode);
        setIsModalOpen(true);
    };

    const handleLoadMore = () => {
        setPage(prev => prev + 1);
    };

    const markAsPracticed = async (id) => {
        try {
            const response = await axios.patch(`${API_URL}/${id}/practice`, {}, { withCredentials: true });
            const updatedSentence = response.data;
            setSentences(prev => {
                 const updatedList = prev.map(s => s.id === id ? updatedSentence : s);  
                return sortSentences(updatedList, sortOrder);
            });
        } catch (err) { 
            if (err.response && err.response.status === 401) {
                navigate('/login');
            }
            console.error(err); 
        }
    };

    const deleteSentence = async (id) => {
        if(!window.confirm("Are you sure?")) return;
        try {
             await axios.delete(`${API_URL}/${id}`, { withCredentials: true });
             setSentences(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            if (err.response && err.response.status === 401) {
                navigate('/login');
            }
             console.error(err);
        }
    }

    const deleteAllSentences = async () => {
        if(!window.confirm("Are you sure you want to delete ALL your sentences? This cannot be undone.")) return;
         try {
             await axios.delete(`${API_URL}/all`, { withCredentials: true });
             setSentences([]);
        } catch(err) { console.error(err); setError("Failed to delete all sentences"); }
    }

    return (
        <div className="main-content-column">
            <div className="page-header">
                <h2>My Sentences</h2>
                <div className="header-actions">
                    <button className="add-btn" onClick={() => handleOpenModal('single')}>+ New Sentence</button>
                    <button className="add-btn btn-bulk" onClick={() => handleOpenModal('bulk')}>Bulk Upload</button>
                    <button className="add-btn btn-delete" onClick={deleteAllSentences}>Delete All</button>
                </div>
            </div>

            <div className="filter-controls">
                <button 
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All Sentences
                </button>
                <button 
                    className={`filter-btn ${filter === 'due' ? 'active' : ''}`}
                    onClick={() => setFilter('due')}
                >
                    Due for Review
                </button>
                <button 
                    className={`filter-btn ${filter === 'difficult' ? 'active' : ''}`}
                    onClick={() => setFilter('difficult')}
                >
                    Difficult
                </button>
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
                        
                        {modalMode === 'single' ? (
                            <SentenceForm onAddSentence={addSentence} isLoading={isLoading} />
                        ) : (
                            <BulkUploadForm onUploadComplete={handleBulkComplete} onCancel={() => setIsModalOpen(false)} />
                        )}

                        {error && modalMode === 'single' && <p className="error-message">{error}</p>}
                    </div>
                </div>
            )}
            
            <div className="sentence-list-container full-width">
                {sentences.length === 0 && !isLoading && (
                    <p className="no-sentences-message">
                        {filter === 'all' ? 'No sentences added yet.' : `No ${filter} sentences found.`}
                    </p>
                )}

                <SentenceList
                    sentences={sentences}
                    onMarkAsPracticed={markAsPracticed}
                    onDeleteSentence={deleteSentence}
                    audioBaseUrl={AUDIO_BASE_URL}
                />

                {hasMore && sentences.length > 0 && (
                    <div className="load-more-container">
                        <button 
                            onClick={handleLoadMore} 
                            disabled={isLoading}
                            className="btn-secondary load-more-btn"
                        >
                            {isLoading ? 'Loading...' : 'Load More'}
                        </button>
                    </div>
                )}
                
                {isLoading && page === 1 && <p>Loading sentences...</p>}
            </div>
        </div>
    );
}

export default SentencePage;