const express = require("express");
const router = express.Router();
const db = require("../models");
const WordService = require("../services/WordService");
const wordService = new WordService(db);
const authenticateToken = require("../middleware/auth");

router.use(authenticateToken);

router.post("/", async (req, res) => {
	try {
		const { chineseWord, pinyin, englishTranslation } = req.body;
		const created = await wordService.addWord(
			{ chineseWord, pinyin, englishTranslation },
			req.user.id,
		);
		res.status(201).json(created);
	} catch (err) {
		if (err.status) {
			return res.status(err.status).json({ error: err.message });
		}
		console.error("Error adding word:", err);
		res.status(500).json({ error: "Failed to add word" });
	}
});

router.delete("/all", async (req, res) => {
	try {
		await wordService.deleteAllWordsByUser(req.user.id);
		res.json({ message: "All words deleted successfully" });
	} catch (error) {
		console.error("Error deleting all words:", error);
		res.status(500).json({ message: "Failed to delete all words" });
	}
});

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

router.put("/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const { chineseWord, pinyin, englishTranslation, notes } = req.body;

		const updatedWord = await wordService.updateWord(
			id,
			{
				chineseWord,
				pinyin,
				englishTranslation,
				notes,
			},
			req.user.id,
		);
		res.json(updatedWord);
	} catch (err) {
		if (err.status) {
			return res.status(err.status).json({ error: err.message });
		}
		console.error("Error updating word:", err);
		res.status(500).json({ error: "Failed to update word" });
	}
});

router.patch("/:id/status", async (req, res) => {
	try {
		const updated = await wordService.setStatus(
			req.params.id,
			req.user.id,
			req.body.status,
		);
		res.json(updated);
	} catch (err) {
		if (err.status) {
			return res.status(err.status).json({ error: err.message });
		}
		console.error("Error updating word status:", err);
		res.status(500).json({ error: "Failed to update word status" });
	}
});

router.delete("/:id", async (req, res) => {
	try {
		const { id } = req.params;
		await wordService.deleteWord(id, req.user.id);
		res.status(204).send();
	} catch (err) {
		if (err.status) {
			return res.status(err.status).json({ error: err.message });
		}
		console.error("Error deleting word:", err);
		res.status(500).json({ error: "Failed to delete word" });
	}
});

module.exports = router;
