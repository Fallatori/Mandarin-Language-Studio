const { httpError } = require("../utils/httpError");

let client = null;

function getClient() {
	if (client) return client;

	const { Translate } = require("@google-cloud/translate").v2;

	if (process.env.GOOGLE_TRANSLATE_API_KEY) {
		client = new Translate({ key: process.env.GOOGLE_TRANSLATE_API_KEY });
	} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
		client = new Translate();
	} else {
		throw httpError(
			500,
			"Translation is not configured. Set GOOGLE_TRANSLATE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS in server/.env",
		);
	}

	return client;
}

class TranslationService {
	isConfigured() {
		return !!(
			process.env.GOOGLE_TRANSLATE_API_KEY ||
			process.env.GOOGLE_APPLICATION_CREDENTIALS
		);
	}

	async translate(text, targetLang = "en") {
		if (!text || !String(text).trim()) return "";

		const [result] = await getClient().translate(String(text), targetLang);
		return result;
	}

	async translateBatch(texts, targetLang = "en") {
		const list = texts.filter((t) => t && String(t).trim());
		if (list.length === 0) return [];

		const [results] = await getClient().translate(list, targetLang);
		return Array.isArray(results) ? results : [results];
	}
}

module.exports = TranslationService;
