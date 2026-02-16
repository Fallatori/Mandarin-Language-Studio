import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function FlashcardPage() {
    const navigate = useNavigate();
    const {user} = useAuth();
    const [sentences, setSentences] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [gameMode, setGameMode] = useState(null); // 'CN_FRONT' or 'EN_FRONT'
    const [isLoading, setIsLoading] = useState(false);
    const [decks, setDecks] = useState([]);
    const [selectedDeckId, setSelectedDeckId] = useState("all");

    const fetchDecks = useCallback(async () => {
        try {
            const res = await axios.get('http://localhost:5001/api/decks', { withCredentials: true });
            setDecks(res.data);
        } catch (err) {
            console.error(err);
            if (err.response && err.response.status === 401) {
                navigate('/login');
            }
        }
    }, [navigate]);

    useEffect(() => {
        if (user) {
            fetchDecks();
        }
    }, [user, fetchDecks]);
    

    const startGame = async (mode) => {
        setIsLoading(true);
        try {
            let url = 'http://localhost:5001/api/sentences';
            
            if (selectedDeckId !== "all") {
                url = `http://localhost:5001/api/decks/${selectedDeckId}/sentences`;
            }

            const res = await axios.get(url, { withCredentials: true });
            
            if (res.data.length === 0) {
                alert("No sentences in this deck!");
                setIsLoading(false);
                return;
            }

            const shuffled = res.data.sort(() => 0.5 - Math.random());
            setSentences(shuffled);
            setGameMode(mode); 
            setCurrentIndex(0);
        } catch (error) {
            console.error("Failed to fetch sentences", error);            if (error.response && error.response.status === 401) {
                navigate('/login');
            }        } finally {
            setIsLoading(false);
        }
    }

   const handleNext = (e) => {
        e.stopPropagation();
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % sentences.length);
        }, 100);
    };

   const handlePrev = (e) => {
        e.stopPropagation();
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => (prev - 1 + sentences.length) % sentences.length);
        }, 100);
    };


    if (!gameMode) {
        return (
            <div className="main-content">
                <div className="game-setup">
                    <h2>Flashcard Practice</h2>
                    
                    <div className="deck-selector-container">
                        <label className="deck-selector-label">Select Deck:</label>
                        <div className="deck-selector-controls">
                            <select 
                                value={selectedDeckId} 
                                onChange={(e) => setSelectedDeckId(e.target.value)}
                                className="deck-dropdown"
                            >
                                <option value="all">All Sentences</option>
                                {decks.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.sentences.length})</option>
                                ))}
                            </select>
                            <button 
                                onClick={() => navigate('/decks')}
                                className="btn-secondary manage-decks-btn"
                            >
                                Manage Decks
                            </button>
                        </div>
                    </div>

                    <p>Choose your mode:</p>
                    <div className="mode-buttons">
                        <button className="btn-mode" onClick={() => startGame('CN_FRONT')}>
                            <h3>Chinese Front</h3>
                            <small>English on back</small>
                        </button>
                        <button className="btn-mode" onClick={() => startGame('EN_FRONT')}>
                            <h3>English Front</h3>
                            <small>Chinese on back</small>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading) return <div className="main-content"><p>Loading cards...</p></div>;
    if (sentences.length === 0) return <div className="main-content"><p>No sentences found to practice</p></div>;

    const currentCard = sentences[currentIndex];

    const frontContent = gameMode === 'CN_FRONT' 
        ? <div className="card-content-large">{currentCard.chineseText}</div>
        : <div className="card-content-large">{currentCard.englishTranslation}</div>;

    const backContent = gameMode === 'CN_FRONT'
        ? (
            <>
                <div className="card-content-medium">{currentCard.pinyin}</div>
                <div className="card-content-small">{currentCard.englishTranslation}</div>
            </>
          )
        : (
            <>
                <div className="card-content-large">{currentCard.chineseText}</div>
                <div className="card-content-medium">{currentCard.pinyin}</div>
            </>
          );

    return (
        <div className="main-content-column">
            <div className="game-header">
                <h3>Card {currentIndex + 1} / {sentences.length}</h3>
                <button className="btn-secondary" onClick={() => setGameMode(null)}>End Game</button>
            </div>

            <div 
                className={`flashcard-container ${isFlipped ? 'flipped' : ''}`} 
                onClick={() => setIsFlipped(!isFlipped)}
            >
                <div className="flashcard-inner">
                    <div className="flashcard-front">
                        {frontContent}
                        <span className="card-hint">Click to flip</span>
                    </div>
                    <div className="flashcard-back">
                        {backContent}
                        <span className="card-hint">Click to flip back</span>
                    </div>
                </div>
            </div>

            <div className="game-controls">
                <button className="add-btn btn-secondary" onClick={handlePrev}>← Previous</button>
                <button className="add-btn" onClick={handleNext}>Next →</button>
            </div>
        </div>
    );
}

export default FlashcardPage;
