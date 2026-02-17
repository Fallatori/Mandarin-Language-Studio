import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function DeckPage() {
    const navigate = useNavigate();
    const [decks, setDecks] = useState([]);
    const [allSentences, setAllSentences] = useState([]);

    const [modalMode, setModalMode] = useState(null); // null | 'create' | 'edit' | 'view'
    const [selectedDeck, setSelectedDeck] = useState(null);
    
    const [newName, setNewName] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [step, setStep] = useState(1); 
    const [isLoading, setIsLoading] = useState(false);
    const [lastCheckedId, setLastCheckedId] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

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
            console.error(err);
        }
    }, []);

    useEffect(() => {
        fetchDecks();
        fetchSentences();
    }, [fetchDecks, fetchSentences]);

    const openCreateModal = () => {
        setModalMode('create');
        setSelectedDeck(null);
        setNewName("");
        setSelectedIds(new Set());
        setStep(1);
        setSearchTerm("");
        setCurrentPage(1);
    };

    const openViewModal = async (deck) => {
        setModalMode('view');
        setSelectedDeck({ ...deck, sentences: deck.sentences || [] });
        try {
            const res = await axios.get(
                `http://localhost:5001/api/decks/${deck.id}/sentences`,
                { withCredentials: true },
            );
            setSelectedDeck((prev) => ({ ...prev, sentences: res.data }));
        } catch (err) {
            console.error('Failed to load deck sentences:', err);
        }
    };

    const openEditModal = () => {
        if (!selectedDeck) return;
        setModalMode('edit');
        setNewName(selectedDeck.name);
        const existingIds = new Set(selectedDeck.sentences.map(s => s.id));
        setSelectedIds(existingIds);
        setStep(1);
        setSearchTerm("");
        setCurrentPage(1);
    };

    const handleClose = useCallback(() => {
        if ((modalMode === 'create' || modalMode === 'edit') && step === 1 && selectedIds.size > 0) {
            if (!window.confirm("Discard changes?")) return;
        }
        
        setModalMode(null);
        setSelectedDeck(null);
        setNewName("");
        setSelectedIds(new Set());
        setStep(1);
        setSearchTerm("");
        setCurrentPage(1);
    }, [modalMode, step, selectedIds]);

    const handleSave = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newName) return;

        try {
            const payload = {
                name: newName,
                sentenceIds: Array.from(selectedIds)
            };

            if (modalMode === 'create') {
                await axios.post('http://localhost:5001/api/decks', payload, { withCredentials: true });
            } else if (modalMode === 'edit' && selectedDeck) {
                await axios.put(`http://localhost:5001/api/decks/${selectedDeck.id}`, payload, { withCredentials: true });
            }
            
            handleClose();
            fetchDecks();
        } catch (err) {
            console.error("Failed to save deck", err);
            if (err.response && err.response.status === 401) navigate('/login');
        }
    };

    const handleDelete = async (id) => {
        if(!window.confirm("Delete this deck?")) return;
        try {
            await axios.delete(`http://localhost:5001/api/decks/${id}`, { withCredentials: true });
            if (selectedDeck?.id === id) handleClose();
            fetchDecks();
        } catch (err) {
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
                    if (willCheck) newSet.add(itemId);
                    else newSet.delete(itemId);
                }
            }
        } else {
            if (willCheck) newSet.add(id);
            else newSet.delete(id);
            setLastCheckedId(id);
        }
        setSelectedIds(newSet);
    };

    const filteredSentences = allSentences.filter(s => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            s.chineseText.includes(searchTerm) || 
            s.englishTranslation.toLowerCase().includes(searchLower) ||
            s.pinyin.toLowerCase().includes(searchLower)
        );
    });

    const totalPages = Math.ceil(filteredSentences.length / ITEMS_PER_PAGE);
    const paginatedSentences = filteredSentences.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleSelectAllFiltered = () => {
        const newSet = new Set(selectedIds);
        filteredSentences.forEach(s => newSet.add(s.id));
        setSelectedIds(newSet);
    };

    const handleDeselectAllFiltered = () => {
        const newSet = new Set(selectedIds);
        filteredSentences.forEach(s => newSet.delete(s.id));
        setSelectedIds(newSet);
    };

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && modalMode) handleClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [modalMode, handleClose]);

    const renderSelectionList = () => (
        <>
            <div className="deck-toolbar">
                <input 
                    type="text" 
                    placeholder="Search sentences..." 
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1); 
                    }}
                    className="deck-search-input"
                />
                <div className="deck-selection-actions">
                    <button 
                        className="btn-secondary btn-small" 
                        onClick={handleSelectAllFiltered}
                        title="Select all matched by search"
                    >
                        Select All
                    </button>
                    <button 
                        className="btn-secondary btn-small" 
                        onClick={handleDeselectAllFiltered}
                        title="Deselect all matched by search"
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div className="deck-selection-list">
                {paginatedSentences.map(s => (
                    <label 
                        key={s.id} 
                        className="deck-selection-item"
                        onClick={(e) => { e.preventDefault(); toggleSelection(s.id, e); }}
                    >
                        <input 
                            type="checkbox" 
                            checked={selectedIds.has(s.id)} 
                            readOnly
                            className="checkbox-readonly"
                        />
                        <span className="deck-item-text">
                            {s.chineseText} <span className="deck-item-translation">({s.englishTranslation})</span>
                        </span>
                    </label>
                ))}
                {paginatedSentences.length === 0 && (
                    <p className="no-deck-sentences">No sentences found.</p>
                )}
            </div>

            {totalPages > 1 && (
                <div className="pagination-controls">
                    <button 
                        className="btn-secondary btn-small" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                        Previous
                    </button>
                    <span className="pagination-info">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button 
                        className="btn-secondary btn-small" 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    >
                        Next
                    </button>
                </div>
            )}

            <div className="preview-actions preview-actions--spaced">
                <button className="btn-secondary" onClick={handleClose}>Cancel</button>
                <button className="btn-success" onClick={() => setStep(2)}>
                    Next ({selectedIds.size} selected)
                </button>
            </div>
        </>
    );

    const renderNameInput = () => (
        <div className="deck-step-container">
            <div className="deck-input-group">
                <label>Deck Name</label>
                <input
                    className="sentence-input deck-name-input"
                    placeholder="e.g., HSK 1 Vocabulary"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    autoFocus
                />
            </div>
            <div className="preview-actions">
                <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                <button className="btn-success" onClick={handleSave}>
                    {modalMode === 'create' ? 'Create Deck' : 'Save Changes'}
                </button>
            </div>
        </div>
    );

    const renderViewModal = () => {
        if (!selectedDeck) return null;
        return (
            <div className="deck-view-container">
                <h2 className="deck-view-title">{selectedDeck.name}</h2>
                <p className="deck-view-sub">
                    {selectedDeck.sentences ? selectedDeck.sentences.length : 0} sentences
                </p>

                <div className="deck-selection-list deck-selection-list--modal">
                    {selectedDeck.sentences && selectedDeck.sentences.map(s => (
                        <div key={s.id} className="deck-selection-item deck-selection-readonly">
                            <span className="deck-item-text">
                                {s.chineseText} <span className="deck-item-translation">({s.englishTranslation})</span>
                            </span>
                        </div>
                    ))}
                    {(!selectedDeck.sentences || selectedDeck.sentences.length === 0) && (
                        <p className="no-deck-sentences">No sentences in this deck.</p>
                    )}
                </div>

                <div className="word-detail-actions">
                    <button onClick={openEditModal} className="add-btn">Edit Deck</button>
                    <button onClick={() => handleDelete(selectedDeck.id)} className="btn-delete">Delete</button>
                    <button onClick={handleClose} className="btn-secondary">Close</button>
                </div>
            </div>
        );
    };

    return (
        <div className="main-content">
            <div className="word-page-container">
                <div className="word-page-header">
                    <h2>My Decks</h2>
                    <button className="add-btn" onClick={openCreateModal}>+ New Deck</button>
                </div>

                {/* MODAL OVERLAY */}
                {modalMode && (
                    <div className="modal-overlay" onClick={handleClose}>
                        <div className="sentence-form modal-content" onClick={(e) => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={handleClose}>×</button>
                            
                            {modalMode === 'view' ? renderViewModal() : (
                                <>
                                    <h3>{modalMode === 'create' ? 'Create New Deck' : 'Edit Deck'}</h3>
                                    {step === 1 ? renderSelectionList() : renderNameInput()}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <p>Loading decks...</p>
                ) : (
                    <div className="word-grid">
                        {decks.map(d => (
                            <div 
                                key={d.id} 
                                className="word-card" 
                                onClick={() => openViewModal(d)}
                            >
                                <div className="word-card-header">
                                    <h3 className="word-hanzi">{d.name}</h3>
                                </div>
                                <div className="word-card-body">
                                    <p className="word-pinyin" style={{marginBottom: '10px'}}>
                                        {d.sentences ? d.sentences.length : 0} sentences
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {!isLoading && decks.length === 0 && (
                     <div className="no-sentences"><p>No decks created yet.</p></div>
                )}
            </div>
        </div>
    );
}

export default DeckPage;