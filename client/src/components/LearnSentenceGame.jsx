import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    hanziTiles,
    charTilesFromText,
    hangmanSlots,
    filledSentence,
    consumePrefix,
    listImeCandidates,
    flushBuffer,
} from '../utils/learnIme';

function shuffle(items) {
    const next = items.slice();
    for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = next[i];
        next[i] = next[j];
        next[j] = tmp;
    }
    return next;
}

function stageFields(stage, tokens) {
    return {
        stage,
        phase: 'prompt',
        built: [],
        poolTiles: stage === 2 ? shuffle(hanziTiles(tokens)) : [],
        pinyinInput: '',
        attempted: [],
        attemptedPinyin: '',
    };
}

function dealChoices(pool, targetIndex) {
    const target = pool[targetIndex];
    const others = pool.filter((_, index) => index !== targetIndex);
    return shuffle([target, ...shuffle(others).slice(0, 2)]);
}

function expectedTiles(tokens) {
    return hanziTiles(tokens);
}

function joinText(tiles) {
    return (tiles || []).map((tile) => (typeof tile === 'string' ? tile : tile.text)).join('');
}

function asPieces(tiles) {
    return (tiles || []).map((tile) => (
        typeof tile === 'string' ? { text: tile, pinyin: '' } : tile
    ));
}

function RubySentence({ text, pinyin, showPinyin }) {
    const pieces = charTilesFromText(text, pinyin);
    return (
        <span className="learn-ruby-line">
            {pieces.map((piece, index) => (
                <ruby
                    key={`${piece.text}-${index}`}
                    className={`learn-ruby${showPinyin ? ' with-pinyin' : ''}`}
                >
                    <span className="hanzi-font">{piece.text}</span>
                    <rt>{piece.pinyin || '\u00a0'}</rt>
                </ruby>
            ))}
        </span>
    );
}

function HanziTile({ piece, placed, showPinyin, onClick, mismatch, match }) {
    const className = `learn-tile${placed ? ' placed' : ''}${mismatch ? ' mismatch' : ''}${match ? ' match' : ''}`;
    const ruby = (
        <ruby className={`learn-ruby${showPinyin ? ' with-pinyin' : ''}`}>
            <span className="hanzi-font">{piece.text}</span>
            <rt>{piece.pinyin || '\u00a0'}</rt>
        </ruby>
    );
    if (onClick) {
        return (
            <button type="button" className={className} onClick={onClick}>
                {ruby}
            </button>
        );
    }
    return <span className={className}>{ruby}</span>;
}

function HangmanRow({ built, chineseText, tokens, showPinyin, onRemove }) {
    const slots = hangmanSlots(chineseText, tokens);
    const hanziTotal = slots.filter((slot) => slot.type === 'hanzi').length;
    let builtIndex = 0;
    const cells = slots.map((slot, index) => {
        if (slot.type === 'space') {
            return <span key={`sp-${index}`} className="learn-hangman-space" />;
        }
        if (slot.type === 'punct') {
            return (
                <span key={`p-${index}`} className="learn-hangman-punct hanzi-font">
                    {slot.text}
                </span>
            );
        }
        const piece = built[builtIndex];
        const removeAt = builtIndex;
        builtIndex += 1;
        if (!piece) {
            return (
                <span key={`b-${index}`} className="learn-hangman-char blank" aria-hidden="true">
                    <ruby className={`learn-ruby${showPinyin ? ' with-pinyin' : ''}`}>
                        <span className="hanzi-font">{'\u3000'}</span>
                        <rt>{'\u00a0'}</rt>
                    </ruby>
                </span>
            );
        }
        return (
            <button
                key={`f-${index}`}
                type="button"
                className="learn-hangman-char filled"
                onClick={() => onRemove(removeAt)}
            >
                <ruby className={`learn-ruby${showPinyin ? ' with-pinyin' : ''}`}>
                    <span className="hanzi-font">{piece.text}</span>
                    <rt>{piece.pinyin || '\u00a0'}</rt>
                </ruby>
            </button>
        );
    });
    const extra = built.slice(builtIndex).map((piece, index) => (
        <button
            key={`x-${index}`}
            type="button"
            className="learn-hangman-char filled extra"
            onClick={() => onRemove(builtIndex + index)}
        >
            <ruby className={`learn-ruby${showPinyin ? ' with-pinyin' : ''}`}>
                <span className="hanzi-font">{piece.text}</span>
                <rt>{piece.pinyin || '\u00a0'}</rt>
            </ruby>
        </button>
    ));
    return (
        <>
            <p className="learn-hangman-count" aria-live="polite">
                {Math.min(built.length, hanziTotal)} / {hanziTotal}
            </p>
            <div className="learn-hangman">
                {cells}
                {extra}
            </div>
        </>
    );
}

function CompareLine({ label, tiles, sentencePinyin, tone, showPinyin }) {
    const list = asPieces(tiles);
    const empty = !list.length;
    return (
        <div className="learn-compare-block">
            <p className="learn-reveal-label">{label}</p>
            {empty ? (
                <p className="learn-compare-empty">Empty</p>
            ) : (
                <div
                    className={`learn-compare-sentence${tone === 'wrong' ? ' mismatch' : ''}${tone === 'correct' ? ' correct' : ''}`}
                >
                    <RubySentence
                        text={list[0].text}
                        pinyin={sentencePinyin || list[0].pinyin}
                        showPinyin={showPinyin}
                    />
                </div>
            )}
        </div>
    );
}

function LearnSentenceGame({ sentences, onExit, onRoundDone }) {
    const navigate = useNavigate();
    const [game, setGame] = useState(null);
    const [showPinyin, setShowPinyin] = useState(false);
    const [imeIndex, setImeIndex] = useState(0);
    const busyRef = useRef(false);
    const roundRef = useRef(0);

    const bootRef = useRef({ sentences, onExit, navigate });
    bootRef.current = { sentences, onExit, navigate };

    const beginRound = useCallback(async (pool, wordList, targetIndex) => {
        const target = pool[targetIndex];
        if (!target) {
            bootRef.current.onExit();
            return;
        }
        const roundId = roundRef.current + 1;
        roundRef.current = roundId;
        setGame({
            pool,
            wordList,
            targetIndex,
            choices: dealChoices(pool, targetIndex),
            tokens: [],
            tokensStatus: 'loading',
            pendingStage: null,
            missed: false,
            ...stageFields(1, []),
        });
        try {
            const res = await axios.get(
                `http://localhost:5001/api/sentences/${target.id}/tokens`,
                { withCredentials: true },
            );
            if (roundRef.current !== roundId) return;
            const tokens = Array.isArray(res.data) ? res.data : [];
            setGame((prev) => {
                if (!prev || prev.targetIndex !== targetIndex) return prev;
                const next = { ...prev, tokens, tokensStatus: 'ready' };
                if (prev.pendingStage) {
                    return {
                        ...next,
                        pendingStage: null,
                        ...stageFields(prev.pendingStage, tokens),
                    };
                }
                return next;
            });
        } catch (error) {
            console.error('Failed to load sentence tokens', error);
            if (error.response && error.response.status === 401) {
                bootRef.current.navigate('/login');
                return;
            }
            if (roundRef.current !== roundId) return;
            setGame((prev) => {
                if (!prev || prev.targetIndex !== targetIndex) return prev;
                return { ...prev, tokensStatus: 'error', pendingStage: null };
            });
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const pool = shuffle(bootRef.current.sentences);
        beginRound(pool, [], 0);
        (async () => {
            try {
                const res = await axios.get('http://localhost:5001/api/words', {
                    withCredentials: true,
                });
                if (cancelled) return;
                const wordList = (res.data || []).map((word) => ({
                    chineseWord: word.chineseWord,
                    pinyin: word.pinyin,
                }));
                setGame((prev) => (prev ? { ...prev, wordList } : prev));
            } catch (error) {
                console.error('Failed to load words', error);
                if (error.response && error.response.status === 401) {
                    bootRef.current.navigate('/login');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [beginRound]);

    const target = game ? game.pool[game.targetIndex] : null;

    const advance = useCallback((current) => {
        const nextIndex = current.targetIndex + 1;
        if (nextIndex >= current.pool.length) {
            onExit();
            return;
        }
        beginRound(current.pool, current.wordList, nextIndex);
    }, [beginRound, onExit]);

    const finishAttempt = useCallback(async (current) => {
        if (busyRef.current) return;
        busyRef.current = true;
        const currentTarget = current.pool[current.targetIndex];
        try {
            await axios.patch(
                `http://localhost:5001/api/sentences/${currentTarget.id}/practice`,
                { xp: current.missed ? 1 : 3 },
                { withCredentials: true },
            );
        } catch (error) {
            console.error('Failed to mark practiced', error);
            if (error.response && error.response.status === 401) {
                busyRef.current = false;
                navigate('/login');
                return;
            }
        }
        const ended = onRoundDone(currentTarget.id);
        busyRef.current = false;
        if (!ended) advance(current);
    }, [advance, navigate, onRoundDone]);

    const enterStage = (nextStage) => {
        setImeIndex(0);
        setGame((prev) => {
            if (!prev) return prev;
            if (nextStage >= 2 && prev.tokensStatus === 'loading') {
                return { ...prev, pendingStage: nextStage };
            }
            if (nextStage >= 2 && prev.tokensStatus === 'error') {
                return { ...prev, stage: nextStage, phase: 'reveal', missed: true };
            }
            return { ...prev, ...stageFields(nextStage, prev.tokens) };
        });
    };

    const handleChoice = (choice) => {
        if (!game || game.phase !== 'prompt' || game.stage !== 1) return;
        if (choice.id === target.id) {
            enterStage(2);
            return;
        }
        setGame((prev) => ({
            ...prev,
            missed: true,
            phase: 'reveal',
            attempted: [{ text: choice.chineseText, pinyin: choice.pinyin || '' }],
        }));
    };

    const placeTile = (index) => {
        if (!game || game.phase !== 'prompt' || game.stage !== 2) return;
        setGame((prev) => {
            const poolTiles = prev.poolTiles.slice();
            const [tile] = poolTiles.splice(index, 1);
            return { ...prev, poolTiles, built: [...prev.built, tile] };
        });
    };

    const unplaceTile = (index) => {
        if (!game || game.phase !== 'prompt' || game.stage !== 2) return;
        setGame((prev) => {
            const built = prev.built.slice();
            const [tile] = built.splice(index, 1);
            return { ...prev, built, poolTiles: [...prev.poolTiles, tile] };
        });
    };

    const setPinyinInput = (value) => {
        if (!game || game.phase !== 'prompt' || game.stage !== 3) return;
        setImeIndex(0);
        setGame((prev) => ({ ...prev, pinyinInput: value }));
    };

    const commitPieces = (pieces, nextInput) => {
        if (!pieces.length) return;
        setGame((prev) => ({
            ...prev,
            built: [...prev.built, ...pieces.map((piece) => ({ text: piece.text, pinyin: piece.pinyin || '' }))],
            pinyinInput: nextInput,
        }));
        setImeIndex(0);
    };

    const removeHanzi = (index) => {
        if (!game || game.phase !== 'prompt' || game.stage !== 3) return;
        setGame((prev) => {
            const built = prev.built.slice();
            built.splice(index, 1);
            return { ...prev, built };
        });
    };

    const handleCheck = () => {
        if (!game || game.phase !== 'prompt') return;
        let built = game.built;
        let leftover = game.stage === 3 ? game.pinyinInput.trim() : '';
        if (game.stage === 3 && leftover) {
            const flushed = flushBuffer(
                leftover,
                game.built,
                game.tokens,
                game.wordList,
                target,
            );
            built = flushed.built;
            leftover = flushed.rest;
        }
        const expected = joinText(expectedTiles(game.tokens));
        const got = joinText(built);
        if (got === expected && !leftover) {
            if (game.stage === 2) {
                enterStage(3);
                return;
            }
            finishAttempt({ ...game, built });
            return;
        }
        setGame((prev) => ({
            ...prev,
            missed: true,
            phase: 'reveal',
            attempted: built.slice(),
            attemptedPinyin: leftover,
        }));
    };

    const commitCandidate = (piece, raw) => {
        if (piece.isSentence) {
            setGame((prev) => ({
                ...prev,
                built: piece.tiles || hanziTiles(prev.tokens),
                pinyinInput: '',
            }));
            setImeIndex(0);
            return;
        }
        if (piece.isPhrase && piece.tiles?.length) {
            commitPieces(piece.tiles, consumePrefix(raw, piece.py));
            return;
        }
        commitPieces([piece], consumePrefix(raw, piece.py));
    };

    const handleStage3Key = (event, candidates) => {
        if (!game || game.phase !== 'prompt' || game.stage !== 3) return;
        const raw = game.pinyinInput;
        const selected = candidates.length
            ? Math.min(imeIndex, candidates.length - 1)
            : 0;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            if (!candidates.length) return;
            event.preventDefault();
            setImeIndex((index) => (index + 1) % candidates.length);
            return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            if (!candidates.length) return;
            event.preventDefault();
            setImeIndex((index) => (index - 1 + candidates.length) % candidates.length);
            return;
        }

        const digit = event.key >= '1' && event.key <= '9' ? Number(event.key) : 0;
        if (digit && candidates[digit - 1]) {
            event.preventDefault();
            commitCandidate(candidates[digit - 1], raw);
            return;
        }

        if (event.key === 'Backspace' && !raw) {
            if (!game.built.length) return;
            event.preventDefault();
            setGame((prev) => ({ ...prev, built: prev.built.slice(0, -1) }));
            return;
        }

        if (event.key === ' ' || event.key === 'Tab') {
            event.preventDefault();
            if (candidates.length) commitCandidate(candidates[selected], raw);
            return;
        }

        if (event.key !== 'Enter') return;
        event.preventDefault();
        handleCheck();
    };

    const handleContinue = () => {
        if (!game || game.phase !== 'reveal') return;
        if (game.stage === 1) {
            enterStage(2);
            return;
        }
        if (game.stage === 2) {
            enterStage(3);
            return;
        }
        finishAttempt(game);
    };

    if (!game || !target) {
        return <div className="loading-message">Loading cards...</div>;
    }

    const imeCandidatesList = (game.stage === 3 && game.phase === 'prompt')
        ? listImeCandidates(
            game.pinyinInput,
            game.tokens,
            game.wordList,
            target,
            game.built.length,
        )
        : [];
    const activeIme = imeCandidatesList.length
        ? Math.min(imeIndex, imeCandidatesList.length - 1)
        : 0;

    const attemptedChoice = game.attempted[0];
    const attemptedSentence = filledSentence(
        target.chineseText,
        game.tokens,
        game.attempted || [],
    );

    return (
        <div className="game-wrapper">
            <div className="content-header flashcard-header">
                <div className="header-left">
                    <h2>Learn sentence</h2>
                </div>
                <div className="header-center">
                    <div className="card-counter">
                        {game.targetIndex + 1} / {game.pool.length}
                    </div>
                    <div className="card-counter learn-stage-counter">
                        {game.stage} / 3
                    </div>
                </div>
                <div className="header-right learn-header-actions">
                    <button
                        type="button"
                        className={`btn-outline btn-medium${showPinyin ? ' learn-pinyin-on' : ''}`}
                        onClick={() => setShowPinyin((on) => !on)}
                    >
                        Pinyin
                    </button>
                    <button className="btn-outline btn-medium" onClick={onExit}>End Game</button>
                </div>
            </div>

            <div className="learn-stage-dots" aria-hidden="true">
                {[1, 2, 3].map((dot) => (
                    <span
                        key={dot}
                        className={`learn-stage-dot${dot === game.stage ? ' current' : ''}${dot < game.stage ? ' done' : ''}`}
                    />
                ))}
            </div>

            {game.pendingStage || (game.stage > 1 && game.tokensStatus === 'loading') ? (
                <div className="loading-message">Loading words...</div>
            ) : (
                <div className="learn-stage">
                    <p className="learn-prompt">{target.englishTranslation}</p>

                    {game.phase === 'prompt' && game.stage === 1 && (
                        <div className="learn-choices">
                            {game.choices.map((choice) => (
                                <button
                                    key={choice.id}
                                    type="button"
                                    className="learn-choice"
                                    onClick={() => handleChoice(choice)}
                                >
                                    <RubySentence
                                        text={choice.chineseText}
                                        pinyin={choice.pinyin}
                                        showPinyin={showPinyin}
                                    />
                                </button>
                            ))}
                        </div>
                    )}

                    {game.phase === 'reveal' && game.stage === 1 && game.tokensStatus !== 'error' && (
                        <div className="learn-compare">
                            <CompareLine
                                label="Your answer"
                                tiles={attemptedChoice?.text ? [attemptedChoice] : []}
                                sentencePinyin={attemptedChoice?.pinyin || ''}
                                tone="wrong"
                                showPinyin={showPinyin}
                            />
                            <CompareLine
                                label="Correct"
                                tiles={[{ text: target.chineseText, pinyin: target.pinyin || '' }]}
                                sentencePinyin={target.pinyin || ''}
                                tone="correct"
                                showPinyin={showPinyin}
                            />
                        </div>
                    )}

                    {game.phase === 'prompt' && game.stage === 2 && (
                        <>
                            <HangmanRow
                                built={game.built}
                                chineseText={target.chineseText}
                                tokens={game.tokens}
                                showPinyin={showPinyin}
                                onRemove={unplaceTile}
                            />
                            <div className="learn-pool">
                                {game.poolTiles.map((tile, index) => (
                                    <HanziTile
                                        key={`pool-${index}`}
                                        piece={tile}
                                        showPinyin={showPinyin}
                                        onClick={() => placeTile(index)}
                                    />
                                ))}
                            </div>
                            <button type="button" className="btn-primary" onClick={handleCheck}>
                                Check
                            </button>
                        </>
                    )}

                    {game.phase === 'prompt' && game.stage === 3 && (
                        <>
                            <HangmanRow
                                built={game.built}
                                chineseText={target.chineseText}
                                tokens={game.tokens}
                                showPinyin={showPinyin}
                                onRemove={removeHanzi}
                            />
                            <div className="learn-ime">
                                <div className="learn-ime-cands" role="listbox" aria-label="Hanzi suggestions">
                                    {imeCandidatesList.map((item, index) => (
                                        <button
                                            key={`${item.text}-${index}`}
                                            type="button"
                                            role="option"
                                            aria-selected={index === activeIme}
                                            className={`learn-ime-cand${index === activeIme ? ' current' : ''}${item.isSentence || item.isPhrase ? ' sentence' : ''}`}
                                            onClick={() => commitCandidate(item, game.pinyinInput)}
                                        >
                                            <span className="learn-ime-num">{index + 1}</span>
                                            {item.isSentence || item.isPhrase ? (
                                                <span className="hanzi-font">{item.text}</span>
                                            ) : (
                                                <ruby className={`learn-ruby${showPinyin ? ' with-pinyin' : ''}`}>
                                                    <span className="hanzi-font">{item.text}</span>
                                                    <rt>{item.pinyin || '\u00a0'}</rt>
                                                </ruby>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    className="learn-pinyin-input"
                                    type="text"
                                    value={game.pinyinInput}
                                    onChange={(event) => setPinyinInput(event.target.value)}
                                    onKeyDown={(event) => handleStage3Key(event, imeCandidatesList)}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    placeholder="Type pinyin"
                                />
                            </div>
                            <button type="button" className="btn-primary" onClick={handleCheck}>
                                Check
                            </button>
                        </>
                    )}

                    {game.phase === 'reveal' && (
                        <div className="learn-reveal">
                            {game.tokensStatus === 'error' && game.stage > 1 ? (
                                <p className="learn-reveal-label">Couldn't load word tiles</p>
                            ) : game.stage > 1 ? (
                                <div className="learn-compare">
                                    <CompareLine
                                        label="Your answer"
                                        tiles={attemptedSentence.text
                                            ? [{ text: attemptedSentence.text, pinyin: attemptedSentence.pinyin }]
                                            : []}
                                        sentencePinyin={attemptedSentence.pinyin}
                                        tone="wrong"
                                        showPinyin={showPinyin}
                                    />
                                    {game.attemptedPinyin ? (
                                        <p className="learn-compare-pinyin">
                                            Leftover pinyin: {game.attemptedPinyin}
                                        </p>
                                    ) : null}
                                    <CompareLine
                                        label="Correct"
                                        tiles={[{ text: target.chineseText, pinyin: target.pinyin || '' }]}
                                        sentencePinyin={target.pinyin || ''}
                                        tone="correct"
                                        showPinyin={showPinyin}
                                    />
                                </div>
                            ) : null}
                        </div>
                    )}

                    {game.phase === 'reveal' && (
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={() => {
                                if (game.tokensStatus === 'error' && game.stage > 1) {
                                    finishAttempt({ ...game, missed: true });
                                    return;
                                }
                                handleContinue();
                            }}
                        >
                            Continue
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default LearnSentenceGame;
