// usage: node scripts/buildImeDict.js [--min-freq=5] [--no-speech] [path/to/SUBTLEX-CH-WF]
//
// Writes data/ime.json from the jieba lexicon (word frequencies), data/cedict.json
// (readings) and SUBTLEX-CH (spoken-register frequencies, downloaded unless a path
// is given). Run build:dictionary first. Idempotent.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const pinyinModule = require("pinyin");
const { normalizePinyin } = require("../utils/pinyinSearch");

const pinyin = pinyinModule.default || pinyinModule;

const JIEBA_DICT = path.join(
	path.dirname(require.resolve("nodejieba/package.json")),
	"submodules",
	"cppjieba",
	"dict",
	"jieba.dict.utf8",
);
const CEDICT_PATH = path.join(__dirname, "..", "data", "cedict.json");
const OUT_PATH = path.join(__dirname, "..", "data", "ime.json");

const SUBTLEX_URL =
	"https://journals.plos.org/plosone/article/file?type=supplementary&id=10.1371/journal.pone.0010729.s002";

const MAX_CHARS = 8;
const SPEECH_WEIGHT = 0.6;
const SPEECH_FLOOR = 0.1;
const VARIANT_FLOOR = 50;
const MAX_VARIANTS = 3;
const VARIANT_DISCOUNT = 0.05;

const FINALS = [
	"iang", "iong", "uang", "ueng",
	"ang", "eng", "ong", "iao", "ian", "ing", "uai", "uan", "uen", "van",
	"ai", "ei", "ao", "ou", "an", "en", "er", "ia", "ie", "iu", "in",
	"ua", "uo", "ui", "un", "ue", "vn", "ve",
	"a", "o", "e", "i", "u", "v",
];
const INITIALS = [
	"zh", "ch", "sh",
	"b", "p", "m", "f", "d", "t", "n", "l", "g", "k", "h",
	"j", "q", "x", "r", "z", "c", "s", "y", "w",
];
const SYLLABLE = new RegExp(`^(?:${INITIALS.join("|")})?(?:${FINALS.join("|")})$`);

function isSyllable(value) {
	return SYLLABLE.test(value);
}

function parseMinFreq(argv) {
	const flag = argv.find((a) => a.startsWith("--min-freq="));
	if (!flag) return 5;
	const value = Number(flag.slice("--min-freq=".length));
	if (!Number.isFinite(value) || value < 1) {
		throw new Error(`Bad --min-freq: ${flag}`);
	}
	return value;
}

function readJieba() {
	const lines = fs.readFileSync(JIEBA_DICT, "utf8").split("\n");
	const rows = [];
	let total = 0;
	for (const line of lines) {
		const space = line.indexOf(" ");
		if (space === -1) continue;
		const text = line.slice(0, space);
		const freq = Number(line.slice(space + 1).split(" ")[0]);
		if (!freq || !/^\p{Script=Han}+$/u.test(text)) continue;
		total += freq;
		if ([...text].length > MAX_CHARS) continue;
		rows.push({ text, freq });
	}
	return { rows, total };
}

function resolveSubtlex(argPath) {
	if (argPath) return argPath;

	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "subtlex-"));
	const zip = path.join(tmp, "subtlex.zip");
	console.log("Downloading SUBTLEX-CH...");
	execFileSync("curl", ["-sSL", "--max-time", "120", "-o", zip, SUBTLEX_URL]);
	execFileSync("unzip", ["-o", "-q", zip, "-d", tmp]);
	return path.join(tmp, "SUBTLEX-CH-WF");
}

function readSubtlex(sourcePath) {
	const text = new TextDecoder("gb18030").decode(fs.readFileSync(sourcePath));
	const counts = new Map();
	let total = 0;
	for (const line of text.split("\n")) {
		const cells = line.replace(/\r$/, "").split("\t");
		if (cells.length < 2) continue;
		const count = Number(cells[1]);
		if (!count || !/^\p{Script=Han}+$/u.test(cells[0])) continue;
		counts.set(cells[0], count);
		total += count;
	}
	return { counts, total };
}

function readingsOf(char, cache) {
	if (cache.has(char)) return cache.get(char);
	let list = [];
	try {
		list = pinyin(char, { style: 0, heteronym: true })[0] || [];
	} catch {
		list = [];
	}
	const clean = [];
	for (const syllable of list) {
		const py = normalizePinyin(syllable);
		if (py && isSyllable(py) && !clean.includes(py)) clean.push(py);
	}
	cache.set(char, clean);
	return clean;
}

function fromCedict(text, cedict) {
	const entry = cedict[text];
	if (!entry || !entry[0]) return null;
	const syllables = String(entry[0])
		.split(/\s+/)
		.map(normalizePinyin)
		.filter(isSyllable);
	if (syllables.length !== [...text].length) return null;
	return syllables;
}

function fromSegmenter(text) {
	let raw = [];
	try {
		raw = pinyin(text, { style: 0, segment: true });
	} catch {
		return null;
	}
	const syllables = raw
		.map((options) => normalizePinyin(options[0]))
		.filter(isSyllable);
	if (syllables.length !== [...text].length) return null;
	return syllables;
}

function variantsOf(text, syllables, cache) {
	const chars = [...text];
	const out = [];
	for (let i = 0; i < chars.length && out.length < MAX_VARIANTS; i++) {
		const readings = readingsOf(chars[i], cache);
		if (readings.length < 2) continue;
		for (const reading of readings) {
			if (reading === syllables[i]) continue;
			const variant = [...syllables];
			variant[i] = reading;
			out.push(variant);
			if (out.length >= MAX_VARIANTS) break;
		}
	}
	return out;
}

function blender(jiebaTotal, speech) {
	return (freq, text) => {
		const written = (freq / jiebaTotal) * 1e6;
		if (!speech) return Math.max(1, Math.round(written * 1000));
		const count = speech.counts.get(text);
		const spoken = count ? (count / speech.total) * 1e6 : SPEECH_FLOOR;
		const log =
			SPEECH_WEIGHT * Math.log(spoken)
			+ (1 - SPEECH_WEIGHT) * Math.log(written);
		return Math.max(1, Math.round(Math.exp(log) * 1000));
	};
}

function build(minFreq, speech) {
	if (!fs.existsSync(CEDICT_PATH)) {
		console.error(
			"data/cedict.json is missing. Run: npm run build:dictionary",
		);
		process.exit(1);
	}

	const cedict = JSON.parse(fs.readFileSync(CEDICT_PATH, "utf8"));
	const { rows, total } = readJieba();
	const weigh = blender(total, speech);
	const cache = new Map();

	const merged = new Map();
	const add = (text, syllables, freq) => {
		if (!syllables || !syllables.length) return;
		const key = `${text}|${syllables.join(" ")}`;
		const existing = merged.get(key);
		if (existing && existing[2] >= freq) return;
		merged.set(key, [text, syllables.join(" "), freq]);
	};

	let kept = 0;
	let fromDict = 0;
	let fromSeg = 0;
	let heteronyms = 0;
	let variants = 0;
	const unreadable = [];

	for (const { text, freq: raw } of rows) {
		if (raw < minFreq) continue;
		kept += 1;
		const freq = weigh(raw, text);
		const chars = [...text];

		if (chars.length === 1) {
			const readings = readingsOf(text, cache);
			const preferred = fromCedict(text, cedict);
			const primary = preferred ? preferred[0] : readings[0];
			if (!primary) {
				if (unreadable.length < 5) unreadable.push(text);
				continue;
			}
			add(text, [primary], freq);
			for (const reading of readings) {
				if (reading === primary) continue;
				heteronyms += 1;
				add(text, [reading], Math.max(1, Math.round(freq * VARIANT_DISCOUNT)));
			}
			continue;
		}

		let syllables = fromCedict(text, cedict);
		if (syllables) {
			fromDict += 1;
		} else {
			syllables = fromSegmenter(text);
			if (!syllables) {
				if (unreadable.length < 5) unreadable.push(text);
				continue;
			}
			fromSeg += 1;
		}
		add(text, syllables, freq);

		if (raw >= VARIANT_FLOOR) {
			for (const variant of variantsOf(text, syllables, cache)) {
				variants += 1;
				add(text, variant, Math.max(1, Math.round(freq * VARIANT_DISCOUNT)));
			}
		}
	}

	const entries = [...merged.values()].sort((a, b) => b[2] - a[2]);

	fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
	fs.writeFileSync(OUT_PATH, JSON.stringify(entries));

	const bytes = fs.statSync(OUT_PATH).size;
	console.log(`Read ${rows.length} jieba entries, kept ${kept} at freq >= ${minFreq}`);
	if (speech) {
		console.log(`   blended ${speech.counts.size} SUBTLEX-CH spoken frequencies`);
	} else {
		console.log("   no speech corpus: jieba frequencies only");
	}
	console.log(`   readings: ${fromDict} from cedict, ${fromSeg} from segmenter`);
	console.log(`   added ${heteronyms} heteronym rows, ${variants} polyphone variants`);
	if (unreadable.length) {
		console.log(`   skipped (no reading): ${unreadable.join(" ")}`);
	}
	console.log(`Wrote ${OUT_PATH}: ${entries.length} rows (${(bytes / 1048576).toFixed(1)} MB)`);
}

if (require.main === module) {
	const argv = process.argv.slice(2);
	let speech = null;
	if (!argv.includes("--no-speech")) {
		try {
			speech = readSubtlex(resolveSubtlex(argv.find((a) => !a.startsWith("--"))));
		} catch (error) {
			console.warn(`SUBTLEX-CH unavailable (${error.message}), using jieba only`);
		}
	}
	build(parseMinFreq(argv), speech);
}

module.exports = {
	isSyllable,
	readJieba,
	readSubtlex,
	blender,
	fromCedict,
	fromSegmenter,
	variantsOf,
	readingsOf,
	OUT_PATH,
};
