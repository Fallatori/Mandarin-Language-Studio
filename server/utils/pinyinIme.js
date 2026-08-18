const fs = require("fs");
const path = require("path");
const { normalizePinyin } = require("./pinyinSearch");
const { httpError } = require("./httpError");

const DATA_PATH = path.join(__dirname, "..", "data", "ime.json");

const LIMIT = 9;
const MAX_BUFFER = 24;
const PHRASE_POOL = 4000;
const PARTIAL_POOL = 4000;
const TAIL_PENALTY = 50000;
const ABBREV_COST = 120;
const PIECE_COST = 140;
const BOOST = 40;

function makeEntry(text, syllables, display, freq) {
	return {
		text,
		pinyin: display,
		syllables,
		py: syllables.join(""),
		initials: syllables.map((s) => s[0]).join(""),
		freq,
		weight: Math.log(freq + 1),
	};
}

function entriesFromDict(dict) {
	const entries = [];
	for (const [text, value] of Object.entries(dict || {})) {
		if (!text) continue;
		const display = Array.isArray(value) ? value[0] : "";
		const syllables = String(display)
			.split(/\s+/)
			.map(normalizePinyin)
			.filter(Boolean);
		if (!syllables.length) continue;
		entries.push(makeEntry(text, syllables, display, 1));
	}
	return entries;
}

function entriesFromRows(rows, toned) {
	const entries = [];
	for (const [text, pinyin, freq] of rows || []) {
		const syllables = String(pinyin).split(" ").filter(Boolean);
		if (!text || !syllables.length) continue;
		const display = (toned && toned(text)) || syllables.join(" ");
		entries.push(makeEntry(text, syllables, display, freq || 1));
	}
	return entries;
}

function buildIndex(entries) {
	const buckets = new Map();
	for (const entry of entries) {
		const first = entry.py[0];
		if (!first) continue;
		if (!buckets.has(first)) buckets.set(first, []);
		buckets.get(first).push(entry);
	}
	for (const bucket of buckets.values()) {
		bucket.sort((a, b) => b.freq - a.freq);
	}
	return buckets;
}

function isSubsequence(needle, haystack) {
	let i = 0;
	for (let j = 0; j < haystack.length && i < needle.length; j++) {
		if (needle[i] === haystack[j]) i += 1;
	}
	return i === needle.length;
}

function better(a, b) {
	if (!a) return true;
	if (b.fullCount !== a.fullCount) return b.fullCount > a.fullCount;
	if (b.complete !== a.complete) return b.complete;
	return b.syllablesUsed < a.syllablesUsed;
}

function matchSpans(buffer, start, entry) {
	const { syllables } = entry;
	const n = buffer.length;
	const spans = new Map();
	let level = new Map([[start, 0]]);

	for (let i = 0; i < syllables.length; i++) {
		const s = syllables[i];
		const next = new Map();

		for (const [p, fullCount] of level) {
			if (buffer.startsWith(s, p)) {
				const q = p + s.length;
				if ((next.get(q) ?? -1) < fullCount + 1) next.set(q, fullCount + 1);
			}
			if (p < n && buffer[p] === s[0]) {
				const q = p + 1;
				if ((next.get(q) ?? -1) < fullCount) next.set(q, fullCount);
			}
			if (p < n && s.startsWith(buffer.slice(p))) {
				if ((next.get(n) ?? -1) < fullCount) next.set(n, fullCount);
			}
		}

		if (!next.size) break;

		const complete = i + 1 === syllables.length;
		for (const [p, fullCount] of next) {
			const span = { fullCount, syllablesUsed: i + 1, complete, end: p };
			if (better(spans.get(p), span)) spans.set(p, span);
		}
		level = next;
	}

	return spans;
}

function boosted(boost, text) {
	return boost && boost.has(text) ? BOOST : 0;
}

function matchQuality(entry, span, covers, boost) {
	return (
		(covers ? 600 : 0)
		+ boosted(boost, entry.text)
		+ (span.complete ? 300 : 0)
		- ABBREV_COST * (span.syllablesUsed - span.fullCount)
		+ 20 * span.end
		+ 8 * entry.weight
	);
}

function pieceScore(entry, span, boost) {
	return (
		boosted(boost, entry.text)
		+ 40 * span.syllablesUsed
		+ 8 * entry.weight
		- PIECE_COST
		- ABBREV_COST * (span.syllablesUsed - span.fullCount)
	);
}

function convertBuffer(index, buffer, boost) {
	const n = buffer.length;
	const dp = new Array(n + 1);
	dp[0] = { score: 0, pieces: [] };

	for (let i = 0; i < n; i++) {
		if (!dp[i]) continue;
		const bucket = index.get(buffer[i]) || [];
		const pool = Math.min(bucket.length, PHRASE_POOL);

		for (let k = 0; k < pool; k++) {
			const entry = bucket[k];
			for (const span of matchSpans(buffer, i, entry).values()) {
				if (span.end <= i || !span.complete) continue;
				const score = dp[i].score + pieceScore(entry, span, boost);
				if (!dp[span.end] || score > dp[span.end].score) {
					dp[span.end] = {
						score,
						pieces: [...dp[i].pieces, { entry, span }],
					};
				}
			}
		}
	}

	let best = { score: -Infinity, pieces: [], end: 0 };
	for (let i = 1; i <= n; i++) {
		if (!dp[i]) continue;
		const score = dp[i].score - (n - i) * TAIL_PENALTY;
		if (score > best.score) {
			best = { score, pieces: dp[i].pieces, end: i };
		}
	}
	return best;
}

function phraseCandidate(index, buffer, boost) {
	const phrase = convertBuffer(index, buffer, boost);
	if (phrase.pieces.length < 2) return null;

	let fullCount = 0;
	let syllablesUsed = 0;
	let weight = 0;
	let bonus = 0;
	for (const { entry, span } of phrase.pieces) {
		fullCount += span.fullCount;
		syllablesUsed += span.syllablesUsed;
		weight += entry.weight;
		bonus += boosted(boost, entry.text);
	}

	const span = {
		fullCount,
		syllablesUsed,
		complete: true,
		end: phrase.end,
	};
	const entry = { weight: weight / phrase.pieces.length };

	return {
		text: phrase.pieces.map((piece) => piece.entry.text).join(""),
		pinyin: phrase.pieces.map((piece) => piece.entry.pinyin).join(" "),
		py: buffer.slice(0, phrase.end),
		consumed: phrase.end,
		isPhrase: true,
		score:
			matchQuality(entry, span, phrase.end === buffer.length)
			+ bonus
			- 80 * (phrase.pieces.length - 1),
	};
}

function suggest(index, raw, options = {}) {
	const { limit = LIMIT, boost = null } = options;
	const buffer = normalizePinyin(raw).slice(0, MAX_BUFFER);
	if (!buffer) return [];

	const scored = [];
	const phrase = phraseCandidate(index, buffer, boost);
	if (phrase) scored.push(phrase);

	const bucket = index.get(buffer[0]) || [];
	for (let k = 0; k < bucket.length; k++) {
		const entry = bucket[k];
		const covers = buffer.length <= entry.py.length
			&& isSubsequence(buffer, entry.py);
		if (!covers && k >= PARTIAL_POOL) continue;

		let best = null;
		for (const span of matchSpans(buffer, 0, entry).values()) {
			if (!best || span.end > best.end || (span.end === best.end && better(best, span))) {
				best = span;
			}
		}
		if (!best) continue;

		scored.push({
			text: entry.text,
			pinyin: entry.pinyin,
			py: entry.py,
			consumed: best.end,
			isPhrase: false,
			score: matchQuality(entry, best, best.end === buffer.length, boost),
		});
	}

	scored.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text, "zh"));

	const list = [];
	const seen = new Set();
	for (const item of scored) {
		if (seen.has(item.text)) continue;
		seen.add(item.text);
		const { score, ...candidate } = item;
		list.push(candidate);
		if (list.length >= limit) break;
	}
	return list;
}

let cachedIndex = null;

function getIndex() {
	if (cachedIndex) return cachedIndex;

	if (!fs.existsSync(DATA_PATH)) {
		throw httpError(500, "IME data is missing. Run: npm run build:ime");
	}

	const rows = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
	const DictionaryService = require("../services/DictionaryService");
	let dict = {};
	try {
		dict = DictionaryService.loadDict();
	} catch {
		dict = {};
	}
	const toned = (text) => (dict[text] ? dict[text][0] : "");

	cachedIndex = buildIndex(entriesFromRows(rows, toned));
	return cachedIndex;
}

function suggestQuery(raw, boost) {
	return suggest(getIndex(), raw, { boost });
}

module.exports = {
	entriesFromDict,
	entriesFromRows,
	buildIndex,
	matchSpans,
	suggest,
	suggestQuery,
};
