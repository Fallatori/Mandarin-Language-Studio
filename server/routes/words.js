const express = require("express");
const router = express.Router();
const db = require("../models");
const WordService = require("../services/WordService");
const wordService = new WordService(db);
const authenticateToken = require("../middleware/auth");

router.use(authenticateToken);

router.get("/", async (req, res) => {
	try {
		const words = await wordService.getWordsByUser(req.user.id);

		if (words == null) {
			return res.status(404).json({ error: "Words not found" });
		}

		res.json(words);
	} catch (err) {
		console.error("Error fetching words for user:", err);
		res.status(500).json({ error: "Internal server error" });
	}
});

module.exports = router;
