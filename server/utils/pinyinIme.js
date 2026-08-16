const { normalizePinyin } = require("./pinyinSearch");

const CHAR_FREQ =
	"的一是不了在人有我他这中来上大为和国地到以说时要就出会可也你对生能而子那得于着下自之年过发后作里用道行所然家种事成方多经么去法学如都同现当没动面起看定天分还进好小部其些主样理心她本前开但因只从想实日军者意无力它与长把机十民第公此已工使情明性知全三又关点正业外将两高间由问很最重并物手应战向头文体政美相见被利什二等产或新己制身果加西斯月话合回特代内信表化老给世位次度门任常先海通教原东声提立及比员解水名真论处走义各入几口认条做气级太女白象爱叫再象什么";

const WORD_FREQ = {
	的: 0,
	我: 1,
	我们: 2,
	你: 3,
	是: 4,
	不: 5,
	了: 6,
	在: 7,
	人: 8,
	有: 9,
	他: 10,
	这: 11,
	爱: 18,
	喜欢: 20,
	你们: 22,
	什么: 24,
	可以: 26,
	没有: 28,
	自己: 30,
	知道: 32,
	一个: 34,
};

function freqOf(text) {
	if (Object.hasOwn(WORD_FREQ, text)) return WORD_FREQ[text];
	let worst = 0;
	for (const ch of text) {
		const index = CHAR_FREQ.indexOf(ch);
		worst = Math.max(worst, index === -1 ? 9000 : index);
	}
	return worst || 9000;
}

function entriesFromDict(dict) {
	const entries = [];
	for (const [text, value] of Object.entries(dict || {})) {
		if (!text) continue;
		const pinyin = Array.isArray(value) ? value[0] : "";
		const py = normalizePinyin(pinyin);
		if (!py) continue;
		entries.push({
			text,
			pinyin,
			py,
			english: Array.isArray(value) ? value[1] || "" : "",
			freq: freqOf(text),
		});
	}
	return entries;
}

function buildIndex(entries) {
	const buckets = new Map();
	const byFirst = new Map();
	for (const entry of entries) {
		const two = entry.py.slice(0, 2);
		if (!buckets.has(two)) buckets.set(two, []);
		buckets.get(two).push(entry);
		const first = entry.py[0];
		if (!byFirst.has(first)) byFirst.set(first, []);
		byFirst.get(first).push(entry);
	}
	return { buckets, byFirst };
}

function poolFor(index, buffer) {
	if (!buffer) return [];
	if (buffer.length === 1) return index.byFirst.get(buffer) || [];
	return index.buckets.get(buffer.slice(0, 2)) || [];
}

function wordScore(entry) {
	return entry.py.length * 200 - entry.freq;
}

function convertBuffer(index, buffer) {
	const n = buffer.length;
	const dp = new Array(n + 1);
	dp[0] = { score: 0, pieces: [] };

	for (let i = 0; i < n; i++) {
		if (!dp[i]) continue;
		const rest = buffer.slice(i);
		for (const entry of poolFor(index, rest)) {
			if (!rest.startsWith(entry.py)) continue;
			const j = i + entry.py.length;
			const score = dp[i].score + wordScore(entry);
			if (!dp[j] || score > dp[j].score) {
				dp[j] = { score, pieces: [...dp[i].pieces, entry] };
			}
		}
	}

	let best = { score: -Infinity, pieces: [], rest: buffer };
	for (let i = 0; i <= n; i++) {
		if (!dp[i]) continue;
		const score = dp[i].score - (n - i) * 50000;
		if (score > best.score) {
			best = { score, pieces: dp[i].pieces, rest: buffer.slice(i) };
		}
	}
	return { pieces: best.pieces, rest: best.rest };
}

function suggest(index, raw, limit = 9) {
	const buffer = normalizePinyin(raw);
	if (!buffer) return [];

	const { pieces, rest } = convertBuffer(index, buffer);
	const scored = [];
	for (const entry of poolFor(index, buffer)) {
		const py = entry.py;
		let rank = 0;
		if (py === buffer) rank = 300 + py.length;
		else if (buffer.startsWith(py)) rank = 200 + py.length;
		else if (py.startsWith(buffer)) rank = 100 + Math.min(py.length, 12);
		else continue;
		scored.push({ ...entry, rank });
	}
	scored.sort(
		(a, b) =>
			b.rank - a.rank
			|| a.freq - b.freq
			|| a.text.length - b.text.length
			|| a.text.localeCompare(b.text, "zh"),
	);

	const list = [];
	const seen = new Set();
	if (pieces.length >= 2 || (pieces.length === 1 && rest)) {
		const consumed = buffer.slice(0, buffer.length - rest.length);
		const text = pieces.map((piece) => piece.text).join("");
		list.push({
			text,
			pinyin: pieces.map((piece) => piece.pinyin).join(" "),
			py: consumed,
			isPhrase: true,
		});
		seen.add(text);
	}

	for (const entry of scored) {
		if (seen.has(entry.text)) continue;
		seen.add(entry.text);
		list.push({
			text: entry.text,
			pinyin: entry.pinyin,
			py: entry.py,
			isPhrase: false,
		});
		if (list.length >= limit) break;
	}
	return list;
}

let cachedIndex = null;

function getIndex() {
	if (cachedIndex) return cachedIndex;
	const DictionaryService = require("../services/DictionaryService");
	cachedIndex = buildIndex(entriesFromDict(DictionaryService.loadDict()));
	return cachedIndex;
}

function suggestQuery(raw) {
	return suggest(getIndex(), raw);
}

module.exports = {
	entriesFromDict,
	buildIndex,
	suggest,
	suggestQuery,
};
