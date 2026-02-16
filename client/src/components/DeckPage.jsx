import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function DeckPage() {
    const navigate = useNavigate();
    const [decks, setDecks] = useState([]);
    const [allSentences, setAllSentences] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [lastCheckedId, setLastCheckedId] = useState(null);

    const fetchDecks = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await axios.get('http://localhost:5001/api/decks', { withCredentials: true });
            setDecks(res.data);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                navigate('/login');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    const fetchSentences = useCallback(async () => {
        try {
            const res = await axios.get('http://localhost:5001/api/sentences', { withCredentials: true });
            setAllSentences(res.data);
        } catch (err) {
            if (err.response && err.response.status === 401) {
                navigate('/login');
            }
            console.error(err);
        }
    }, [navigate]);

    useEffect(() => {
        fetchDecks();
        fetchSentences();
    }, [fetchDecks, fetchSentences]);



    const handleCreate = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newName) return;
        try {
            await axios.post('http://localhost:5001/api/decks', {
                name: newName,
                sentenceIds: Array.from(selectedIds)
            }, { withCredentials: true });
            
            setIsCreating(false);
            setNewName("");
            setSelectedIds(new Set());
            setStep(1);
            fetchDecks();
        } catch(err) {
            if (err.response && err.response.status === 401) {
                navigate('/login');
            }
            console.error(err);
        }
    };

    const handleCancel = useCallback(() => {
        setIsCreating(false);
        setNewName("");
        setSelectedIds(new Set());
        setLastCheckedId(null);
        setStep(1);
    }, []);

    const attemptClose = useCallback(() => {
        if (selectedIds.size > 0 && isCreating) {
            if (window.confirm("You have selected items. Are you sure you want to discard your changes?")) {
                handleCancel();
            }
        } else {
            handleCancel();
        }
    }, [isCreating, selectedIds, handleCancel]);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isCreating) {
                attemptClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isCreating, attemptClose]); 

    const handleDelete = async (id) => {
        if(!window.confirm("Delete this deck?")) return;
        try {
            await axios.delete(`http://localhost:5001/api/decks/${id}`, { withCredentials: true });
            fetchDecks();
        } catch (err) {
            if (err.response && err.response.status === 401) {
                navigate('/login');
            }
            console.error(err);
        }
    };

    const toggleSelection = (id, event) => {
        const newSet = new Set(selectedIds);
        const willCheck = !selectedIds.has(id);
        
        if (event && event.shiftKey && lastCheckedId) {
            const start = allSentences.findIndex(s => s.id === lastCheckedId);
            const end = allSentences.findIndex(s => s.id === id);
            
            if (start !== -1 && end !== -1) {
                const low = Math.min(start, end);
                const high = Math.max(start, end);
                
                for (let i = low; i <= high; i++) {
                    const itemId = allSentences[i].id;
                    if (willCheck) {
                        newSet.add(itemId);
                    } else {
                        newSet.delete(itemId);
                    }
                }
            }
        } else {
            if (willCheck) newSet.add(id);
            else newSet.delete(id);
            
            setLastCheckedId(id);
        }
        
        setSelectedIds(newSet);
    };

    return (
        <div className="main-content">
            <div className="word-page-container">
                <div className="word-page-header">
                    <h2>My Decks</h2>
                    <button className="add-btn" onClick={() => setIsCreating(true)}>+ New Deck</button>
                </div>

                {/* MODAL OVERLAY */}
                {isCreating && (
                    <div className="modal-overlay" onClick={attemptClose}>
                        <div className="sentence-form modal-content" onClick={(e) => e.stopPropagation()}>
                            <h3>Create New Deck {step === 1 ? "- Select Sentences" : "- Name Deck"}</h3>
                            
                            {step === 1 && (
                                <>
                                    <div className="deck-selection-controls">
                                        <button 
                                            className="btn-secondary deck-control-btn" 
                                            onClick={() => setSelectedIds(new Set(allSentences.map(s => s.id)))}
                                        >
                                            Select All
                                        </button>
                                        <button 
                                            className="btn-secondary deck-control-btn" 
                                            onClick={() => setSelectedIds(new Set())}
                                        >
                                            Deselect All
                                        </button>
                                    </div>

                                    <div className="deck-selection-list">
                                        {allSentences.map(s => (
                                            <label 
                                                key={s.id} 
                                                className="deck-selection-item"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    toggleSelection(s.id, e);
                                                }}
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.has(s.id)} 
                                                    readOnly
                                                    style={{pointerEvents: 'none'}}
                                                />
                                                <span style={{color: '#ddd'}}>{s.chineseText} <span style={{color: '#888', fontSize: '0.9em'}}>({s.englishTranslation})</span></span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="preview-actions">
                                        <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
                                        <button className="btn-success" onClick={() => setStep(2)}>Next</button>
                                    </div>
                                </>
                            )}

                            {step === 2 && (
                                <div className="deck-step-container">
                                    <div className="deck-input-group">
                                        <label>Deck Name</label>
                                        <input 
                                            className="sentence-input deck-name-input" 
                                            placeholder="e.g., HSK 1 Vocabulary" 
                                            value={newName} 
                                            onChange={e => setNewName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                            autoFocus
                                        />
                                    </div>
                                    
                                    <div className="preview-actions">
                                        <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                                        <button className="btn-success" onClick={handleCreate}>Create Deck</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <p>Loading decks...</p>
                ) : (
                    <div className="word-grid">
                        {decks.map(g => (
                            <div key={g.id} className="word-card">
                                <div className="word-card-header">
                                    <h3 className="word-hanzi">{g.name}</h3>
                                </div>
                                <div className="word-card-body">
                                    <p className="word-pinyin" style={{marginBottom: '10px'}}>{g.sentences.length} sentences</p>
                                    <button 
                                        className="btn-delete-all" 
                                        style={{width: '100%', marginTop: '10px', padding: '8px'}} 
                                        onClick={() => handleDelete(g.id)}
                                    >
                                        Delete Deck
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {!isLoading && decks.length === 0 && (
                     <div className="no-sentences">
                        <p>No decks created yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DeckPage;