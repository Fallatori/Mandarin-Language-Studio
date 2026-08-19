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

export function canRuby(text, pinyin) {
    return !!pinyin && charTilesFromText(text, pinyin).some((piece) => piece.pinyin);
}
