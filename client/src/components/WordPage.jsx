import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api/words';

function WordPage() {
    const [words, setWords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedWord, setSelectedWord] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ chineseWord: '', pinyin: '', englishTranslation: '' });

    useEffect(() => {
        const fetchWords = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await axios.get(API_URL, { withCredentials: true });
                setWords(response.data);
            } catch (err) {
                console.error("Failed to fetch words:", err);
                setError("Failed to load words. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchWords();
    }, []);

     const handleWordClick = (word) => {
        setSelectedWord(word);
        setIsEditing(false);
        setEditForm({
            chineseWord: word.chineseWord,
            pinyin: word.pinyin,
            englishTranslation: word.englishTranslation
        });
    };

     const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.put(`${API_URL}/${selectedWord.id}`, editForm, { withCredentials: true });
            const updatedWord = response.data;
            
            setWords(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w));
            setSelectedWord(updatedWord);
            setIsEditing(false);
        } catch (err) {
            console.error("Failed to update word", err);
            alert("Failed to update word");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this word?")) return;
        try {
            await axios.delete(`${API_URL}/${selectedWord.id}`, { withCredentials: true });
            setWords(prev => prev.filter(w => w.id !== selectedWord.id));
            setSelectedWord(null);
        } catch (err) {
            console.error("Failed to delete word", err);
            alert("Failed to delete word");
        }
    };

    return (
        <div className="main-content">
            <div className="word-page-container">
                <h2>My Word List</h2>
                {isLoading && <p>Loading words...</p>}
                {error && <p className="error-message">{error}</p>}
                
                <div className="word-grid">
                    {words.map((word) => (
                        <div 
                            key={word.id} 
                            onClick={() => handleWordClick(word)}
                            className="word-card"
                        >
                            <div className="word-card-chinese">{word.chineseWord}</div>
                            <div className="word-card-pinyin">{word.pinyin}</div>
                            <div className="word-card-english">{word.englishTranslation}</div>
                        </div>
                    ))}
                </div>

                {selectedWord && (
                    <div className="modal-overlay" onClick={() => setSelectedWord(null)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()}>
                            <button className="modal-close-btn" onClick={() => setSelectedWord(null)}>×</button>
                            
                            {!isEditing ? (
                                <div className="word-detail-view">
                                    <h2 className="word-detail-chinese">{selectedWord.chineseWord}</h2>
                                    <h3 className="word-detail-pinyin">{selectedWord.pinyin}</h3>
                                    <p className="word-detail-english">{selectedWord.englishTranslation}</p>
                                    
                                    <div className="word-detail-actions">
                                        <button onClick={() => setIsEditing(true)}>Edit</button>
                                        <button onClick={handleDelete} className="btn-delete">Delete</button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleUpdate} className="word-edit-form">
                                    <h3>Edit Word</h3>
                                    <div>
                                        <label>Chinese Word</label>
                                        <input 
                                            value={editForm.chineseWord}
                                            onChange={e => setEditForm({...editForm, chineseWord: e.target.value})}
                                            className="word-edit-input"
                                        />
                                    </div>
                                    <div>
                                        <label>Pinyin</label>
                                        <input 
                                            value={editForm.pinyin}
                                            onChange={e => setEditForm({...editForm, pinyin: e.target.value})}
                                            className="word-edit-input"
                                        />
                                    </div>
                                    <div>
                                        <label>English Translation</label>
                                        <input 
                                            value={editForm.englishTranslation}
                                            onChange={e => setEditForm({...editForm, englishTranslation: e.target.value})}
                                            className="word-edit-input"
                                        />
                                    </div>
                                    <div className="word-edit-actions">
                                        <button type="submit" className="btn-save">Save</button>
                                        <button type="button" onClick={() => setIsEditing(false)} className="btn-cancel">Cancel</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export default WordPage;