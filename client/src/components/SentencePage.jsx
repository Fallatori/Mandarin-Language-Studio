import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import SentenceForm from './SentenceForm';
import SentenceList from './SentenceList';
import BulkUploadForm from './BulkUploadForm';

const API_URL = 'http://localhost:5001/api/sentences';
const AUDIO_BASE_URL = 'http://localhost:5001/uploads/';

function SentencePage() {
    const [sentences, setSentences] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sortOrder, setSortOrder] = useState('desc');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('single'); // 'single' or 'bulk'

    const fetchSentences = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(API_URL, { withCredentials: true });
            const sorted = sortSentences(response.data, sortOrder);
            setSentences(sorted);
        } catch (err) {
            console.error("Failed to fetch sentences:", err);
            setError("Failed to load sentences. Please try again later.");
            setSentences([]); 
        } finally {
            setIsLoading(false);
        }
    }, [sortOrder]);

    useEffect(() => {
        fetchSentences();
    }, [fetchSentences]);

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

    const markAsPracticed = async (id) => {
        try {
            const response = await axios.patch(`${API_URL}/${id}/practice`, {}, { withCredentials: true });
            const updatedSentence = response.data;
            setSentences(prev => {
                 const updatedList = prev.map(s => s.id === id ? updatedSentence : s);  
                return sortSentences(updatedList, sortOrder);
            });
        } catch (err) { console.error(err); }
    };

    const deleteSentence = async (id) => {
        if(!window.confirm("Are you sure?")) return;
        try {
             await axios.delete(`${API_URL}/${id}`, { withCredentials: true });
             setSentences(prev => prev.filter(s => s.id !== id));
        } catch(err) { console.error(err); }
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
                {isLoading && sentences.length === 0 && <p>Loading sentences...</p>}
                <SentenceList
                    sentences={sentences}
                    onMarkAsPracticed={markAsPracticed}
                    onDeleteSentence={deleteSentence}
                    audioBaseUrl={AUDIO_BASE_URL}
                />
            </div>
        </div>
    );
}

export default SentencePage;