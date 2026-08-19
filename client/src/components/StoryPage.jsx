import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import StoryImportForm from './StoryImportForm';

const API_URL = 'http://localhost:5001/api/stories';
const WORDS_URL = 'http://localhost:5001/api/words';
const CAP_KEY = 'storyMaxSentenceLength';
const HIGHLIGHT_KEY = 'storyHighlightWords';
const PINYIN_KEY = 'storyShowPinyin';
const SPLIT_TOOLS_KEY = 'storyShowSplitTools';
const DEFAULT_CAP = 30;

const statusClass = (status) => {
    if (status === 'known') return 'status-known';
    if (status === 'learning') return 'status-learning';
    if (status === 'new') return 'status-new';
    return 'status-unknown';
};

const Legend = () => (
    <div className="story-legend">
        <span className="story-legend-item"><i className="story-swatch swatch-known" />Known</span>
        <span className="story-legend-item"><i className="story-swatch swatch-learning" />Learning</span>
        <span className="story-legend-item"><i className="story-swatch swatch-new" />New</span>
        <span className="story-legend-item"><i className="story-swatch swatch-unknown" />Not in your list</span>
    </div>
);

function StoryPage() {
    const navigate = useNavigate();
    const [stories, setStories] = useState([]);
    const [reading, setReading] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('paste');
    const [error, setError] = useState('');

    const [title, setTitle] = useState('');
    const [chineseText, setChineseText] = useState('');
    const [maxLength, setMaxLength] = useState(
        () => Number(localStorage.getItem(CAP_KEY)) || DEFAULT_CAP
    );
    const [analysis, setAnalysis] = useState(null);
    const [busy, setBusy] = useState(false);

    const [selection, setSelection] = useState({ sentence: null, clauses: [] });
    const [selectedWord, setSelectedWord] = useState(null);
    const [activeSplit, setActiveSplit] = useState(null);
    const [highlight, setHighlight] = useState(
        () => localStorage.getItem(HIGHLIGHT_KEY) !== 'off'
    );
    const [showPinyin, setShowPinyin] = useState(
        () => localStorage.getItem(PINYIN_KEY) === 'on'
    );
    const [showSplitTools, setShowSplitTools] = useState(
        () => localStorage.getItem(SPLIT_TOOLS_KEY) !== 'off'
    );

    useEffect(() => {
        localStorage.setItem(HIGHLIGHT_KEY, highlight ? 'on' : 'off');
    }, [highlight]);

    useEffect(() => {
        localStorage.setItem(PINYIN_KEY, showPinyin ? 'on' : 'off');
    }, [showPinyin]);

    useEffect(() => {
        localStorage.setItem(SPLIT_TOOLS_KEY, showSplitTools ? 'on' : 'off');
        if (!showSplitTools) {
            setActiveSplit(null);
            setSelection({ sentence: null, clauses: [] });
        }
    }, [showSplitTools]);

    const splitPanelRef = useRef(null);

    useEffect(() => {
        if (activeSplit !== null && splitPanelRef.current) {
            splitPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [activeSplit]);

    const handleAuthError = useCallback((err) => {
        if (err.response && err.response.status === 401) navigate('/login');
    }, [navigate]);

    const fetchStories = useCallback(async () => {
        try {
            const { data } = await axios.get(API_URL, { withCredentials: true });
            setStories(data);
        } catch (err) {
            handleAuthError(err);
        }
    }, [handleAuthError]);

    useEffect(() => { fetchStories(); }, [fetchStories]);

    useEffect(() => {
        localStorage.setItem(CAP_KEY, String(maxLength));
    }, [maxLength]);

    const openStory = async (id, fresh = true) => {
        setError('');
        try {
            const { data } = await axios.get(`${API_URL}/${id}?maxLength=${maxLength}`, {
                withCredentials: true,
            });
            setReading(data);
            setSelection({ sentence: fresh ? null : selection.sentence, clauses: [] });
            if (fresh) setActiveSplit(null);
        } catch (err) {
            handleAuthError(err);
            setError(err.response?.data?.error || 'Could not open that story');
        }
    };

    const resetForm = () => {
        setTitle('');
        setChineseText('');
        setAnalysis(null);
        setError('');
    };

    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };

    const analyze = async () => {
        setBusy(true);
        setError('');
        try {
            const { data } = await axios.post(
                `${API_URL}/analyze`,
                { chineseText, maxLength },
                { withCredentials: true }
            );
            setAnalysis(data);
        } catch (err) {
            handleAuthError(err);
            setError(err.response?.data?.error || 'Could not analyze that text');
        } finally {
            setBusy(false);
        }
    };

    const saveStory = async () => {
        setBusy(true);
        setError('');
        try {
            const { data } = await axios.post(
                API_URL,
                { title, chineseText },
                { withCredentials: true }
            );
            closeModal();
            await fetchStories();
            await openStory(data.story.id);
        } catch (err) {
            handleAuthError(err);
            setError(err.response?.data?.error || 'Could not save that story');
        } finally {
            setBusy(false);
        }
    };

    const deleteStory = async (id) => {
        if (!confirm('Delete this story? Saved sentences and words stay in your list.')) return;
        try {
            await axios.delete(`${API_URL}/${id}`, { withCredentials: true });
            if (reading?.story?.id === id) setReading(null);
            await fetchStories();
        } catch (err) {
            handleAuthError(err);
        }
    };

    const toggleClause = (sentenceIndex, clauseIndex) => {
        setSelection((prev) => {
            if (prev.sentence !== sentenceIndex) {
                return { sentence: sentenceIndex, clauses: [clauseIndex] };
            }
            const has = prev.clauses.includes(clauseIndex);
            const next = has
                ? prev.clauses.filter((i) => i !== clauseIndex)
                : [...prev.clauses, clauseIndex];
            return { sentence: sentenceIndex, clauses: next.sort((a, b) => a - b) };
        });
    };

    const selectionIsContiguous = () => {
        const { clauses } = selection;
        if (clauses.length === 0) return false;
        return clauses.every((v, i) => i === 0 || v === clauses[i - 1] + 1);
    };

    const saveSelection = async () => {
        const sentence = reading.sentences[selection.sentence];
        const clauses = selection.clauses.map((i) => sentence.clauses[i].text);

        setBusy(true);
        setError('');
        try {
            await axios.post(
                `${API_URL}/${reading.story.id}/sentences`,
                { clauses },
                { withCredentials: true }
            );
            await openStory(reading.story.id, false);
        } catch (err) {
            handleAuthError(err);
            setError(err.response?.data?.error || 'Could not save that sentence');
        } finally {
            setBusy(false);
        }
    };

    const setWordStatus = async (status) => {
        try {
            await axios.patch(
                `${WORDS_URL}/${selectedWord.id}/status`,
                { status },
                { withCredentials: true }
            );
            setSelectedWord(null);
            await openStory(reading.story.id, false);
        } catch (err) {
            handleAuthError(err);
            setError(err.response?.data?.error || 'Could not update that word');
        }
    };

    const lookupWord = async (chineseWord) => {
        try {
            const { data } = await axios.get(WORDS_URL, { withCredentials: true });
            const match = data.find((w) => w.chineseWord === chineseWord);
            setSelectedWord(match || { chineseWord, notInList: true });
        } catch (err) {
            handleAuthError(err);
        }
    };

    if (reading) {
        const splitTarget = reading.sentences.find((s) => s.index === activeSplit);
        const pendingSentences = reading.sentences.filter((s) => !s.autoSave && s.pending);

        return (
            <div className="page-container">
                <button className="story-back" onClick={() => setReading(null)}>
                    <span className="material-symbols-outlined">arrow_back</span>
                    All stories
                </button>

                <div className="page-header">
                    <h2 className="hanzi-font story-reader-title">{reading.story.title}</h2>
                    <div className="story-reader-tools">
                        <div className="story-toggles">
                            <button
                                type="button"
                                className={highlight ? 'btn-outline btn-small active' : 'btn-outline btn-small'}
                                onClick={() => setHighlight(!highlight)}
                            >
                                <span className="material-symbols-outlined">
                                    {highlight ? 'visibility' : 'visibility_off'}
                                </span>
                                {highlight ? 'Highlighting on' : 'Highlighting off'}
                            </button>
                            <button
                                type="button"
                                className={showPinyin ? 'btn-outline btn-small active' : 'btn-outline btn-small'}
                                onClick={() => setShowPinyin(!showPinyin)}
                            >
                                <span className="material-symbols-outlined">
                                    {showPinyin ? 'subtitles' : 'subtitles_off'}
                                </span>
                                {showPinyin ? 'Pinyin on' : 'Pinyin off'}
                            </button>
                            <button
                                type="button"
                                className={showSplitTools ? 'btn-outline btn-small active' : 'btn-outline btn-small'}
                                onClick={() => setShowSplitTools(!showSplitTools)}
                                title={
                                    showSplitTools
                                        ? 'Hide the unsaved-sentence highlight and Split buttons'
                                        : 'Show which sentences are not in your list yet'
                                }
                            >
                                <span className="material-symbols-outlined">content_cut</span>
                                {showSplitTools ? 'Split tools on' : 'Split tools off'}
                            </button>
                        </div>
                        {highlight && <Legend />}
                    </div>
                </div>

                {error && <p className="error-message">{error}</p>}

                {showSplitTools && (
                <div className="story-save-hint">
                    {pendingSentences.length > 0 ? (
                        <>
                            <span className="story-swatch swatch-needs-split" />
                            <span>
                                {pendingSentences.length} highlighted{' '}
                                {pendingSentences.length === 1 ? 'sentence is' : 'sentences are'} too long to
                                save whole — use <strong>Split</strong> to save shorter pieces.
                            </span>
                            <button
                                type="button"
                                className="btn-outline btn-small"
                                onClick={() => {
                                    const next = pendingSentences[0];
                                    setActiveSplit(next.index);
                                    setSelection({ sentence: next.index, clauses: [] });
                                }}
                            >
                                <span className="material-symbols-outlined">content_cut</span>
                                Split first
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined story-hint-done">check_circle</span>
                            <span>Every sentence in this story is saved to your list.</span>
                        </>
                    )}
                </div>
                )}

                <div className={`story-prose hanzi-font ${highlight ? '' : 'plain'} ${showPinyin ? 'with-pinyin' : ''}`}>
                    {reading.sentences.map((sentence, sentenceIndex) => {
                        const needsSplit = showSplitTools && !sentence.autoSave && sentence.pending;
                        return (
                        <React.Fragment key={sentence.index}>
                        {sentenceIndex > 0 && <wbr />}
                        <span
                            className={`story-sentence-inline ${needsSplit ? 'needs-split' : ''} ${activeSplit === sentence.index ? 'splitting' : ''}`}
                            title={needsSplit ? 'Not saved yet — too long to save whole. Use Split to save shorter pieces.' : undefined}
                        >
                            {sentence.words.map((word, i) => (
                                word.isWord === false ? (
                                    <React.Fragment key={i}>
                                        {i > 0 && <wbr />}
                                        <span className="story-punct">{word.chineseWord}</span>
                                    </React.Fragment>
                                ) : (
                                    <React.Fragment key={i}>
                                        {i > 0 && <wbr />}
                                        <span
                                            className={`story-word ${highlight ? statusClass(word.status) : ''}`}
                                            onClick={() => lookupWord(word.chineseWord)}
                                            title={word.status || 'not in your list'}
                                        >
                                            <ruby>
                                                {word.chineseWord}
                                                <rt>{word.pinyin}</rt>
                                            </ruby>
                                        </span>
                                    </React.Fragment>
                                )
                            ))}
                            {needsSplit && (
                                <button
                                    type="button"
                                    className={`story-split-toggle ${activeSplit === sentence.index ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveSplit(activeSplit === sentence.index ? null : sentence.index);
                                        setSelection({ sentence: sentence.index, clauses: [] });
                                    }}
                                    title="Split this sentence into shorter ones you can save"
                                >
                                    <span className="material-symbols-outlined">content_cut</span>
                                    <span>{activeSplit === sentence.index ? 'Splitting' : 'Split'}</span>
                                </button>
                            )}
                        </span>
                        </React.Fragment>
                        );
                    })}
                </div>

                {splitTarget && (
                    <div className="story-split-panel" ref={splitPanelRef}>
                        <div className="story-split-head">
                            <span>Pick the sections you want to save as a sentence</span>
                            <button
                                type="button"
                                className="btn-secondary btn-small"
                                onClick={() => { setActiveSplit(null); setSelection({ sentence: null, clauses: [] }); }}
                            >
                                Done
                            </button>
                        </div>
                        <div className="story-clause-row">
                            {splitTarget.clauses.map((clause) => (
                                <button
                                    key={clause.index}
                                    type="button"
                                    disabled={clause.saved}
                                    className={`story-clause hanzi-font ${clause.saved ? 'saved' : ''} ${
                                        selection.sentence === splitTarget.index &&
                                        selection.clauses.includes(clause.index) ? 'active' : ''
                                    }`}
                                    onClick={() => toggleClause(splitTarget.index, clause.index)}
                                    title={clause.saved ? 'Already saved' : ''}
                                >
                                    {clause.text}
                                    {clause.saved && <span className="material-symbols-outlined">check</span>}
                                </button>
                            ))}
                        </div>
                        <div className="story-split-actions">
                            <button
                                type="button"
                                className="btn-success btn-small"
                                disabled={busy || selection.clauses.length === 0 || !selectionIsContiguous()}
                                onClick={saveSelection}
                                title={selectionIsContiguous() ? '' : 'Pick sections that sit next to each other'}
                            >
                                {busy ? 'Saving…' : 'Save selection as a sentence'}
                            </button>
                            {selection.clauses.length > 0 && !selectionIsContiguous() && (
                                <span className="story-split-hint">
                                    Sections need to sit next to each other.
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <Modal
                    isOpen={!!selectedWord}
                    onClose={() => setSelectedWord(null)}
                    title={selectedWord?.chineseWord}
                >
                    {selectedWord && (
                        <div className="word-detail">
                            <p className="word-detail-pinyin">{selectedWord.pinyin}</p>
                            <p className="word-detail-english">{selectedWord.englishTranslation}</p>
                            {selectedWord.notInList ? (
                                <p className="word-detail-note">This word is not in your list yet.</p>
                            ) : (
                                <div className="story-status-picker">
                                    {['new', 'learning', 'known'].map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            className={`btn-outline btn-small ${selectedWord.status === s ? 'active' : ''}`}
                                            onClick={() => setWordStatus(s)}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </Modal>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h2>Stories</h2>
                <button className="btn-primary" onClick={() => { setModalMode('paste'); setIsModalOpen(true); }}>
                    <span className="material-symbols-outlined">add</span> New Story
                </button>
            </div>

            {error && <p className="error-message">{error}</p>}

            {stories.length === 0 ? (
                <p className="empty-state">
                    No stories yet. Paste a text or import a prepared JSON file to get started.
                </p>
            ) : (
                <div className="story-grid">
                    {stories.map((story) => (
                        <div key={story.id} className="card story-card" onClick={() => openStory(story.id)}>
                            <div className="card-top">
                                <h3 className="hanzi-font">{story.title}</h3>
                                <button
                                    className="btn-delete btn-small"
                                    onClick={(e) => { e.stopPropagation(); deleteStory(story.id); }}
                                    aria-label="Delete story"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                            <p className="story-card-preview hanzi-font">
                                {story.chineseText.slice(0, 60)}
                                {story.chineseText.length > 60 ? '…' : ''}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={closeModal} title={null}>
                <div className="story-mode-switch">
                    <button
                        type="button"
                        className={modalMode === 'paste' ? 'btn-primary btn-small' : 'btn-outline btn-small'}
                        onClick={() => setModalMode('paste')}
                    >
                        Paste text
                    </button>
                    <button
                        type="button"
                        className={modalMode === 'json' ? 'btn-primary btn-small' : 'btn-outline btn-small'}
                        onClick={() => setModalMode('json')}
                    >
                        Import JSON
                    </button>
                </div>

                {modalMode === 'json' ? (
                    <StoryImportForm
                        onCancel={closeModal}
                        onImportComplete={async (story) => {
                            closeModal();
                            await fetchStories();
                            await openStory(story.id);
                        }}
                    />
                ) : (
                    <div className="sentence-form">
                        <h3>New Story</h3>

                        <input
                            type="text"
                            placeholder="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <textarea
                            className="hanzi-font"
                            rows={7}
                            placeholder="Paste the Chinese text here…"
                            value={chineseText}
                            onChange={(e) => { setChineseText(e.target.value); setAnalysis(null); }}
                        />

                        <label className="story-cap-label">
                            Auto-save sentences up to
                            <input
                                type="number"
                                min="10"
                                max="200"
                                value={maxLength}
                                onChange={(e) => { setMaxLength(Number(e.target.value)); setAnalysis(null); }}
                            />
                            characters. Longer ones you split yourself.
                        </label>

                        {error && <p className="error-message">{error}</p>}

                        {analysis && (
                            <div className="story-analysis">
                                <div className="bulk-result-stats">
                                    <div className="stat-box stat-success">
                                        <span className="stat-number">{analysis.counts.autoSave}</span>
                                        <span className="stat-label">Auto-save</span>
                                    </div>
                                    <div className="stat-box stat-skipped">
                                        <span className="stat-number">{analysis.counts.manual}</span>
                                        <span className="stat-label">Manual</span>
                                    </div>
                                    <div className="stat-box stat-success">
                                        <span className="stat-number">{analysis.counts.newWords}</span>
                                        <span className="stat-label">New words</span>
                                    </div>
                                    <div className="stat-box stat-skipped">
                                        <span className="stat-number">
                                            {analysis.counts.words - analysis.counts.newWords}
                                        </span>
                                        <span className="stat-label">Known already</span>
                                    </div>
                                </div>

                                <Legend />

                                <div className="story-preview-list">
                                    {analysis.sentences.map((s) => (
                                        <div key={s.index} className="story-preview-item">
                                            <span className={s.autoSave ? 'badge-auto' : 'badge-manual'}>
                                                {s.autoSave ? 'Auto' : 'Manual'}
                                            </span>
                                            <span className="hanzi-font">{s.chineseText}</span>
                                            <span className="story-sentence-length">{s.length}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="preview-actions">
                            <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                            {analysis ? (
                                <button type="button" onClick={saveStory} disabled={busy} className="btn-success">
                                    {busy ? 'Saving…' : `Save story + ${analysis.counts.newWords} words`}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={analyze}
                                    disabled={busy || !chineseText.trim()}
                                    className="btn-primary"
                                >
                                    {busy ? 'Analyzing…' : 'Analyze'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default StoryPage;
