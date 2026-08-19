import { charTilesFromText } from './learnIme';

const CACHE = new Map();
const CACHE_LIMIT = 500;

const segmenter =
    typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter('zh-Hans', { granularity: 'word' })
        : null;

export function segmentChinese(text) {
    const value = text || '';
    if (!value) return [];
    if (!segmenter) return Array.from(value);

    const cached = CACHE.get(value);
    if (cached) return cached;

    const parts = Array.from(segmenter.segment(value), (piece) => piece.segment);
    if (CACHE.size >= CACHE_LIMIT) CACHE.clear();
    CACHE.set(value, parts);
    return parts;
}

export function segmentGroups(text, count) {
    const groups = [];
    let index = 0;
    for (const part of segmentChinese(text)) {
        const size = Array.from(part).length;
        groups.push({ start: index, end: Math.min(index + size, count) });
        index += size;
        if (index >= count) break;
    }
    if (index < count) groups.push({ start: index, end: count });
    return groups;
}

const isHan = (ch) => /\p{Script=Han}/u.test(ch);
const isSilent = (ch) => /[\p{P}\p{Z}\p{S}]/u.test(ch);

function syllables(pinyin) {
    return String(pinyin || '')
        .trim()
        .split(/\s+/)
        .filter((token) => /\p{L}|\p{N}/u.test(token))
        .map((token) => token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''));
}

function spanPinyin(chars, start, end, sounds, from) {
    const parts = [];
    let index = from;
    for (let i = start; i < end; i += 1) {
        if (isHan(chars[i]) && index < sounds.length) parts.push(sounds[index++]);
    }
    return { pinyin: parts.join(' '), next: index };
}

function looseUnits(text, chars, sounds) {
    let first = -1;
    let last = -1;
    chars.forEach((ch, i) => {
        if (isHan(ch) || isSilent(ch)) return;
        if (first < 0) first = i;
        last = i;
    });
    if (first < 0) return null;

    const groups = segmentGroups(text, chars.length);
    const startGroup = groups.find((g) => first >= g.start && first < g.end);
    const endGroup = groups.find((g) => last >= g.start && last < g.end);
    if (!startGroup || !endGroup) return null;

    const midStart = startGroup.start;
    const midEnd = endGroup.end;
    const before = chars.slice(0, midStart).filter(isHan).length;
    const after = chars.slice(midEnd).filter(isHan).length;
    if (before + after > sounds.length) return null;

    const units = [];
    let index = 0;
    for (const group of groups) {
        if (group.end <= midStart) {
            const span = spanPinyin(chars, group.start, group.end, sounds, index);
            index = span.next;
            units.push({ text: chars.slice(group.start, group.end).join(''), pinyin: span.pinyin });
        }
    }
    units.push({
        text: chars.slice(midStart, midEnd).join(''),
        pinyin: sounds.slice(before, sounds.length - after).join(' '),
    });
    index = sounds.length - after;
    for (const group of groups) {
        if (group.start >= midEnd) {
            const span = spanPinyin(chars, group.start, group.end, sounds, index);
            index = span.next;
            units.push({ text: chars.slice(group.start, group.end).join(''), pinyin: span.pinyin });
        }
    }
    return units;
}

export function rubyUnits(text, pinyin) {
    const chars = Array.from(text || '');
    if (!chars.length || !pinyin) return null;

    const pieces = charTilesFromText(text, pinyin);
    if (pieces.some((piece) => piece.pinyin)) {
        return segmentGroups(text, pieces.length).map((group) => {
            const wordPieces = pieces.slice(group.start, group.end);
            return {
                text: wordPieces.map((piece) => piece.text).join(''),
                pinyin: wordPieces.map((piece) => piece.pinyin).filter(Boolean).join(' '),
            };
        });
    }

    return looseUnits(text, chars, syllables(pinyin));
}

export function canRuby(text, pinyin) {
    return !!rubyUnits(text, pinyin);
}
