const express = require("express");
const router = express.Router();
const db = require("../models");
const SentenceService = require("../services/SentenceService");
const sentenceService = new SentenceService(db);
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authenticateToken = require("../middleware/auth");
const TranslationQuotaService = require("../services/TranslationQuotaService");
const translationQuota = new TranslationQuotaService(db);

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadDir);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const extension = path.extname(file.originalname);
		cb(null, file.fieldname + "-" + uniqueSuffix + extension);
	},
});

const upload = multer({
	storage: storage,
	fileFilter: (req, file, cb) => {
		if (file.mimetype.startsWith("audio/")) {
			cb(null, true);
		} else {
			cb(new Error("Only audio files are allowed!"), false);
		}
	},
});

router.use(authenticateToken);

router.delete("/all", async (req, res) => {
	try {
		await sentenceService.deleteAllSentencesByUser(req.user.id);
		res.json({ message: "All sentences deleted successfully" });
	} catch (error) {
		console.error("Error deleting all sentences:", error);
		res.status(500).json({ message: "Failed to delete all sentences" });
	}
});

router.post("/analyze", async (req, res) => {
	try {
		const { chineseText } = req.body;
		if (!chineseText) {
			return res.status(400).json({ message: "Text is required" });
		}
		const result = await sentenceService.analyzeSentence(
			chineseText,
			req.user.id,
		);
		res.json(result);
	} catch (error) {
		if (error.status === 429) {
			return res.status(429).json({ message: error.message });
		}
		console.error("Analysis endpoint error:", error);
		res.status(500).json({ message: "Analysis failed" });
	}
});

router.post("/check-existing", async (req, res) => {
	try {
		const { chineseTexts } = req.body;
		if (!chineseTexts || !Array.isArray(chineseTexts)) {
			return res
				.status(400)
				.json({ message: "Invalid format. Expected array of texts." });
		}

		const existing = await sentenceService.checkExistingSentences(
			chineseTexts,
			req.user.id,
		);
		res.json({ existing });
	} catch (error) {
		console.error("Check existing error:", error);
		res.status(500).json({ message: "Check failed" });
	}
});

router.post("/bulk", async (req, res) => {
	try {
		const { sentences } = req.body;
		if (!Array.isArray(sentences)) {
			return res
				.status(400)
				.json({ message: "Invalid format. Expected array of sentences." });
		}

		console.log(`Processing bulk upload of ${sentences.length} sentences...`);
		const result = await sentenceService.addBulkSentences(
			sentences,
			req.user.id,
		);

		res.json(result);
	} catch (error) {
		console.error("Bulk upload error:", error);
		res.status(500).json({ message: "Bulk upload failed" });
	}
});

router.post("/translate", async (req, res) => {
	try {
		const { text, targetLang } = req.body;
		if (!text) {
			return res.status(400).json({ message: "Text is required" });
		}

		const translation = await sentenceService.translateText(
			text,
			targetLang,
			req.user.id,
		);

		res.json({ translation });
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ message: error.message });
		}
		console.error("Translation endpoint error:", error);
		res.status(500).json({ message: "Translation failed" });
	}
});

router.get("/translation-usage", async (req, res) => {
	try {
		const usage = await translationQuota.getGlobalUsage();
		res.json(usage);
	} catch (error) {
		console.error("Translation usage error:", error);
		res.status(500).json({ message: "Failed to load translation usage." });
	}
});

router.get("/", async (req, res) => {
	try {
		const { filter, page, limit, search } = req.query;
		const result = await sentenceService.getSentencesByUser(req.user.id, {
			filter: filter || "all",
			page: page || 1,
			limit: limit || 20,
			search: search || "",
		});

		res.json(result);
	} catch (error) {
		console.error("Error fetching sentences:", error);
		res.status(500).json({ message: "Failed to fetch sentences." });
	}
});

router.get("/flashcards", async (req, res) => {
	try {
		const { deckId, filter } = req.query;

		const result = await sentenceService.getFlashcardSentences(req.user.id, {
			deckId: deckId && deckId !== "all" ? deckId : null,
			filter: filter || "all",
			limit: 1000,
		});

		res.json(result.sentences);
	} catch (error) {
		console.error("Flashcards fetch error:", error);

		res.status(500).json({ message: "Failed to load flashcards." });
	}
});

router.get("/flashcards/counts", async (req, res) => {
	try {
		const { deckId } = req.query;
		const counts = await sentenceService.getFlashcardCounts(req.user.id, {
			deckId: deckId && deckId !== "all" ? deckId : null,
		});
		res.json(counts);
	} catch (error) {
		console.error("Flashcards counts error:", error);
		res.status(500).json({ message: "Failed to load flashcard counts." });
	}
});

router.post("/", upload.single("audioFile"), async (req, res) => {
	try {
		const { chineseText, englishTranslation, definedWords } = req.body;

		if (!chineseText || !englishTranslation) {
			return res.status(400).json({ message: "Missing required fields." });
		}

		const existingSentence = await sentenceService.getSentenceByName(
			chineseText,
			req.user.id,
		);
		if (existingSentence) {
			return res
				.status(400)
				.json({ message: "Sentence with this Chinese text already exists." });
		}

		let parsedWords = [];
		if (definedWords) {
			try {
				parsedWords = JSON.parse(definedWords);
			} catch (e) {
				console.warn("Could not parse definedWords", e);
			}
		}

		const audioFilename = req.file ? req.file.filename : null;

		const newSentence = await sentenceService.addSentence({
			chineseText: chineseText,
			englishTranslation: englishTranslation,
			audioFilename: audioFilename,
			creator_id: req.user.id,
			definedWords: parsedWords,
		});

		res.status(201).json(newSentence);
	} catch (error) {
		if (error.status === 429) {
			return res.status(429).json({ message: error.message });
		}

		console.error("Error adding sentence:", error);
		res.status(500).json({ message: "Failed to add sentence." });
	}
});

router.get("/:id/tokens", async (req, res) => {
	try {
		const sentence = await sentenceService.getOwnedSentence(
			req.params.id,
			req.user.id,
		);
		const tokens = await sentenceService.tokenizeSentence(
			sentence.chineseText,
			req.user.id,
		);
		res.json(tokens);
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ message: error.message });
		}
		console.error("Error tokenizing sentence:", error);
		res.status(500).json({ message: "Failed to tokenize sentence." });
	}
});

router.put("/:id", async (req, res) => {
	try {
		const { pinyin, englishTranslation } = req.body;

		if (pinyin === undefined && englishTranslation === undefined) {
			return res.status(400).json({ message: "Nothing to update." });
		}

		const updated = await sentenceService.updateSentence(
			req.params.id,
			{ pinyin, englishTranslation },
			req.user.id,
		);
		res.json(updated);
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ message: error.message });
		}
		console.error("Error updating sentence:", error);
		res.status(500).json({ message: "Failed to update sentence." });
	}
});

router.patch("/:id/difficult", async (req, res) => {
	try {
		const { difficult } = req.body || {};
		const updated = await sentenceService.setSentenceDifficult(
			req.params.id,
			req.user.id,
			!!difficult,
		);
		res.json(updated);
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ message: error.message });
		}
		console.error("Set difficult error:", error);
		res.status(500).json({ message: "Failed to update difficult flag." });
	}
});

router.patch("/:id/practice", async (req, res) => {
	const { id } = req.params;

	try {
		const xpDelta = SentenceService.resolvePracticeXp(req.body?.xp);
		const updatedSentence = await sentenceService.markAsPracticed(
			id,
			req.user.id,
			xpDelta,
		);
		res.json(updatedSentence);
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ message: error.message });
		}
		console.error("Error marking sentence as practiced:", error);
		res.status(500).json({ message: "Failed to mark sentence as practiced." });
	}
});

router.delete("/:id", async (req, res) => {
	const { id } = req.params;

	try {
		const sentence = await sentenceService.getOwnedSentence(id, req.user.id);

		if (sentence.audioFilename) {
			const filePath = path.join(
				__dirname,
				"..",
				"uploads",
				sentence.audioFilename,
			);

			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		}

		await sentenceService.deleteSentence(id, req.user.id);
		res.status(204).send();
	} catch (error) {
		if (error.status) {
			return res.status(error.status).json({ message: error.message });
		}
		console.error("Error deleting sentence:", error);
		res.status(500).json({ message: "Failed to delete sentence." });
	}
});

module.exports = router;
