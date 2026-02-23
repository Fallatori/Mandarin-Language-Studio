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
    const [filter, setFilter] = useState("all");
    const [sessionFilter, setSessionFilter] = useState("all");
    
    const [hasChosenScope, setHasChosenScope] = useState(true);

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
        
        try {
            const url = `http://localhost:5001/api/sentences/flashcards/counts?${params.toString()}`;
            const res = await axios.get(url, { withCredentials: true });
            return res.data;
        } catch (err) {
            console.error(err);
            return null;
        }
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
    }, [user, selectedDeckId, fetchFlashcardCounts, navigate]);

    useEffect(() => {
        refreshCounts();
    }, [refreshCounts]);

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
        }
    }, [sentences, currentIndex]);

    const handleNext = useCallback(async (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        
        const current = sentences[currentIndex];
        if (!current) return;

        await markPracticed(current.id);

        const shouldRemove = sessionFilter === 'due' && !(current.progress && current.progress.difficult);

        setIsFlipped(false);

        if (shouldRemove) {
            const nextSentences = sentences.filter((_, idx) => idx !== currentIndex);
            setSentences(nextSentences);

            if (nextSentences.length === 0) {
                endGame();
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
    }, [sentences, currentIndex, sessionFilter, markPracticed, endGame]);

    const handlePrev = useCallback((e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        setIsFlipped(false);
        setTimeout(() => {
            setCurrentIndex((prev) => (prev - 1 + sentences.length) % sentences.length);
        }, 100);
    }, [sentences.length]);


    useEffect(() => {
        if (!gameMode) return;

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                handleNext(e);
            } else if (e.key === 'ArrowLeft') {
                handlePrev(e);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                 setIsFlipped(prev => !prev);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameMode, handleNext, handlePrev]);

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
            <div>
                 <div className="content-header">
                    <div className="header-top">
                        <div className="header-title">
                            <h2>Flashcard Practice</h2>
                            <p>Test your memory with spaced repetition</p>
                        </div>
                    </div>

                    <div className="filter-pills">
                        <button
                            className={`pill-btn ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => {
                                setHasChosenScope(true);
                                setFilter('all');
                            }}
                            disabled={isFilterEmpty('all')}
                        >
                            All ({countsLabel('all')})
                        </button>
                        <button
                            className={`pill-btn ${filter === 'due' ? 'active' : ''}`}
                            onClick={() => {
                                setHasChosenScope(true);
                                setFilter('due');
                            }}
                            disabled={isFilterEmpty('due')}
                        >
                            Due ({countsLabel('due')})
                        </button>
                        <button
                            className={`pill-btn ${filter === 'difficult' ? 'active' : ''}`}
                            onClick={() => {
                                setHasChosenScope(true);
                                setFilter('difficult');
                            }}
                            disabled={isFilterEmpty('difficult')}
                        >
                            Difficult ({countsLabel('difficult')})
                        </button>
                    </div>
                </div>

                <div className="flashcard-setup-container">
                    <div className="deck-selector-group">
                        <label className="deck-selector-label">Select Deck:</label>
                        <div className="deck-selector-row">
                             <div className="select-wrapper">
                                <select 
                                    value={selectedDeckId} 
                                    onChange={(e) => {
                                        const next = e.target.value;
                                        setSelectedDeckId(next);
                                        setHasChosenScope(true);
                                    }}
                                    className="deck-dropdown"
                                >
                                    <option value="">All Cards</option>
                                    {decks.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.sentences.length})</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined select-icon">expand_more</span>
                            </div>
                            <button 
                                onClick={() => navigate('/decks')}
                                className="btn-outline"
                            >
                                Manage Decks
                            </button>
                        </div>
                    </div>

                    <div className="mode-selection">
                       <p className="mode-label">Choose Mode:</p>
                       <div className="mode-buttons-grid">
                            <button 
                                className="mode-card" 
                                onClick={() => startGame('CN_FRONT')} 
                                disabled={modeDisabled}
                            >
                                <div className="mode-icon">
                                    <span className="material-symbols-outlined">translate</span>
                                </div>
                                <div className="mode-info">
                                    <h3>Chinese Front</h3>
                                    <span>English on back</span>
                                </div>
                            </button>

                            <button 
                                className="mode-card" 
                                onClick={() => startGame('EN_FRONT')} 
                                disabled={modeDisabled}
                            >
                                 <div className="mode-icon">
                                    <span className="material-symbols-outlined">language</span>
                                </div>
                                <div className="mode-info">
                                    <h3>English Front</h3>
                                    <span>Chinese on back</span>
                                </div>
                            </button>
                       </div>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading) return <div className="loading-message">Loading cards...</div>;
    if (sentences.length === 0) return <div className="empty-state-message">No sentences found to practice</div>;

    const currentCard = sentences[currentIndex];

    // Design: Front content centered big, Back content details
    const frontContent = gameMode === 'CN_FRONT' 
        ? <div className="fc-content-main hanzi-font">{currentCard.chineseText}</div>
        : <div className="fc-content-main">{currentCard.englishTranslation}</div>;

    const backContent = gameMode === 'CN_FRONT'
        ? (
            <div className="fc-content-back">
                <div className="fc-pinyin">{currentCard.pinyin}</div>
                <div className="fc-sub">{currentCard.englishTranslation}</div>
            </div>
          )
        : (
            <div className="fc-content-back">
                <div className="fc-hanzi hanzi-font">{currentCard.chineseText}</div>
                <div className="fc-pinyin">{currentCard.pinyin}</div>
            </div>
          );

    return (
        <div className="game-wrapper">
             <div className="content-header flashcard-header">
                <div className="header-left">
                    <h2>Practice Mode</h2>
                </div>
                <div className="header-center">
                    <div className="card-counter">
                        {currentIndex + 1} / {sentences.length}
                    </div>
                </div>
                <div className="header-right">
                    <button className="btn-outline btn-medium" onClick={endGame}>End Game</button>
                </div>
            </div>

            <div className="flashcard-stage">
                <div 
                    className={`flashcard-container ${isFlipped ? 'flipped' : ''}`} 
                    onClick={() => setIsFlipped(!isFlipped)}
                >
                    <div className="flashcard-inner">
                        <div className="flashcard-front">
                            {frontContent}
                            <div className="card-hint">
                                <span className="material-symbols-outlined">touch_app</span>
                                <span>Click to flip</span>
                            </div>
                        </div>
                        <div className="flashcard-back">
                            {backContent}
                        </div>
                    </div>
                </div>

                <div className="game-controls">
                    <div className="control-group-left">
                         <button className="icon-control-btn" onClick={handlePrev} title="Previous">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                         <button 
                            className={`icon-control-btn difficult-btn ${currentCard?.progress?.difficult ? 'active-warning' : ''}`} 
                            onClick={toggleDifficult}
                            title="Toggle Difficult"
                        >
                            <span className="material-symbols-outlined">warning</span>
                            <span>{currentCard?.progress?.difficult ? 'Difficult' : 'Mark as Difficult'}</span>
                        </button>
                    </div>

                    <button className="btn-primary btn-large-next" onClick={handleNext}>
                        <span>Next Card</span>
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default FlashcardPage;
