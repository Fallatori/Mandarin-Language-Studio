import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function DeckPage() {
    const [decks, setDecks] = useState([]);
    const [allSentences, setAllSentences] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchDecks();
        fetchSentences();
    }, []);

    const fetchDecks = async () => {
        setIsLoading(true);
        try {
            const res = await axios.get('http://localhost:5001/api/decks', { withCredentials: true });
            setDecks(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSentences = async () => {
        try {
            const res = await axios.get('http://localhost:5001/api/sentences', { withCredentials: true });
            setAllSentences(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreate = async () => {
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
            console.error(err);
        }
    };

    const handleCancel = useCallback(() => {
        setIsCreating(false);
        setNewName("");
        setSelectedIds(new Set());
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
            console.error(err);
        }
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
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
                                            <label key={s.id} className="deck-selection-item">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedIds.has(s.id)} 
                                                    onChange={() => toggleSelection(s.id)}
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
                                <>
                                    <input 
                                        className="sentence-input" 
                                        placeholder="Deck Name" 
                                        value={newName} 
                                        onChange={e => setNewName(e.target.value)}
                                        autoFocus
                                    />
                                    <div className="preview-actions">
                                        <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                                        <button className="btn-success" onClick={handleCreate}>Save Deck</button>
                                    </div>
                                </>
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