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
    const [selectedDeckId, setSelectedDeckId] = useState("");
    const [filter, setFilter] = useState("all"); // all | due | difficult
    const [sessionFilter, setSessionFilter] = useState("all");
    const [hasChosenScope, setHasChosenScope] = useState(false);

    const [filterCounts, setFilterCounts] = useState({ all: 0, due: 0, difficult: 0 });
    const [isCountsLoading, setIsCountsLoading] = useState(false);

    const effectiveCount = filterCounts[filter] ?? 0;
    const modeDisabled = !hasChosenScope || isCountsLoading || effectiveCount === 0;

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

    const fetchFlashcardCounts = useCallback(async (nextDeckId) => {
        const params = new URLSearchParams();
        if (nextDeckId && nextDeckId !== 'all') {
            params.set('deckId', nextDeckId);
        }

        const url = `http://localhost:5001/api/sentences/flashcards/counts?${params.toString()}`;
        const res = await axios.get(url, { withCredentials: true });
        return res.data;
    }, []);

    const refreshCounts = useCallback(async () => {
        if (!user) return;

        setIsCountsLoading(true);
        try {
            const effectiveDeckId = selectedDeckId || 'all';
            const counts = await fetchFlashcardCounts(effectiveDeckId);
            if (counts) {
                setFilterCounts({
                    all: counts.all || 0,
                    due: counts.due || 0,
                    difficult: counts.difficult || 0,
                });
            }
        } catch (error) {
            console.error('Failed to fetch flashcard counts', error);
            if (error.response && error.response.status === 401) {
                navigate('/login');
            }
        } finally {
            setIsCountsLoading(false);
        }
    }, [fetchFlashcardCounts, navigate, selectedDeckId, user]);

    useEffect(() => {
        if (!user) return;

        refreshCounts();
    }, [user, selectedDeckId, refreshCounts]);

    const endGame = useCallback(() => {
        setGameMode(null);
        setSentences([]);
        setCurrentIndex(0);
        setIsFlipped(false);
        refreshCounts();
    }, [refreshCounts]);

    const fetchFlashcards = useCallback(async (nextFilter, nextDeckId) => {
        const params = new URLSearchParams();
        params.set('filter', nextFilter);
        if (nextDeckId && nextDeckId !== 'all') {
            params.set('deckId', nextDeckId);
        }

        const url = `http://localhost:5001/api/sentences/flashcards?${params.toString()}`;
        const res = await axios.get(url, { withCredentials: true });
        return res.data;
    }, []);

    const startGame = async (mode) => {
        setIsLoading(true);
        try {
            setSessionFilter(filter);
            const effectiveDeckId = selectedDeckId || 'all';
            const data = await fetchFlashcards(filter, effectiveDeckId);

            if (!data || data.length === 0) {
                alert("No sentences match this filter/deck.");
                return;
            }

            const shuffled = data.sort(() => 0.5 - Math.random());
            setSentences(shuffled);
            setGameMode(mode);
            setCurrentIndex(0);
            setIsFlipped(false);
        } catch (error) {
            console.error("Failed to fetch flashcards", error);
            if (error.response && error.response.status === 401) {
                navigate('/login');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const markPracticed = useCallback(async (sentenceId) => {
        try {
            await axios.patch(
                `http://localhost:5001/api/sentences/${sentenceId}/practice`,
                {},
                { withCredentials: true }
            );
        } catch (error) {
            console.error("Failed to mark practiced", error);
            if (error.response && error.response.status === 401) {
                navigate('/login');
            }
        }
    }, [navigate]);

    const toggleDifficult = useCallback(async () => {
        const current = sentences[currentIndex];
        if (!current) return;

        const nextValue = !(current.progress && current.progress.difficult);

        try {
            const res = await axios.patch(
                `http://localhost:5001/api/sentences/${current.id}/difficult`,
                { difficult: nextValue },
                { withCredentials: true }
            );

            setSentences((prev) => {
                const copy = [...prev];
                const existingProgress = copy[currentIndex]?.progress || {};
                copy[currentIndex] = {
                    ...copy[currentIndex],
                    progress: { ...existingProgress, ...res.data },
                };
                return copy;
            });
        } catch (error) {
            console.error("Failed to toggle difficult", error);
            if (error.response && error.response.status === 401) {
                navigate('/login');
            }
        }
    }, [currentIndex, navigate, sentences]);

    const handleNext = async (e) => {
        e.stopPropagation();
        const current = sentences[currentIndex];
        if (!current) return;

        await markPracticed(current.id);

        const shouldRemove = sessionFilter === 'due' && !(current.progress && current.progress.difficult);

        setIsFlipped(false);

        if (shouldRemove) {
            const nextSentences = sentences.filter((_, idx) => idx !== currentIndex);
            setSentences(nextSentences);

            if (nextSentences.length === 0) {
                setGameMode(null);
                setSentences([]);
                setCurrentIndex(0);
                refreshCounts();
                return;
            }

            if (currentIndex >= nextSentences.length) {
                setCurrentIndex(0);
            }

            return;
        }

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
        const countsLabel = (key) => {
            if (isCountsLoading) return '…';
            return filterCounts[key] ?? 0;
        };

        const isFilterEmpty = (key) => {
            if (isCountsLoading) return false;
            return (filterCounts[key] ?? 0) === 0;
        };

        return (
            <div className="main-content">
                <div className="game-setup">
                    <h2>Flashcard Practice</h2>

                    <div className="flashcard-filters">
                        <button
                            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => {
                                setHasChosenScope(true);
                                setFilter('all');
                            }}
                            disabled={isFilterEmpty('all')}
                        >
                            All ({countsLabel('all')})
                        </button>
                        <button
                            className={`filter-tab ${filter === 'due' ? 'active' : ''}`}
                            onClick={() => {
                                setHasChosenScope(true);
                                setFilter('due');
                            }}
                            disabled={isFilterEmpty('due')}
                        >
                            Due ({countsLabel('due')})
                        </button>
                        <button
                            className={`filter-tab ${filter === 'difficult' ? 'active' : ''}`}
                            onClick={() => {
                                setHasChosenScope(true);
                                setFilter('difficult');
                            }}
                            disabled={isFilterEmpty('difficult')}
                        >
                            Difficult ({countsLabel('difficult')})
                        </button>
                    </div>
                    
                    <div className="deck-selector-container">
                        <label className="deck-selector-label">Select Deck:</label>
                        <div className="deck-selector-controls">
                            <select 
                                value={selectedDeckId} 
                                onChange={(e) => {
                                    const next = e.target.value;
                                    setSelectedDeckId(next);

                                    setHasChosenScope(true);
                                }}
                                className="deck-dropdown"
                            >
                                <option value="">No deck</option>
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
                        <button className="btn-mode" onClick={() => startGame('CN_FRONT')} disabled={modeDisabled}>
                            <h3>Chinese Front</h3>
                            <small>English on back</small>
                        </button>
                        <button className="btn-mode" onClick={() => startGame('EN_FRONT')} disabled={modeDisabled}>
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
                <button className="btn-secondary" onClick={endGame}>End Game</button>
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
                <button className="add-btn btn-secondary" onClick={toggleDifficult}>
                    {currentCard && currentCard.progress && currentCard.progress.difficult ? 'Unmark Difficult' : 'Mark Difficult'}
                </button>
                <button className="add-btn" onClick={handleNext}>Next →</button>
            </div>
        </div>
    );
}

export default FlashcardPage;
