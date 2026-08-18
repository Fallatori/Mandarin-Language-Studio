const express = require("express");
const router = express.Router();
const db = require("../models");
const WordService = require("../services/WordService");
const wordService = new WordService(db);
const authenticateToken = require("../middleware/auth");
const { suggestQuery } = require("../utils/pinyinIme");

const BOOST_TTL = 60000;
const boostCache = new Map();

async function boostFor(userId) {
	const cached = boostCache.get(userId);
	if (cached && Date.now() - cached.at < BOOST_TTL) return cached.texts;

	const texts = new Set(await wordService.getUserWordTexts(userId));
	boostCache.set(userId, { texts, at: Date.now() });
	return texts;
}

router.use(authenticateToken);

router.get("/", async (req, res) => {
	try {
		const q = String(req.query.q || "");
		if (!q || q.length > 80) {
			return res.json({ candidates: [] });
		}
		res.json({ candidates: suggestQuery(q, await boostFor(req.user.id)) });
	} catch (err) {
		if (err.status) {
			return res.status(err.status).json({ error: err.message });
		}
		console.error("IME suggest failed:", err);
		res.status(500).json({ error: "Failed to suggest hanzi" });
	}
});

module.exports = router;
