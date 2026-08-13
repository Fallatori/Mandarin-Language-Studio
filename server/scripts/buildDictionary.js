// usage: node scripts/buildDictionary.js [path/to/cedict_ts.u8]
// Downloads CC-CEDICT when no path is given, then writes data/cedict.json.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const CEDICT_URL =
	"https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.zip";
const OUT_PATH = path.join(__dirname, "..", "data", "cedict.json");

const TONE_MARKS = {
	a: ["ā", "á", "ǎ", "à", "a"],
	e: ["ē", "é", "ě", "è", "e"],
	i: ["ī", "í", "ǐ", "ì", "i"],
	o: ["ō", "ó", "ǒ", "ò", "o"],
	u: ["ū", "ú", "ǔ", "ù", "u"],
	"ü": ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

function toneSyllable(syllable) {
	const match = syllable.match(/^([a-zü:]+)([1-5])$/i);
	if (!match) return syllable.toLowerCase();

	const tone = Number(match[2]);
	let body = match[1].toLowerCase().replace(/u:/g, "ü").replace(/v/g, "ü");

	let target = -1;
	for (const vowel of ["a", "o", "e"]) {
		const at = body.indexOf(vowel);
		if (at !== -1) {
			target = at;
			break;
		}
	}
	if (target === -1) {
		const vowels = [...body].map((c, i) => (/[iouü]/.test(c) ? i : -1));
		const found = vowels.filter((i) => i !== -1);
		target = found.length ? found[found.length - 1] : -1;
	}
	if (target === -1) return body;

	const letter = body[target];
	const marks = TONE_MARKS[letter];
	if (!marks) return body;

	return body.slice(0, target) + marks[tone - 1] + body.slice(target + 1);
}

function tonePinyin(raw) {
	return raw
		.split(/\s+/)
		.filter(Boolean)
		.map(toneSyllable)
		.join(" ");
}

function cleanDefinitions(block) {
	return block
		.split("/")
		.map((d) => d.trim())
		.filter(Boolean)
		.filter((d) => !/^CL:/.test(d))
		.filter((d) => !/^(variant of|old variant of|see [A-Z]?)/i.test(d))
		.map((d) => d.replace(/\[[^\]]*\]/g, "").trim())
		.filter(Boolean);
}

const GLOSS_BUDGET = 60;
const MAX_SENSES = 3;

function joinSenses(definitions) {
	const kept = [];
	let length = 0;

	for (const sense of definitions.slice(0, MAX_SENSES)) {
		const short = sense.length > GLOSS_BUDGET
			? `${sense.slice(0, GLOSS_BUDGET - 1).trimEnd()}…`
			: sense;
		if (kept.length > 0 && length + short.length > GLOSS_BUDGET) break;
		kept.push(short);
		length += short.length + 2;
	}

	return kept.join("; ");
}

const PREFERRED_READING = {
	了: "le5",
	着: "zhe5",
	么: "me5",
	没: "mei2",
	什: "shen2",
	的: "de5",
	地: "de5",
	得: "de5",
};

function scoreEntry(rawPinyin, rawDefinitions, definitions, simplified) {
	const preferred = PREFERRED_READING[simplified];
	if (preferred) {
		return rawPinyin.toLowerCase() === preferred ? 1000 : -1000;
	}

	let score = definitions.length;

	if (/(^|\s)[A-Z]/.test(rawPinyin)) score -= 100;
	if (rawDefinitions.some((d) => /^surname\b/i.test(d))) score -= 100;
	if (rawDefinitions.some((d) => /^(old |erhua |)variant of/i.test(d))) {
		score -= 50;
	}
	if (rawDefinitions.some((d) => /^(abbr\.|used in|see )/i.test(d))) score -= 20;

	return score;
}

function resolveSource(argPath) {
	if (argPath) return argPath;

	const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cedict-"));
	const zip = path.join(tmp, "cedict.zip");
	console.log("Downloading CC-CEDICT...");
	execFileSync("curl", ["-sSL", "--max-time", "120", "-o", zip, CEDICT_URL]);
	execFileSync("unzip", ["-o", "-q", zip, "-d", tmp]);

	const found = fs
		.readdirSync(tmp)
		.find((f) => f.endsWith(".u8"));
	if (!found) throw new Error("No .u8 file found in the CC-CEDICT archive");
	return path.join(tmp, found);
}

function build(sourcePath) {
	const lines = fs.readFileSync(sourcePath, "utf8").split("\n");
	const entries = {};
	const scores = {};
	let parsed = 0;

	for (const line of lines) {
		if (!line || line.startsWith("#")) continue;

		const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.*)\/\s*$/);
		if (!match) continue;

		const [, , simplified, rawPinyin, defBlock] = match;
		const rawDefinitions = defBlock
			.split("/")
			.map((d) => d.trim())
			.filter(Boolean);
		const definitions = cleanDefinitions(defBlock);
		if (definitions.length === 0) continue;

		parsed += 1;

		const score = scoreEntry(rawPinyin, rawDefinitions, definitions, simplified);
		const existing = scores[simplified];
		if (existing !== undefined && existing >= score) continue;

		scores[simplified] = score;
		entries[simplified] = [tonePinyin(rawPinyin), joinSenses(definitions)];
	}

	fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
	fs.writeFileSync(OUT_PATH, JSON.stringify(entries));

	const bytes = fs.statSync(OUT_PATH).size;
	console.log(`Parsed ${parsed} lines into ${Object.keys(entries).length} entries`);
	console.log(`Wrote ${OUT_PATH} (${(bytes / 1048576).toFixed(1)} MB)`);
}

if (require.main === module) {
	build(resolveSource(process.argv[2]));
}

module.exports = {
	tonePinyin,
	cleanDefinitions,
	joinSenses,
	scoreEntry,
	resolveSource,
	OUT_PATH,
};
