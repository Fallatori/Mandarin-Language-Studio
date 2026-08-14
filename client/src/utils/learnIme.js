import { normalizePinyin } from './pinyinSearch';

export function isHanzi(ch) {
    return /\p{Script=Han}/u.test(ch);
}

export function hanziTiles(tokens) {
    const tiles = [];
    for (const token of tokens || []) {
        const chars = Array.from(token.chineseWord || '');
        const syllables = String(token.pinyin || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        chars.forEach((text, index) => {
            tiles.push({
                text,
                pinyin: syllables.length === chars.length ? syllables[index] : syllables[index] || '',
            });
        });
    }
    return tiles;
}

export function hangmanSlots(chineseText, tokens) {
    const expected = hanziTiles(tokens);
    let hi = 0;
    const slots = [];
    for (const ch of Array.from(chineseText || '')) {
        if (/\s/u.test(ch)) {
            slots.push({ type: 'space' });
            continue;
        }
        if (isHanzi(ch)) {
            const tile = expected[hi];
            slots.push({
                type: 'hanzi',
                text: ch,
                pinyin: tile?.text === ch ? tile.pinyin : '',
            });
            if (tile) hi += 1;
            continue;
        }
        slots.push({ type: 'punct', text: ch });
    }
    while (hi < expected.length) {
        slots.push({ type: 'hanzi', ...expected[hi] });
        hi += 1;
    }
    return slots;
}

export function filledSentence(chineseText, tokens, built) {
    const slots = hangmanSlots(chineseText, tokens);
    const pieces = built || [];
    let i = 0;
    let text = '';
    const pinyin = [];
    for (const slot of slots) {
        if (slot.type === 'space') {
            if (text) text += ' ';
            continue;
        }
        if (slot.type === 'punct') {
            text += slot.text;
            continue;
        }
        const piece = pieces[i];
        if (!piece) break;
        i += 1;
        text += piece.text;
        if (piece.pinyin) pinyin.push(piece.pinyin);
    }
    while (i < pieces.length) {
        text += pieces[i].text;
        if (pieces[i].pinyin) pinyin.push(pieces[i].pinyin);
        i += 1;
    }
    return { text, pinyin: pinyin.join(' ') };
}

export function charTilesFromText(text, pinyin) {
    const chars = Array.from(text || '');
    const syllables = String(pinyin || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const hanziCount = chars.filter((ch) => isHanzi(ch)).length;
    if (syllables.length === chars.length) {
        return chars.map((ch, index) => ({ text: ch, pinyin: syllables[index] || '' }));
    }
    if (syllables.length === hanziCount) {
        let index = 0;
        return chars.map((ch) => ({
            text: ch,
            pinyin: isHanzi(ch) ? syllables[index++] || '' : '',
        }));
    }
    return chars.map((ch) => ({ text: ch, pinyin: '' }));
}

export function charLexicon(tokens, wordList) {
    const fromWords = (wordList || []).map((word) => ({
        chineseWord: word.chineseWord,
        pinyin: word.pinyin,
    }));
    const pieces = [...hanziTiles(tokens), ...hanziTiles(fromWords)];
    const seen = new Set();
    const lexicon = [];
    for (const piece of pieces) {
        if (!piece.text || [...piece.text].length !== 1) continue;
        const key = `${piece.text}|${normalizePinyin(piece.pinyin)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lexicon.push({
            ...piece,
            py: normalizePinyin(piece.pinyin),
        });
    }
    return lexicon;
}

export function imeCandidates(buffer, lexicon, sentenceTexts) {
    if (!buffer) return [];
    const scored = [];
    for (const piece of lexicon) {
        const py = piece.py || '';
        if (!py) continue;
        let rank = 0;
        if (py === buffer) rank = 300 + py.length;
        else if (buffer.startsWith(py)) rank = 200 + py.length;
        else if (py.startsWith(buffer)) rank = 100 + buffer.length;
        else continue;
        if (sentenceTexts.has(piece.text)) rank += 50;
        scored.push({ ...piece, rank });
    }
    scored.sort((a, b) => b.rank - a.rank || a.text.localeCompare(b.text, 'zh'));
    const unique = [];
    const seen = new Set();
    for (const piece of scored) {
        if (seen.has(piece.text)) continue;
        seen.add(piece.text);
        unique.push(piece);
        if (unique.length === 9) break;
    }
    return unique;
}

export function consumePrefix(raw, py) {
    let i = 0;
    let taken = '';
    while (i < raw.length && taken.length < py.length) {
        const chunk = normalizePinyin(raw[i]);
        if (!chunk) {
            i += 1;
            continue;
        }
        taken += chunk;
        i += 1;
    }
    return raw.slice(i);
}

export function greedyConvert(buffer, lexicon, sentenceTexts) {
    const pieces = [];
    let rest = buffer;
    while (rest) {
        let best = null;
        for (const piece of lexicon) {
            const py = piece.py || '';
            if (!py || !rest.startsWith(py)) continue;
            const inSentence = sentenceTexts.has(piece.text);
            if (
                !best
                || py.length > best.py.length
                || (py.length === best.py.length && inSentence && !best.inSentence)
            ) {
                best = { piece, py, inSentence };
            }
        }
        if (!best) break;
        pieces.push(best.piece);
        rest = rest.slice(best.py.length);
    }
    return { pieces, rest };
}

export function matchesSentencePinyin(raw, sentence) {
    const typed = normalizePinyin(raw);
    if (!typed || !sentence) return false;
    return (
        typed === normalizePinyin(sentence.pinyin)
        || typed === String(sentence.pinyinSearch || '')
    );
}

function phraseCandidate(buffer, lexicon, sentenceTexts) {
    const { pieces, rest } = greedyConvert(buffer, lexicon, sentenceTexts);
    if (pieces.length < 2) return null;
    const consumed = buffer.slice(0, buffer.length - rest.length);
    if (!consumed) return null;
    return {
        text: pieces.map((piece) => piece.text).join(''),
        pinyin: pieces.map((piece) => piece.pinyin).filter(Boolean).join(' '),
        py: consumed,
        isPhrase: true,
        tiles: pieces.map((piece) => ({ text: piece.text, pinyin: piece.pinyin || '' })),
    };
}

export function listImeCandidates(raw, tokens, wordList, target, builtLength) {
    const buffer = normalizePinyin(raw);
    if (!buffer) return [];
    const lexicon = charLexicon(tokens, wordList);
    const sentenceTexts = new Set(hanziTiles(tokens).map((tile) => tile.text));
    const list = imeCandidates(buffer, lexicon, sentenceTexts);
    if (matchesSentencePinyin(raw, target) && builtLength === 0) {
        const tiles = hanziTiles(tokens);
        list.unshift({
            text: tiles.map((tile) => tile.text).join(''),
            pinyin: target.pinyin || '',
            py: buffer,
            isSentence: true,
            tiles,
        });
    } else {
        const phrase = phraseCandidate(buffer, lexicon, sentenceTexts);
        if (phrase && phrase.text !== list[0]?.text) {
            list.unshift(phrase);
        }
    }
    if (list.length > 9) list.length = 9;
    return list;
}

export function flushBuffer(raw, built, tokens, wordList, target) {
    if (!normalizePinyin(raw)) {
        return { built, rest: '' };
    }
    if (matchesSentencePinyin(raw, target) && built.length === 0) {
        return { built: hanziTiles(tokens), rest: '' };
    }
    const lexicon = charLexicon(tokens, wordList);
    const sentenceTexts = new Set(hanziTiles(tokens).map((tile) => tile.text));
    const { pieces, rest } = greedyConvert(normalizePinyin(raw), lexicon, sentenceTexts);
    return {
        built: [
            ...built,
            ...pieces.map((piece) => ({ text: piece.text, pinyin: piece.pinyin || '' })),
        ],
        rest,
    };
}
