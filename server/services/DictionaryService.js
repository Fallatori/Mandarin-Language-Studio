const fs = require("fs");
const path = require("path");
const { httpError } = require("../utils/httpError");

const DATA_PATH = path.join(__dirname, "..", "data", "cedict.json");

let entries = null;

function load() {
	if (entries) return entries;

	if (!fs.existsSync(DATA_PATH)) {
		throw httpError(
			500,
			"Dictionary data is missing. Run: npm run build:dictionary",
		);
	}

	entries = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
	return entries;
}

class DictionaryService {
	lookup(chineseWord) {
		if (!chineseWord) return null;

		const entry = load()[chineseWord];
		if (!entry) return null;

		return { pinyin: entry[0], englishTranslation: entry[1] };
	}

	isLoaded() {
		return fs.existsSync(DATA_PATH);
	}
}

module.exports = DictionaryService;
