import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';

const API_URL = 'http://localhost:5001/api/words';

function WordPage() {
    const navigate = useNavigate();
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
                const sortedWords = response.data.sort((a, b) => 
                    new Date(b.createdAt) - new Date(a.createdAt)
                );
                setWords(sortedWords);
            } catch (err) {
                console.error("Failed to fetch words:", err);
                if (err.response && err.response.status === 401) {
                    navigate('/login');
                }
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
            if (err.response && err.response.status === 401) {
                navigate('/login');
                return;
            }
            alert(err.response?.data?.error || "Failed to update word");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Remove this word from your list?")) return;
        try {
            await axios.delete(`${API_URL}/${selectedWord.id}`, { withCredentials: true });
            setWords(prev => prev.filter(w => w.id !== selectedWord.id));
            setSelectedWord(null);
        } catch (err) {
            console.error("Failed to delete word", err);
            if (err.response && err.response.status === 401) {
                navigate('/login');
                return;
            }
            alert(err.response?.data?.error || "Failed to delete word");
        }
    };

    const deleteAllWords = async () => {
        if (!window.confirm("Are you sure you want to delete ALL your words? This cannot be undone.")) return;
         try {
             await axios.delete(`${API_URL}/all`, { withCredentials: true });
             setWords([]);
             setSelectedWord(null);
        } catch(err) { 
             console.error(err); 
             if (err.response && err.response.status === 401) {
                navigate('/login');
                return;
            }
             setError("Failed to delete all words"); 
        }
    }

    return (
        <div className="main-content">
            <div className="content-header">
                <div className="header-top">
                    <div className="header-title">
                    <h2>My Word List</h2>
                    <p>Review and manage your saved Mandarin vocabulary</p>
                    </div>
                    <button className="btn-outline btn-delete" onClick={deleteAllWords}>
                        <span className="material-symbols-outlined">delete</span>
                        <span>Delete All</span>
                    </button>
                </div>
                {isLoading && <p>Loading words...</p>}
                {error && <p className="error-message">{error}</p>}
                
                <div className="word-grid">
                    {words.map((word) => (
                        <div 
                            key={word.id} 
                            onClick={() => handleWordClick(word)}
                            className="card"
                        >
                            <div className="card-content">
                            <h3 className="card-hanzi hanzi-font">{word.chineseWord}</h3>
                            <p className="card-pinyin">{word.pinyin}</p>
                            <p className="card-english">{word.englishTranslation}</p>

                            </div>
                        </div>
                    ))}
                </div>

                <Modal isOpen={!!selectedWord} onClose={() => setSelectedWord(null)}>
                    {selectedWord && (
                        <>
                            {!isEditing ? (
                                <div className="word-detail-container">
                                    <h2 className="hanzi-font word-detail-hanzi">{selectedWord.chineseWord}</h2>
                                    <h3 className="word-detail-pinyin">{selectedWord.pinyin}</h3>
                                    <p className="word-detail-english">{selectedWord.englishTranslation}</p>

                                    {selectedWord.isLocked && (
                                        <p className="word-detail-note">
                                            <span className="material-symbols-outlined">lock</span>
                                            Part of a lesson — this word can't be changed.
                                        </p>
                                    )}
                                    {selectedWord.isCustomised && !selectedWord.isLocked && (
                                        <p className="word-detail-note">
                                            <span className="material-symbols-outlined">person_edit</span>
                                            Your own version of this word.
                                        </p>
                                    )}

                                    <div className="word-detail-actions">
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="btn-primary"
                                            disabled={selectedWord.isLocked}
                                            title={selectedWord.isLocked ? "Lesson words can't be edited" : "Edit Word"}
                                        >
                                            <span className="material-symbols-outlined">edit</span>
                                            <span>Edit Word</span>
                                        </button>
                                        <button onClick={handleDelete} className="btn-outline btn-delete">
                                            <span className="material-symbols-outlined">delete</span>
                                            <span>Remove</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleUpdate} className="word-edit-form">
                                    <h3>Edit Word</h3>
                                    <div className="word-edit-group">
                                        <label className="login-label">Chinese Word</label>
                                        <input
                                            type="text"
                                            value={editForm.chineseWord}
                                            onChange={e => setEditForm({...editForm, chineseWord: e.target.value})}
                                            className="login-input"
                                            disabled={!selectedWord.isOwner}
                                            title={selectedWord.isOwner ? "" : "The characters identify the shared word and can't be changed"}
                                        />
                                    </div>
                                    <div className="word-edit-group">
                                        <label className="login-label">Pinyin</label>
                                        <input 
                                            type="text"
                                            value={editForm.pinyin}
                                            onChange={e => setEditForm({...editForm, pinyin: e.target.value})}
                                            className="login-input"
                                        />
                                    </div>
                                    <div className="word-edit-group">
                                        <label className="login-label">English Translation</label>
                                        <input 
                                            type="text"
                                            value={editForm.englishTranslation}
                                            onChange={e => setEditForm({...editForm, englishTranslation: e.target.value})}
                                            className="login-input"
                                        />
                                    </div>
                                    <div className="word-edit-actions">
                                        <button type="button" onClick={() => setIsEditing(false)} className="btn-outline">Cancel</button>
                                        <button type="submit" className="btn-primary">Save Changes</button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </Modal>

            </div>
        </div>
    );
}

export default WordPage;