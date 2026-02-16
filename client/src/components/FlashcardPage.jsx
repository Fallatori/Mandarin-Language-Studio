import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function FlashcardPage() {
    const {user} = useAuth();
    const [sentences, setSentences] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [gameMode, setGameMode] = useState(null); // 'CN_FRONT' or 'EN_FRONT'
    const [isLoading, setIsLoading] = useState(false);
    const [decks, setDecks] = useState([]);
    const [selectedDeckId, setSelectedDeckId] = useState("all");

    useEffect(() => {
        if (user) {
            fetchDecks();
        }
    }, [user]);

    const fetchDecks = async () => {
        const res = await axios.get('http://localhost:5001/api/decks', { withCredentials: true });
        setDecks(res.data);
    };
    

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
            console.error("Failed to fetch sentences", error);
        } finally {
            setIsLoading(false);
        }
    }

   const handleNext = (e) => {
        e.stopPropagation();
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % sentences.length);
        }, 300);
    };

   const handlePrev = (e) => {
        e.stopPropagation();
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => (prev - 1 + sentences.length) % sentences.length);
        }, 300);
    };


    if (!gameMode) {
        return (
            <div className="main-content">
                <div className="game-setup">
                    <h2>Flashcard Practice</h2>
                    
                    <div style={{margin: '20px 0'}}>
                        <label style={{display:'block', marginBottom:'10px', color:'#ccc'}}>Select Deck:</label>
                        <select 
                            value={selectedDeckId} 
                            onChange={(e) => setSelectedDeckId(e.target.value)}
                            style={{padding:'10px', borderRadius:'4px', background:'#444', color:'white', border:'1px solid #555', width:'200px'}}
                        >
                            <option value="all">All Sentences</option>
                            {decks.map(d => (
                                <option key={d.id} value={d.id}>{d.name} ({d.sentences.length})</option>
                            ))}
                        </select>
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
        <div className="main-content">
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
